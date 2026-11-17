import type { AccountStatus, Role } from '@az/shared';
import type { RequestHandler } from 'express';
import type { AppDeps } from '../deps';
import { hashToken } from '../lib/crypto';
import { AppError } from '../lib/errors';

export interface AuthContext {
  userId: string;
  sessionId: string;
  role: Role;
  status: AccountStatus;
}

interface SessionRow {
  session_id: string;
  user_id: string;
  role: Role;
  onboarded_at: Date | null;
  stale: boolean;
}

export function accountStatus(u: { onboarded_at: Date | null }): AccountStatus {
  return u.onboarded_at ? 'active' : 'onboarding_required';
}

/** Lê o cookie de sessão e popula req.auth. Não bloqueia: quem bloqueia é requireAuth. */
export function loadSession(deps: AppDeps): RequestHandler {
  return async (req, _res, next) => {
    const token: unknown = req.cookies?.[deps.config.sessionCookieName];
    if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) return next();
    const { rows } = await deps.db.pool.query<SessionRow>(
      `select s.id as session_id, u.id as user_id, u.role, u.onboarded_at, s.last_seen_at < now() - interval '5 minutes' as stale
         from private.sessions s
         join public.users u on u.id = s.user_id
        where s.token_hash = $1 and s.revoked_at is null and s.expires_at > now()
          and u.disabled_at is null`,
      [hashToken(token)],
    );
    const row = rows[0];
    if (!row) return next();
    if (row.stale) {
      await deps.db.pool.query('update private.sessions set last_seen_at = now() where id = $1', [
        row.session_id,
      ]);
    }
    req.auth = {
      userId: row.user_id,
      sessionId: row.session_id,
      role: row.role,
      status: accountStatus(row),
    };
    next();
  };
}

export const requireAuth: RequestHandler = (req, _res, next) => {
  if (!req.auth) return next(new AppError('UNAUTHENTICATED'));
  next();
};

/** Papel verificado no servidor a cada requisição (lido do banco em loadSession). */
export function requireRole(...roles: Role[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.auth) return next(new AppError('UNAUTHENTICATED'));
    if (!roles.includes(req.auth.role)) return next(new AppError('FORBIDDEN'));
    next();
  };
}

/** Bloqueia funcionalidades enquanto faltar o onboarding (aceite dos termos). */
export const requireActiveAccount: RequestHandler = (req, _res, next) => {
  if (!req.auth) return next(new AppError('UNAUTHENTICATED'));
  if (req.auth.status === 'onboarding_required') return next(new AppError('ONBOARDING_REQUIRED'));
  next();
};

export function authOf(req: { auth?: AuthContext }): AuthContext {
  if (!req.auth) throw new AppError('UNAUTHENTICATED');
  return req.auth;
}
