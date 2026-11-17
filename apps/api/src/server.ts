import { loadConfig } from './config/env';
import { createApp } from './app';
import { createPool, Database } from './db/database';
import { createLogger } from './lib/logger';
import { BrevoProvider } from './modules/email/brevo.provider';
import { DevOutboxProvider } from './modules/email/dev.provider';
import type { EmailProvider } from './modules/email/email.types';

const config = loadConfig();
const logger = createLogger(config.LOG_LEVEL);
const pool = createPool({
  connectionString: config.DATABASE_URL,
  ssl: config.DATABASE_SSL,
  max: config.DATABASE_POOL_MAX,
});
pool.on('error', (err) => logger.error({ err }, 'erro em conexão ociosa do pool'));

const email: EmailProvider =
  config.EMAIL_PROVIDER === 'brevo'
    ? new BrevoProvider({
        apiKey: config.BREVO_API_KEY!,
        fromAddress: config.EMAIL_FROM_ADDRESS,
        fromName: config.EMAIL_FROM_NAME,
      })
    : new DevOutboxProvider(logger);

if (email instanceof DevOutboxProvider) {
  logger.warn(
    'EMAIL_PROVIDER=dev: nenhum e-mail real é enviado. Links ficam em GET /api/dev/outbox.',
  );
}

const app = createApp({ config, db: new Database(pool), email, logger });
const server = app.listen(config.PORT, () => logger.info({ port: config.PORT }, 'API no ar'));

function shutdown(signal: string) {
  logger.info({ signal }, 'encerrando');
  server.close(() => {
    pool.end().finally(() => process.exit(0));
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
