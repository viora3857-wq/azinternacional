import type { Locale, Role } from '@az/shared';
import type { DbClient } from '../../db/database';
import type { AppDeps } from '../../deps';
import { decrypt, generateToken, hashToken } from '../../lib/crypto';
import { AppError } from '../../lib/errors';
import { verifyTotp } from '../../lib/totp';
import { audit } from '../audit/audit';
import { magicLinkEmail } from '../email/templates';
import { createSession, type NewSession } from './sessions';

export const MAGIC_LINK_TTL_MINUTES = 15;
export const MFA_CHALLENGE_TTL_MINUTES = 5;
export const MFA_MAX_ATTEMPTS = 5;

/**
 * Pede um link de acesso. Sempre termina sem revelar se o e-mail existe:
 * quem chama responde a mesma coisa nos dois casos.
 * Elegível: usuário existente e ativo, ou e-mail de um domínio de escola cadastrada (cria aluno).
 */
export async function requestMagicLink(
  deps: AppDeps,
  input: { email: string; locale: Locale },
  ipHash: string | null,
): Promise<void> {
  const { db, config, email } = deps;
  const token = generateToken();

  const eligible = await db.system(async (c) => {
    const user = (
      await c.query<{ id: string; disabled_at: Date | null }>(
        'select id, disabled_at from public.users where email = $1',
        [input.email],
      )
    ).rows[0];

    let ok: boolean;
    if (user) {
      ok = user.disabled_at === null;
    } else {
      const domain = input.email.split('@')[1] ?? '';
      const school = await c.query('select 1 from public.schools where email_domain = $1', [
        domain,
      ]);
      ok = school.rowCount === 1;
    }

    if (!ok) {
      await audit(c, { actorId: null, action: 'auth.magic_link_denied', ipHash });
      return false;
    }

    // Um link novo invalida os anteriores ainda não usados.
    await c.query(
      'update private.magic_link_tokens set used_at = now() where email = $1 and used_at is null',
      [input.email],
    );
    await c.query(
      `insert into private.magic_link_tokens (email, token_hash, expires_at, ip_hash)
       values ($1, $2, now() + make_interval(mins => $3), $4)`,
      [input.email, hashToken(token), MAGIC_LINK_TTL_MINUTES, ipHash],
    );
    await audit(c, { actorId: user?.id ?? null, action: 'auth.magic_link_requested', ipHash });
    return true;
  });

  if (!eligible) return;
  // Token no fragmento (#): não vai para logs de servidor nem para o Referer.
  const link = `${config.appOrigin}/login/verify#token=${token}`;
  await email.send(magicLinkEmail(input.email, input.locale, link));
}

export type LoginResult =
  { kind: 'session'; session: NewSession } | { kind: 'mfa'; challenge: string };

export async function verifyMagicLink(
  deps: AppDeps,
  token: string,
  ipHash: string | null,
): Promise<LoginResult> {
  const { db } = deps;
  return db.system(async (c) => {
    // Uso único atômico: só uma requisição consegue marcar used_at.
    const consumed = (
      await c.query<{ email: string }>(
        `update private.magic_link_tokens set used_at = now()
          where token_hash = $1 and used_at is null and expires_at > now()
          returning email`,
        [hashToken(token)],
      )
    ).rows[0];
    if (!consumed) throw new AppError('MAGIC_LINK_INVALID');

    let user = (
      await c.query<{ id: string; role: Role; disabled_at: Date | null }>(
        'select id, role, disabled_at from public.users where email = $1 for update',
        [consumed.email],
      )
    ).rows[0];

    if (!user) {
      const domain = consumed.email.split('@')[1] ?? '';
      const school = (
        await c.query<{ id: string }>('select id from public.schools where email_domain = $1', [
          domain,
        ])
      ).rows[0];
      if (!school) throw new AppError('MAGIC_LINK_INVALID');
      user = (
        await c.query<{ id: string; role: Role; disabled_at: Date | null }>(
          `insert into public.users (email, role, school_id) values ($1, 'student', $2)
           returning id, role, disabled_at`,
          [consumed.email, school.id],
        )
      ).rows[0]!;
      await audit(c, {
        actorId: user.id,
        action: 'account.created',
        targetType: 'user',
        targetId: user.id,
        ipHash,
      });
    }

    if (user.disabled_at) throw new AppError('MAGIC_LINK_INVALID');
    // Abrir o link prova acesso à caixa de e-mail.
    await c.query(
      'update public.users set email_verified_at = coalesce(email_verified_at, now()) where id = $1',
      [user.id],
    );
    return finishLogin(c, deps, user.id, ipHash, 'magic_link');
  });
}

