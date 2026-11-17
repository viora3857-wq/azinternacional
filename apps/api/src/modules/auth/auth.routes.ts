import {
  changePasswordSchema,
  emailRequestSchema,
  emailTokenSchema,
  loginSchema,
  magicLinkRequestSchema,
  registerSchema,
  resetPasswordSchema,
  magicLinkVerifySchema,
  mfaCodeSchema,
  mfaVerifySchema,
  type VerifyResult,
} from '@az/shared';
import { Router, type Response } from 'express';
import type { AppDeps } from '../../deps';
import { parseInput } from '../../lib/errors';
import { authOf, requireAuth } from '../../middleware/auth';
import { HOUR, limiter, MINUTE } from '../../middleware/rate-limit';
import { audit } from '../audit/audit';
import {
  requestMagicLink,
  verifyMagicLink,
  verifyMfaChallenge,
  type LoginResult,
} from './auth.service';
import {
  changePassword,
  loginWithPassword,
  register,
  requestPasswordReset,
  resendVerification,
  resetPassword,
  verifyEmail,
} from './password.service';
import { disableMfa, enableMfa, startMfaSetup } from './mfa.service';
import { clearSessionCookie, revokeSessions, setSessionCookie } from './sessions';

export function authRouter(deps: AppDeps): Router {
  const r = Router();
  const pepper = deps.config.HASH_PEPPER;
  const ipLimit = limiter({
    windowMs: 15 * MINUTE,
    limit: deps.config.AUTH_RATE_LIMIT_PER_15MIN,
    key: 'ip',
    pepper,
    prefix: 'auth',
  });
  const emailLimit = limiter({ windowMs: HOUR, limit: 5, key: 'email', pepper, prefix: 'ml' });
  const userMfaLimit = limiter({
    windowMs: 15 * MINUTE,
    limit: 10,
    key: 'user',
    pepper,
    prefix: 'mfa',
  });
  // Força bruta de senha: 10 tentativas por e-mail a cada 15 min, além do limite por IP.
  const loginEmailLimit = limiter({
    windowMs: 15 * MINUTE,
    limit: 10,
    key: 'email',
    pepper,
    prefix: 'login',
  });

  r.post('/magic-link', ipLimit, emailLimit, async (req, res) => {
    const input = parseInput(magicLinkRequestSchema, req.body);
    await requestMagicLink(deps, input, req.ipHash);
    // Mesma resposta para e-mail cadastrado ou não (não revela quem tem conta).
    res.status(202).json({ ok: true });
  });

  function respondLogin(res: Response, result: LoginResult) {
    if (result.kind === 'mfa') {
      res.json({ status: 'mfa_required', challenge: result.challenge } satisfies VerifyResult);
      return;
    }
    setSessionCookie(res, deps.config, result.session);
    res.json({ status: 'authenticated' } satisfies VerifyResult);
  }

  r.post('/magic-link/verify', ipLimit, async (req, res) => {
    const { token } = parseInput(magicLinkVerifySchema, req.body);
    respondLogin(res, await verifyMagicLink(deps, token, req.ipHash));
  });

  // --- Senha -------------------------------------------------------------------------------
  r.post('/register', ipLimit, emailLimit, async (req, res) => {
    await register(deps, parseInput(registerSchema, req.body), req.ipHash);
    res.status(202).json({ ok: true });
  });

  r.post('/verify-email', ipLimit, async (req, res) => {
    const { token } = parseInput(emailTokenSchema, req.body);
    respondLogin(res, await verifyEmail(deps, token, req.ipHash));
  });

  r.post('/verify-email/resend', ipLimit, emailLimit, async (req, res) => {
    await resendVerification(deps, parseInput(emailRequestSchema, req.body));
    res.status(202).json({ ok: true });
  });

  r.post('/login', ipLimit, loginEmailLimit, async (req, res) => {
    respondLogin(res, await loginWithPassword(deps, parseInput(loginSchema, req.body), req.ipHash));
  });

  r.post('/password/forgot', ipLimit, emailLimit, async (req, res) => {
    await requestPasswordReset(deps, parseInput(emailRequestSchema, req.body), req.ipHash);
    res.status(202).json({ ok: true });
  });

  r.post('/password/reset', ipLimit, async (req, res) => {
    await resetPassword(deps, parseInput(resetPasswordSchema, req.body), req.ipHash);
    res.status(204).end();
  });

  r.post('/password/change', requireAuth, userMfaLimit, async (req, res) => {
    await changePassword(deps, authOf(req), parseInput(changePasswordSchema, req.body), req.ipHash);
    res.status(204).end();
  });

  r.post('/mfa/verify', ipLimit, async (req, res) => {
    const input = parseInput(mfaVerifySchema, req.body);
    const session = await verifyMfaChallenge(deps, input, req.ipHash);
    setSessionCookie(res, deps.config, session);
    res.json({ status: 'authenticated' } satisfies VerifyResult);
  });

  r.post('/logout', requireAuth, async (req, res) => {
    const auth = authOf(req);
    await deps.db.system(async (c) => {
      await c.query(
        `update private.sessions set revoked_at = now(), revoked_reason = 'logout'
          where id = $1 and revoked_at is null`,
        [auth.sessionId],
      );
      await audit(c, { actorId: auth.userId, action: 'auth.logout', ipHash: req.ipHash });
    });
    clearSessionCookie(res, deps.config);
    res.status(204).end();
  });

  r.post('/logout-all', requireAuth, async (req, res) => {
    const auth = authOf(req);
    await deps.db.system(async (c) => {
      const count = await revokeSessions(c, auth.userId, 'logout_all');
      await audit(c, {
        actorId: auth.userId,
        action: 'auth.logout_all',
        ipHash: req.ipHash,
        metadata: { count },
      });
    });
    clearSessionCookie(res, deps.config);
    res.status(204).end();
  });

  r.post('/mfa/setup', requireAuth, userMfaLimit, async (req, res) => {
    res.json(await startMfaSetup(deps, authOf(req).userId));
  });

  r.post('/mfa/enable', requireAuth, userMfaLimit, async (req, res) => {
    const { code } = parseInput(mfaCodeSchema, req.body);
    await enableMfa(deps, authOf(req), code, req.ipHash);
    res.status(204).end();
  });

  r.post('/mfa/disable', requireAuth, userMfaLimit, async (req, res) => {
    const { code } = parseInput(mfaCodeSchema, req.body);
    await disableMfa(deps, authOf(req), code, req.ipHash);
    res.status(204).end();
  });

  return r;
}
