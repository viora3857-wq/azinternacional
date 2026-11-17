import type { MfaSetupResponse } from '@az/shared';
import type { AppDeps } from '../../deps';
import { decrypt, encrypt } from '../../lib/crypto';
import { AppError } from '../../lib/errors';
import { generateTotpSecret, otpauthUri, verifyTotp } from '../../lib/totp';
import { audit } from '../audit/audit';
import { revokeSessions } from './sessions';

const ISSUER = 'AZ Internacional';

export async function startMfaSetup(deps: AppDeps, userId: string): Promise<MfaSetupResponse> {
  const { db, config } = deps;
  return db.system(async (c) => {
    const user = (
      await c.query<{ email: string }>('select email from public.users where id = $1', [userId])
    ).rows[0];
    if (!user) throw new AppError('UNAUTHENTICATED');
    const current = (
      await c.query<{ enabled_at: Date | null }>(
        'select enabled_at from private.user_mfa where user_id = $1 for update',
        [userId],
      )
    ).rows[0];
    if (current?.enabled_at) throw new AppError('MFA_ALREADY_ENABLED');

    const secret = generateTotpSecret();
    await c.query(
      `insert into private.user_mfa (user_id, pending_secret_enc) values ($1, $2)
       on conflict (user_id) do update set pending_secret_enc = excluded.pending_secret_enc, updated_at = now()`,
      [userId, encrypt(secret, config.encryptionKey)],
    );
    return { secret, otpauthUri: otpauthUri(ISSUER, user.email, secret) };
  });
}

export async function enableMfa(
  deps: AppDeps,
  auth: { userId: string; sessionId: string },
  code: string,
  ipHash: string | null,
): Promise<void> {
  const { db, config } = deps;
  await db.system(async (c) => {
    const row = (
      await c.query<{ pending_secret_enc: string | null; enabled_at: Date | null }>(
        'select pending_secret_enc, enabled_at from private.user_mfa where user_id = $1 for update',
        [auth.userId],
      )
    ).rows[0];
    if (row?.enabled_at) throw new AppError('MFA_ALREADY_ENABLED');
    if (!row?.pending_secret_enc) throw new AppError('MFA_SETUP_NOT_STARTED');

    const step = verifyTotp(
      decrypt(row.pending_secret_enc, config.encryptionKey),
      code,
      Date.now(),
    );
    if (step === null) throw new AppError('MFA_INVALID_CODE');

    await c.query(
      `update private.user_mfa
          set secret_enc = pending_secret_enc, pending_secret_enc = null,
              enabled_at = now(), last_step = $2, updated_at = now()
        where user_id = $1`,
      [auth.userId, step],
    );
    // Outras sessões abertas antes do 2FA deixam de valer.
    await revokeSessions(c, auth.userId, 'mfa_change', auth.sessionId);
    await audit(c, { actorId: auth.userId, action: 'auth.mfa_enabled', ipHash });
  });
}

export async function disableMfa(
  deps: AppDeps,
  auth: { userId: string; sessionId: string },
  code: string,
  ipHash: string | null,
): Promise<void> {
  const { db, config } = deps;
  await db.system(async (c) => {
    const row = (
      await c.query<{ secret_enc: string | null; last_step: string | null }>(
        'select secret_enc, last_step from private.user_mfa where user_id = $1 for update',
        [auth.userId],
      )
    ).rows[0];
    if (!row?.secret_enc) throw new AppError('MFA_NOT_ENABLED');

    const step = verifyTotp(
      decrypt(row.secret_enc, config.encryptionKey),
      code,
      Date.now(),
      row.last_step === null ? -1 : Number(row.last_step),
    );
    if (step === null) throw new AppError('MFA_INVALID_CODE');

    await c.query(
      `update private.user_mfa
          set secret_enc = null, pending_secret_enc = null, enabled_at = null, last_step = null, updated_at = now()
        where user_id = $1`,
      [auth.userId],
    );
    await revokeSessions(c, auth.userId, 'mfa_change', auth.sessionId);
    await audit(c, { actorId: auth.userId, action: 'auth.mfa_disabled', ipHash });
  });
}

export async function isMfaEnabled(deps: AppDeps, userId: string): Promise<boolean> {
  const { rows } = await deps.db.pool.query<{ enabled: boolean }>(
    'select enabled_at is not null as enabled from private.user_mfa where user_id = $1',
    [userId],
  );
  return rows[0]?.enabled ?? false;
}
