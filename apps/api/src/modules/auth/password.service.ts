import type { Locale, RegisterInput } from '@az/shared';
import type { AppDeps } from '../../deps';
import { AppError } from '../../lib/errors';
import { dummyHash, hashPassword, verifyPassword } from '../../lib/password';
import { audit } from '../audit/audit';
import { passwordResetEmail, verifyEmailEmail } from '../email/templates';
import { finishLogin, type LoginResult } from './auth.service';
import { consumeEmailToken, createEmailToken } from './email-tokens';
import { revokeSessions } from './sessions';

async function upsertPassword(
  c: Parameters<Parameters<AppDeps['db']['system']>[0]>[0],
  userId: string,
  hash: string,
) {
  await c.query(
    `insert into private.user_credentials (user_id, password_hash) values ($1, $2)
     on conflict (user_id) do update set password_hash = excluded.password_hash, updated_at = now()`,
    [userId, hash],
  );
}

/**
 * Cadastro com senha. Resposta sempre igual (não revela quem tem conta).
 * - E-mail novo de escola cadastrada: cria aluno não confirmado e envia o link de confirmação.
 * - Conta existente ainda não confirmada: troca a senha e reenvia (quem confirmar é o dono do e-mail).
 * - Conta confirmada ou domínio fora das escolas: não faz nada.
 */
export async function register(
  deps: AppDeps,
  input: RegisterInput,
  ipHash: string | null,
): Promise<void> {
  const hash = await hashPassword(input.password); // sempre, para o tempo não depender do caso
  const token = await deps.db.system(async (c) => {
    const existing = (
      await c.query<{ id: string; email_verified_at: Date | null; disabled_at: Date | null }>(
        'select id, email_verified_at, disabled_at from public.users where email = $1 for update',
        [input.email],
      )
    ).rows[0];

    let userId: string;
    if (existing) {
      if (existing.email_verified_at || existing.disabled_at) return null;
      userId = existing.id;
    } else {
      const domain = input.email.split('@')[1] ?? '';
      const school = (
        await c.query<{ id: string }>('select id from public.schools where email_domain = $1', [
          domain,
        ])
      ).rows[0];
      if (!school) {
        await audit(c, { actorId: null, action: 'auth.register_denied', ipHash });
        return null;
      }
      userId = (
        await c.query<{ id: string }>(
          `insert into public.users (email, role, school_id, locale) values ($1, 'student', $2, $3) returning id`,
          [input.email, school.id, input.locale],
        )
      ).rows[0]!.id;
      await audit(c, {
        actorId: userId,
        action: 'account.created',
        targetType: 'user',
        targetId: userId,
        ipHash,
      });
    }
    await upsertPassword(c, userId, hash);
    return createEmailToken(c, userId, 'verify_email');
  });

  if (token) {
    await deps.email.send(
      verifyEmailEmail(
        input.email,
        input.locale,
        `${deps.config.appOrigin}/verify-email#token=${token}`,
      ),
    );
  }
}

/** Reenvia o link de confirmação. Resposta sempre igual. */
export async function resendVerification(
  deps: AppDeps,
  input: { email: string; locale: Locale },
): Promise<void> {
  const token = await deps.db.system(async (c) => {
    const user = (
      await c.query<{ id: string }>(
        `select id from public.users where email = $1 and email_verified_at is null and disabled_at is null`,
        [input.email],
      )
    ).rows[0];
    return user ? createEmailToken(c, user.id, 'verify_email') : null;
  });
  if (token) {
    await deps.email.send(
      verifyEmailEmail(
        input.email,
        input.locale,
        `${deps.config.appOrigin}/verify-email#token=${token}`,
      ),
    );
  }
}

export async function verifyEmail(
  deps: AppDeps,
  token: string,
  ipHash: string | null,
): Promise<LoginResult> {
  return deps.db.system(async (c) => {
    const userId = await consumeEmailToken(c, token, 'verify_email');
    if (!userId) throw new AppError('EMAIL_TOKEN_INVALID');
    const ok = await c.query(
      `update public.users set email_verified_at = coalesce(email_verified_at, now())
        where id = $1 and disabled_at is null`,
      [userId],
    );
    if (ok.rowCount !== 1) throw new AppError('EMAIL_TOKEN_INVALID');
    await audit(c, { actorId: userId, action: 'auth.email_verified', ipHash });
    return finishLogin(c, deps, userId, ipHash, 'verify_email');
  });
}

