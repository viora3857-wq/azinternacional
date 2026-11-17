import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import type { AppDeps } from './deps';
import { loadSession } from './middleware/auth';
import { errorHandler, notFound } from './middleware/error-handler';
import { requireSameOrigin } from './middleware/origin';
import { limiter, MINUTE } from './middleware/rate-limit';
import { requestContext } from './middleware/request-context';
import { accountRouter } from './modules/account/account.routes';
import { adminRouter } from './modules/admin/admin.routes';
import { authRouter } from './modules/auth/auth.routes';
import { devRouter } from './modules/dev/dev.routes';
import { DevOutboxProvider } from './modules/email/dev.provider';
import { healthRouter } from './modules/health/health.routes';

export const JSON_BODY_LIMIT = '64kb';

export function createApp(deps: AppDeps): express.Express {
  const { config, logger } = deps;
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', config.TRUST_PROXY_HOPS);

  app.use(helmet());
  app.use(requestContext(config.HASH_PEPPER));
  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => (req as express.Request).requestId,
      // Sem IP, cabeçalhos ou query string nos logs.
      serializers: {
        req: (req: { method: string; url: string }) => ({
          method: req.method,
          path: req.url.split('?')[0],
        }),
        res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
      },
      autoLogging: { ignore: (req) => req.url?.startsWith('/api/health') ?? false },
    }),
  );
  app.use(express.json({ limit: JSON_BODY_LIMIT }));
  app.use(cookieParser());

  const api = express.Router();
  api.use(
    limiter({
      windowMs: MINUTE,
      limit: 300,
      key: 'ip',
      pepper: config.HASH_PEPPER,
      prefix: 'global',
    }),
  );
  api.use('/health', healthRouter(deps));
  api.use(requireSameOrigin(config.appOrigin));
  api.use(loadSession(deps));
  api.use('/auth', authRouter(deps));
  api.use('/admin', adminRouter(deps));
  if (!config.isProduction && deps.email instanceof DevOutboxProvider) {
    api.use('/dev', devRouter(deps.email));
  }
  api.use(accountRouter(deps));

  app.use('/api', api);
  app.use(notFound);
  app.use(errorHandler(logger));
  return app;
}
