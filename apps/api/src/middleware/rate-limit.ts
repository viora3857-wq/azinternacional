import type { RequestHandler } from 'express';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import { pseudonymize } from '../lib/crypto';
import { AppError } from '../lib/errors';

/**
 * Limites em memória do processo. Com mais de uma instância da API, troque o store por Redis
 * (express-rate-limit aceita `store`), senão cada instância conta separado.
 */
interface LimitOptions {
  windowMs: number;
  limit: number;
  key: 'ip' | 'user' | 'email';
  pepper: string;
  prefix: string;
}

export function limiter(opts: LimitOptions): RequestHandler {
  return rateLimit({
    windowMs: opts.windowMs,
    limit: opts.limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: (req) => {
      const ipKey = `ip:${ipKeyGenerator(req.ip ?? '0.0.0.0')}`;
      if (opts.key === 'user')
        return req.auth ? `${opts.prefix}:u:${req.auth.userId}` : `${opts.prefix}:${ipKey}`;
      if (opts.key === 'email') {
        const raw: unknown = req.body?.email;
        if (typeof raw !== 'string') return `${opts.prefix}:${ipKey}`;
        return `${opts.prefix}:e:${pseudonymize(raw.trim().toLowerCase(), opts.pepper)}`;
      }
      return `${opts.prefix}:${ipKey}`;
    },
    handler: (_req, _res, next) => next(new AppError('RATE_LIMITED')),
  });
}

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