export async function loginWithPassword(
  deps: AppDeps,
  input: { email: string; password: string },
  ipHash: string | null,
): Promise<LoginResult> {
  const user = (
    await deps.db.pool.query<{
      id: string;
      disabled_at: Date | null;
      email_verified_at: Date | null;
      password_hash: string | null;
    }>(
      `select u.id, u.disabled_at, u.email_verified_at, cr.password_hash
         from public.users u left join private.user_credentials cr on cr.user_id = u.id
        where u.email = $1`,
      [input.email],
    )
  ).rows[0];

  // Compara contra um hash descartável quando não há usuário/senha: mesmo custo nos dois casos.
  const valid = await verifyPassword(input.password, user?.password_hash ?? (await dummyHash()));

  if (!user || !user.password_hash || !valid || user.disabled_at) {
    await deps.db.system((c) =>
      audit(c, { actorId: user?.id ?? null, action: 'auth.login_failed', ipHash }),
    );
    throw new AppError('INVALID_CREDENTIALS', { status: 401 });
  }
  // Só informamos "e-mail não confirmado" depois da senha correta: não ajuda a enumerar contas.
  if (!user.email_verified_at) throw new AppError('EMAIL_NOT_VERIFIED', { status: 403 });

  return deps.db.system((c) => finishLogin(c, deps, user.id, ipHash, 'password'));
}

/** "Esqueci minha senha". Resposta sempre igual. Serve também para quem nunca definiu senha. */
export async function requestPasswordReset(
  deps: AppDeps,
  input: { email: string; locale: Locale },
  ipHash: string | null,
) {
  const token = await deps.db.system(async (c) => {
    const user = (
      await c.query<{ id: string }>(
        'select id from public.users where email = $1 and disabled_at is null',
        [input.email],
      )
    ).rows[0];
    if (!user) return null;
    await audit(c, { actorId: user.id, action: 'auth.password_reset_requested', ipHash });
    return createEmailToken(c, user.id, 'password_reset');
  });
  if (token) {
    await deps.email.send(
      passwordResetEmail(
        input.email,
        input.locale,
        `${deps.config.appOrigin}/reset-password#token=${token}`,
      ),
    );
  }
}

export async function resetPassword(
  deps: AppDeps,
  input: { token: string; password: string },
  ipHash: string | null,
): Promise<void> {
  const hash = await hashPassword(input.password);
  await deps.db.system(async (c) => {
    const userId = await consumeEmailToken(c, input.token, 'password_reset');
    if (!userId) throw new AppError('EMAIL_TOKEN_INVALID');
    await upsertPassword(c, userId, hash);
    // O link chegou no e-mail: isso também confirma o endereço.
    await c.query(
      'update public.users set email_verified_at = coalesce(email_verified_at, now()) where id = $1',
      [userId],
    );
    // Quem roubou a sessão perde o acesso.
    const count = await revokeSessions(c, userId, 'password_reset');
    await audit(c, {
      actorId: userId,
      action: 'auth.password_reset',
      ipHash,
      metadata: { sessionsRevoked: count },
    });
  });
}

export async function changePassword(
  deps: AppDeps,
  auth: { userId: string; sessionId: string },
  input: { currentPassword?: string | undefined; newPassword: string },
  ipHash: string | null,
): Promise<void> {
  const current = (
    await deps.db.pool.query<{ password_hash: string }>(
      'select password_hash from private.user_credentials where user_id = $1',
      [auth.userId],
    )
  ).rows[0];
  if (current) {
    const ok =
      !!input.currentPassword &&
      (await verifyPassword(input.currentPassword, current.password_hash));
    if (!ok) {
      await deps.db.system((c) =>
        audit(c, { actorId: auth.userId, action: 'auth.password_change_failed', ipHash }),
      );
      throw new AppError('CURRENT_PASSWORD_INVALID', { fields: ['currentPassword'] });
    }
  }
  const hash = await hashPassword(input.newPassword);
  await deps.db.system(async (c) => {
    await upsertPassword(c, auth.userId, hash);
    await revokeSessions(c, auth.userId, 'password_change', auth.sessionId);
    await audit(c, {
      actorId: auth.userId,
      action: current ? 'auth.password_changed' : 'auth.password_set',
      ipHash,
    });
  });
}
