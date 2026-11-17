import { z } from 'zod';

const base64Key32 = z
  .string()
  .refine((v) => Buffer.from(v, 'base64').length === 32, 'deve ser 32 bytes em base64');

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    /** Origem pública do front-end. Usada nos links de e-mail e na checagem de Origin (CSRF). */
    APP_URL: z.url(),
    /** Saltos de proxy confiáveis (Cloudflare + plataforma). Define de onde vem o IP real. */
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),

    DATABASE_URL: z.string().min(1),
    DATABASE_SSL: z.enum(['disable', 'require']).default('disable'),
    DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(50).default(10),

    /** Pedidos às rotas públicas de auth/consentimento por IP a cada 15 min. */
    AUTH_RATE_LIMIT_PER_15MIN: z.coerce.number().int().min(1).default(30),

    SESSION_TTL_HOURS: z.coerce
      .number()
      .int()
      .min(1)
      .max(24 * 30)
      .default(24 * 7),
    DATA_ENCRYPTION_KEY: base64Key32,
    HASH_PEPPER: z.string().min(32),

    EMAIL_PROVIDER: z.enum(['brevo', 'dev']),
    BREVO_API_KEY: z.string().min(1).optional(),
    EMAIL_FROM_ADDRESS: z.email(),
    EMAIL_FROM_NAME: z.string().min(1).default('AZ Internacional'),
  })
  .superRefine((env, ctx) => {
    if (env.EMAIL_PROVIDER === 'brevo' && !env.BREVO_API_KEY) {
      ctx.addIssue({
        code: 'custom',
        path: ['BREVO_API_KEY'],
        message: 'obrigatória com EMAIL_PROVIDER=brevo',
      });
    }
    if (env.NODE_ENV === 'production') {
      if (env.EMAIL_PROVIDER === 'dev') {
        ctx.addIssue({
          code: 'custom',
          path: ['EMAIL_PROVIDER'],
          message: '"dev" é proibido em produção',
        });
      }
      if (!env.APP_URL.startsWith('https://')) {
        ctx.addIssue({ code: 'custom', path: ['APP_URL'], message: 'deve ser https em produção' });
      }
      if (env.DATABASE_SSL !== 'require') {
        ctx.addIssue({
          code: 'custom',
          path: ['DATABASE_SSL'],
          message: 'deve ser "require" em produção',
        });
      }
    }
  });

export type Env = z.infer<typeof envSchema>;

export interface Config extends Env {
  appOrigin: string;
  isProduction: boolean;
  encryptionKey: Buffer;
  sessionCookieName: string;
}

export class ConfigError extends Error {}

export function loadConfig(source: NodeJS.ProcessEnv = process.env): Config {
  // Linha "CHAVE=" sem valor no .env equivale a não definida (senão opcionais vazias falham na validação).
  const defined = Object.fromEntries(
    Object.entries(source).filter(([, v]) => v !== undefined && v !== ''),
  );
  const parsed = envSchema.safeParse(defined);
  if (!parsed.success) {
    // Lista só nomes e motivos; nunca os valores (podem ser segredos).
    const problems = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new ConfigError(`Configuração inválida: ${problems}`);
  }
  const env = parsed.data;
  const isProduction = env.NODE_ENV === 'production';
  return {
    ...env,
    appOrigin: new URL(env.APP_URL).origin,
    isProduction,
    encryptionKey: Buffer.from(env.DATA_ENCRYPTION_KEY, 'base64'),
    // __Host- exige Secure, Path=/ e sem Domain: o cookie não vaza para subdomínios.
    sessionCookieName: isProduction ? '__Host-az_session' : 'az_session',
  };
}
