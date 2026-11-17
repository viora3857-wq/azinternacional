import type { Response } from 'express';
import type { Config } from '../../config/env';
import type { DbClient } from '../../db/database';
import { generateToken, hashToken } from '../../lib/crypto';

export type RevokeReason =
  'logout' | 'logout_all' | 'admin_shutdown' | 'mfa_change' | 'password_change' | 'password_reset';

export interface NewSession {
  token: string;
  expiresAt: Date;
}

export async function createSession(
  c: DbClient,
  config: Config,
  userId: string,
): Promise<NewSession> {
  const token = generateToken();
  const { rows } = await c.query<{ expires_at: Date }>(
    `insert into private.sessions (user_id, token_hash, expires_at)
     values ($1, $2, now() + make_interval(hours => $3))
     returning expires_at`,
    [userId, hashToken(token), config.SESSION_TTL_HOURS],
  );
  return { token, expiresAt: rows[0]!.expires_at };
}

/** Revoga sessões do usuário. `exceptSessionId` mantém a sessão atual (ex.: ao ativar 2FA). */
export async function revokeSessions(
  c: DbClient,
  userId: string,
  reason: RevokeReason,
  exceptSessionId?: string,
): Promise<number> {
  const { rowCount } = await c.query(
    `update private.sessions set revoked_at = now(), revoked_reason = $2
      where user_id = $1 and revoked_at is null and ($3::uuid is null or id <> $3::uuid)`,
    [userId, reason, exceptSessionId ?? null],
  );
  return rowCount ?? 0;
}

export function setSessionCookie(res: Response, config: Config, session: NewSession): void {
  res.cookie(config.sessionCookieName, session.token, {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'lax',
    path: '/',
    expires: session.expiresAt,
  });
}

export function clearSessionCookie(res: Response, config: Config): void {
  res.clearCookie(config.sessionCookieName, {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'lax',
    path: '/',
  });
}
