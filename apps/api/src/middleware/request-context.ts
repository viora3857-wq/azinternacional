import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';
import { pseudonymize } from '../lib/crypto';

export function requestContext(pepper: string): RequestHandler {
  return (req, res, next) => {
    req.requestId = randomUUID();
    req.ipHash = req.ip ? pseudonymize(req.ip, pepper) : null;
    res.setHeader('X-Request-Id', req.requestId);
    next();
  };
}
