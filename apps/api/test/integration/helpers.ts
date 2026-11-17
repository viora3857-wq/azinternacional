import { randomBytes, randomUUID } from 'node:crypto';
import type { Express } from 'express';
import pg from 'pg';
import { pino } from 'pino';
import request from 'supertest';
import { createApp } from '../../src/app';
import { loadConfig, type Config } from '../../src/config/env';
import { Database } from '../../src/db/database';
import { DevOutboxProvider } from '../../src/modules/email/dev.provider';

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/az_test';

export const ORIGIN = 'http://localhost:5173';

export const SEED = {
  schoolId: '00000000-0000-4000-8000-000000000001',
  ownerId: '00000000-0000-4000-8000-000000000010',
  adminId: '00000000-0000-4000-8000-000000000011',
  studentId: '00000000-0000-4000-8000-000000000012',
  owner: 'owner@az.example',
  admin: 'admin@escola.example',
  student: 'aluno@escola.example',
} as const;

export interface TestCtx {
  app: Express;
  pool: pg.Pool;
  outbox: DevOutboxProvider;
  config: Config;
  close: () => Promise<void>;
}

export function createTestCtx(overrides: Record<string, string> = {}): TestCtx {
  const config = loadConfig({
    NODE_ENV: 'test',
    APP_URL: ORIGIN,
    DATABASE_URL: TEST_DATABASE_URL,
    DATA_ENCRYPTION_KEY: randomBytes(32).toString('base64'),
    HASH_PEPPER: 'test-pepper-'.padEnd(40, 'x'),
    EMAIL_PROVIDER: 'dev',
    EMAIL_FROM_ADDRESS: 'no-reply@az.example',
    LOG_LEVEL: 'silent',
    AUTH_RATE_LIMIT_PER_15MIN: '10000',
    ...overrides,
  });
  const pool = new pg.Pool({ connectionString: TEST_DATABASE_URL, max: 5 });
  const outbox = new DevOutboxProvider();
  const app = createApp({
    config,
    db: new Database(pool),
    email: outbox,
    logger: pino({ level: 'silent' }),
  });
  return { app, pool, outbox, config, close: () => pool.end() };
}

export function uniqueStudentEmail(): string {
  return `aluno-${randomUUID().slice(0, 8)}@escola.example`;
}

/** Agente com cookies persistentes e cabeçalho Origin do app em toda requisição. */
export function client(app: Express) {
  const agent = request.agent(app);
  return {
    agent,
    get: (path: string) => agent.get(path),
    post: (path: string, body?: object) =>
      agent
        .post(path)
        .set('Origin', ORIGIN)
        .send(body ?? {}),
    patch: (path: string, body?: object) =>
      agent
        .patch(path)
        .set('Origin', ORIGIN)
        .send(body ?? {}),
  };
}

export function lastToken(
  outbox: DevOutboxProvider,
  to: string,
  tag: 'magic_link' | 'verify_email' | 'password_reset',
): string {
  const msg = outbox.list(to).find((m) => m.tag === tag);
  if (!msg) throw new Error(`nenhum e-mail ${tag} para ${to}`);
  const match = /#token=([A-Za-z0-9_-]{43})/.exec(msg.text);
  if (!match?.[1]) throw new Error('token não encontrado no e-mail');
  return match[1];
}

/** Faz login completo por magic link (sem 2FA) e devolve o cliente autenticado. */
export async function login(ctx: TestCtx, email: string) {
  const c = client(ctx.app);
  await c.post('/api/auth/magic-link', { email }).expect(202);
  const token = lastToken(ctx.outbox, email, 'magic_link');
  const res = await c.post('/api/auth/magic-link/verify', { token }).expect(200);
  const cookie = /az_session=([^;]+)/.exec(String(res.headers['set-cookie'] ?? ''))?.[1] ?? null;
  return { c, cookie, verify: res.body as { status: string; challenge?: string } };
}

export async function onboardAdult(c: ReturnType<typeof client>, name = 'Aluno Teste') {
  await c
    .post('/api/account/onboarding', {
      displayName: name,
      locale: 'pt',
      acceptTerms: true,
      acceptPrivacy: true,
    })
    .expect(204);
}
