import type { RequestHandler } from 'express';
import { AppError } from '../lib/errors';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Proteção CSRF: toda requisição que altera estado precisa vir da origem do app.
 * Complementa o cookie SameSite=Lax. Navegadores sempre enviam Origin em POST/PATCH/DELETE via fetch.
 */
export function requireSameOrigin(appOrigin: string): RequestHandler {
  return (req, _res, next) => {
    if (SAFE_METHODS.has(req.method)) return next();
    if (req.get('origin') !== appOrigin) return next(new AppError('CSRF_REJECTED'));
    next();
  };
}
