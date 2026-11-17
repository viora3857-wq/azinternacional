import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { totp } from '../../src/lib/totp';
import {
  client,
  createTestCtx,
  lastToken,
  login,
  uniqueStudentEmail,
  type TestCtx,
} from './helpers';

let ctx: TestCtx;
beforeAll(() => {
  ctx = createTestCtx();
});
afterAll(() => ctx.close());

/** Ativa 2FA e devolve o segredo. */
async function enable(c: Awaited<ReturnType<typeof login>>['c']) {
  const setup = await c.post('/api/auth/mfa/setup').expect(200);
  const secret: string = setup.body.secret;
  expect(setup.body.otpauthUri).toContain(`secret=${secret}`);
  await c.post('/api/auth/mfa/enable', { code: totp(secret, Date.now()) }).expect(204);
  return secret;
}

async function startLogin(email: string) {
  const c = client(ctx.app);
  await c.post('/api/auth/magic-link', { email }).expect(202);
  const token = lastToken(ctx.outbox, email, 'magic_link');
  const res = await c.post('/api/auth/magic-link/verify', { token }).expect(200);
  return { c, res };
}

/** Código de um passo diferente do último usado (anti-replay exige código novo). */
function freshCode(secret: string, offsetSteps: number) {
  return totp(secret, Date.now() + offsetSteps * 30_000);
}

describe('2FA (TOTP)', () => {
  it('segredo fica cifrado no banco', async () => {
    const email = uniqueStudentEmail();
    const { c } = await login(ctx, email);
    const secret = await enable(c);
    const { rows } = await ctx.pool.query(
      `select m.secret_enc from private.user_mfa m join public.users u on u.id = m.user_id where u.email = $1`,
      [email],
    );
    expect(rows[0].secret_enc).toMatch(/^v1\./);
    expect(rows[0].secret_enc).not.toContain(secret);
    expect((await c.get('/api/me')).body.mfaEnabled).toBe(true);
  });

  it('não ativa com código errado nem sem setup', async () => {
    const { c } = await login(ctx, uniqueStudentEmail());
    const noSetup = await c.post('/api/auth/mfa/enable', { code: '123456' }).expect(400);
    expect(noSetup.body.error.code).toBe('MFA_SETUP_NOT_STARTED');
    await c.post('/api/auth/mfa/setup').expect(200);
    const wrong = await c.post('/api/auth/mfa/enable', { code: '000000' }).expect(400);
    expect(wrong.body.error.code).toBe('MFA_INVALID_CODE');
  });

  it('login com 2FA exige código; sem ele não há sessão', async () => {
    const email = uniqueStudentEmail();
    const secret = await enable((await login(ctx, email)).c);

    const { c, res } = await startLogin(email);
    expect(res.body.status).toBe('mfa_required');
    expect(res.headers['set-cookie']).toBeUndefined();
    await c.get('/api/me').expect(401);

    await c
      .post('/api/auth/mfa/verify', { challenge: res.body.challenge, code: freshCode(secret, 1) })
      .expect(200);
    await c.get('/api/me').expect(200);
  });

  it('bloqueia reuso do mesmo código (replay)', async () => {
    const email = uniqueStudentEmail();
    const secret = await enable((await login(ctx, email)).c);
    const code = freshCode(secret, 1);

    const first = await startLogin(email);
    await first.c
      .post('/api/auth/mfa/verify', { challenge: first.res.body.challenge, code })
      .expect(200);

    const second = await startLogin(email);
    const replay = await second.c
      .post('/api/auth/mfa/verify', { challenge: second.res.body.challenge, code })
      .expect(400);
    expect(replay.body.error.code).toBe('MFA_INVALID_CODE');
  });

  it('desafio morre após 5 códigos errados, mesmo que o 6º esteja certo', async () => {
    const email = uniqueStudentEmail();
    const secret = await enable((await login(ctx, email)).c);
    const { c, res } = await startLogin(email);
    const challenge = res.body.challenge;
    for (let i = 0; i < 5; i++) {
      const r = await c.post('/api/auth/mfa/verify', { challenge, code: '000000' }).expect(400);
      expect(r.body.error.code).toBe('MFA_INVALID_CODE');
    }
    const locked = await c
      .post('/api/auth/mfa/verify', { challenge, code: freshCode(secret, 1) })
      .expect(400);
    expect(locked.body.error.code).toBe('MFA_CHALLENGE_INVALID');
  });

  it('ativar 2FA derruba as outras sessões, mantém a atual', async () => {
    const email = uniqueStudentEmail();
    const a = await login(ctx, email);
    const b = await login(ctx, email);
    await enable(a.c);
    await a.c.get('/api/me').expect(200);
    await b.c.get('/api/me').expect(401);
  });

  it('desativar exige código válido', async () => {
    const email = uniqueStudentEmail();
    const { c } = await login(ctx, email);
    const secret = await enable(c);
    await c.post('/api/auth/mfa/disable', { code: '000000' }).expect(400);
    await c.post('/api/auth/mfa/disable', { code: freshCode(secret, 1) }).expect(204);
    expect((await c.get('/api/me')).body.mfaEnabled).toBe(false);
    const { res } = await startLogin(email);
    expect(res.body.status).toBe('authenticated');
  });
});
