import type { Logger } from 'pino';
import type { Config } from './config/env';
import type { Database } from './db/database';
import type { EmailProvider } from './modules/email/email.types';

export interface AppDeps {
  config: Config;
  db: Database;
  email: EmailProvider;
  logger: Logger;
}