/** Último passo de qualquer login: abre sessão, ou pede o código 2FA se estiver ativo. */
export async function finishLogin(
  c: DbClient,
  deps: AppDeps,
  userId: string,
  ipHash: string | null,
  method: 'magic_link' | 'password' | 'verify_email',
): Promise<LoginResult> {
  const mfa = (
    await c.query<{ enabled_at: Date | null }>(
      'select enabled_at from private.user_mfa where user_id = $1',
      [userId],
    )
  ).rows[0];

  if (mfa?.enabled_at) {
    const challenge = generateToken();
    await c.query(
      `insert into private.mfa_challenges (user_id, token_hash, expires_at)
       values ($1, $2, now() + make_interval(mins => $3))`,
      [userId, hashToken(challenge), MFA_CHALLENGE_TTL_MINUTES],
    );
    await audit(c, {
      actorId: userId,
      action: 'auth.mfa_challenge_issued',
      ipHash,
      metadata: { method },
    });
    return { kind: 'mfa', challenge };
  }

  const session = await createSession(c, deps.config, userId);
  await audit(c, { actorId: userId, action: 'auth.login', ipHash, metadata: { method } });
  return { kind: 'session', session };
}

export async function verifyMfaChallenge(
  deps: AppDeps,
  input: { challenge: string; code: string },
  ipHash: string | null,
): Promise<NewSession> {
  const { db, config } = deps;
  // A transação devolve o resultado em vez de lançar: assim o contador de tentativas é gravado.
  type Outcome =
    { error: 'MFA_INVALID_CODE' | 'MFA_CHALLENGE_INVALID' } | { error: null; session: NewSession };
  const outcome = await db.system(async (c): Promise<Outcome> => {
    const ch = (
      await c.query<{ id: string; user_id: string; attempts: number }>(
        `select id, user_id, attempts from private.mfa_challenges
          where token_hash = $1 and used_at is null and expires_at > now()
          for update`,
        [hashToken(input.challenge)],
      )
    ).rows[0];
    if (!ch || ch.attempts >= MFA_MAX_ATTEMPTS) return { error: 'MFA_CHALLENGE_INVALID' };

    const mfa = (
      await c.query<{ secret_enc: string | null; last_step: string | null }>(
        'select secret_enc, last_step from private.user_mfa where user_id = $1 for update',
        [ch.user_id],
      )
    ).rows[0];
    if (!mfa?.secret_enc) return { error: 'MFA_CHALLENGE_INVALID' };

    const step = verifyTotp(
      decrypt(mfa.secret_enc, config.encryptionKey),
      input.code,
      Date.now(),
      mfa.last_step === null ? -1 : Number(mfa.last_step),
    );
    if (step === null) {
      await c.query('update private.mfa_challenges set attempts = attempts + 1 where id = $1', [
        ch.id,
      ]);
      await audit(c, { actorId: ch.user_id, action: 'auth.mfa_failed', ipHash });
      return { error: 'MFA_INVALID_CODE' };
    }

    await c.query('update private.mfa_challenges set used_at = now() where id = $1', [ch.id]);
    await c.query(
      'update private.user_mfa set last_step = $2, updated_at = now() where user_id = $1',
      [ch.user_id, step],
    );
    const session = await createSession(c, config, ch.user_id);
    await audit(c, {
      actorId: ch.user_id,
      action: 'auth.login',
      ipHash,
      metadata: { method: 'totp' },
    });
    return { error: null, session };
  });

  if (outcome.error !== null) throw new AppError(outcome.error);
  return outcome.session;
}
