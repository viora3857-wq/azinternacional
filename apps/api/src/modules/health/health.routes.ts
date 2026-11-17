import { Router } from 'express';
import type { AppDeps } from '../../deps';

export function healthRouter(deps: AppDeps): Router {
  const r = Router();
  // `version` = commit em produção (o Render define RENDER_GIT_COMMIT). O deploy espera por ele.
  const version = process.env.RENDER_GIT_COMMIT ?? 'dev';
  r.get('/', (_req, res) => {
    res.json({ status: 'ok', version });
  });
  r.get('/ready', async (_req, res) => {
    try {
      await deps.db.ping();
      res.json({ status: 'ready' });
    } catch (err) {
      deps.logger.error({ err }, 'readiness: banco indisponível');
      res.status(503).json({ status: 'unavailable' });
    }
  });
  return r;
}
