import { Router } from 'express';
import type { DevOutboxProvider } from '../email/dev.provider';

/** SOMENTE DESENVOLVIMENTO/TESTE. Montado apenas com EMAIL_PROVIDER=dev fora de produção. */
export function devRouter(outbox: DevOutboxProvider): Router {
  const r = Router();
  r.get('/outbox', (req, res) => {
    const to = typeof req.query.to === 'string' ? req.query.to.toLowerCase() : undefined;
    res.json({ messages: outbox.list(to) });
  });
  r.delete('/outbox', (_req, res) => {
    outbox.clear();
    res.status(204).end();
  });
  return r;
}
