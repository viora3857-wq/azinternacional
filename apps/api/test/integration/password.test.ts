import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { totp } from '../../src/lib/totp';
import {
  client,
  createTestCtx,
  lastToken,
  login,
  SEED,
  uniqueStudentEmail,
  type TestCtx,
} from './helpers';

let ctx: TestCtx;
beforeAll(() => {
  ctx = createTestCtx();
});
afterAll(() => ctx.close());

const PASSWORD = 'senha-forte-de-teste';

/** Cadastra, confirma o e-mail e devolve o cliente já logado. */
async function registerAndVerify(email: string, password = PASSWORD) {
  const c = client(ctx.app);
  await c.post('/api/auth/register', { email, password }).expect(202);
  const token = lastToken(ctx.outbox, email, 'verify_email');
  const res = await c.post('/api/auth/verify-email', { token }).expect(200);
  expect(res.body.status).toBe('authenticated');
  return c;
}

describe('cadastro com senha + confirmação de e-mail', () => {
  it('cria conta não confirmada, guarda só o hash e envia link de 24 h', async () => {
    const email = uniqueStudentEmail();
    await client(ctx.app).post('/api/auth/register', { email, password: PASSWORD }).expect(202);
    const { rows } = await ctx.pool.query(
      `select u.email_verified_at, cr.password_hash, extract(epoch from t.expires_at - t.created_at) as ttl
         from public.users u
         join private.user_credentials cr on cr.user_id = u.id
         join private.email_tokens t on t.user_id = u.id and t.purpose = 'verify_email'
        where u.email = $1`,
      [email],
    );
    expect(rows[0].email_verified_at).toBeNull();
    expect(rows[0].password_hash).toMatch(/^scrypt\$/);
    expect(rows[0].password_hash).not.toContain(PASSWORD);
    expect(Number(rows[0].ttl)).toBe(24 * 3600);
  });

  it('login antes de confirmar: EMAIL_NOT_VERIFIED (só com a senha certa)', async () => {
    const email = uniqueStudentEmail();
    await client(ctx.app).post('/api/auth/register', { email, password: PASSWORD }).expect(202);
    const res = await client(ctx.app)
      .post('/api/auth/login', { email, password: PASSWORD })
      .expect(403);
    expect(res.body.error.code).toBe('EMAIL_NOT_VERIFIED');
    const wrong = await client(ctx.app)
      .post('/api/auth/login', { email, password: 'errada-123456' })
      .expect(401);
    expect(wrong.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('confirmar o e-mail já abre a sessão; link é de uso único', async () => {
    const email = uniqueStudentEmail();
    const c = client(ctx.app);
    await c.post('/api/auth/register', { email, password: PASSWORD }).expect(202);
    const token = lastToken(ctx.outbox, email, 'verify_email');
    await c.post('/api/auth/verify-email', { token }).expect(200);
    expect((await c.get('/api/me').expect(200)).body).toMatchObject({ email, hasPassword: true });
    const again = await client(ctx.app).post('/api/auth/verify-email', { token }).expect(400);
    expect(again.body.error.code).toBe('EMAIL_TOKEN_INVALID');
  });

  it('reenviar confirmação invalida o link anterior', async () => {
    const email = uniqueStudentEmail();
    await client(ctx.app).post('/api/auth/register', { email, password: PASSWORD }).expect(202);
    const first = lastToken(ctx.outbox, email, 'verify_email');
    await client(ctx.app).post('/api/auth/verify-email/resend', { email }).expect(202);
    await client(ctx.app).post('/api/auth/verify-email', { token: first }).expect(400);
    await client(ctx.app)
      .post('/api/auth/verify-email', { token: lastToken(ctx.outbox, email, 'verify_email') })
      .expect(200);
  });

  it('não revela contas: e-mail já confirmado ou de fora das escolas recebe a mesma resposta e nenhum e-mail', async () => {
    ctx.outbox.clear();
    await client(ctx.app)
      .post('/api/auth/register', { email: SEED.student, password: PASSWORD })
      .expect(202);
    await client(ctx.app)
      .post('/api/auth/register', { email: 'x@gmail.example', password: PASSWORD })
      .expect(202);
    expect(ctx.outbox.list()).toHaveLength(0);
    // E o cadastro não sobrescreve a senha de conta já confirmada.
    const { rowCount } = await ctx.pool.query(
      `select 1 from private.user_credentials where user_id = $1`,
      [SEED.studentId],
    );
    expect(rowCount).toBe(0);
  });

  it('recusa senha curta, informando só o campo', async () => {
    const res = await client(ctx.app)
      .post('/api/auth/register', { email: uniqueStudentEmail(), password: 'curta' })
      .expect(400);
    expect(res.body.error).toMatchObject({ code: 'VALIDATION_FAILED', fields: ['password'] });
    expect(JSON.stringify(res.body)).not.toContain('curta');
  });
});

describe('login com senha', () => {
  it('senha certa abre sessão; errada e e-mail inexistente dão o mesmo erro', async () => {
    const email = uniqueStudentEmail();
    await registerAndVerify(email);
    const c = client(ctx.app);
    await c.post('/api/auth/login', { email, password: PASSWORD }).expect(200);
    await c.get('/api/me').expect(200);

    const wrong = await client(ctx.app)
      .post('/api/auth/login', { email, password: 'errada-1234567' })
      .expect(401);
    const ghost = await client(ctx.app)
      .post('/api/auth/login', { email: 'ninguem@escola.example', password: PASSWORD })
      .expect(401);
    expect(wrong.body.error.code).toBe('INVALID_CREDENTIALS');
    expect(ghost.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('com 2FA ativo, a senha certa ainda exige o código', async () => {
    const email = uniqueStudentEmail();
    const c = await registerAndVerify(email);
    const { secret } = (await c.post('/api/auth/mfa/setup').expect(200)).body;
    await c.post('/api/auth/mfa/enable', { code: totp(secret, Date.now()) }).expect(204);

    const res = await client(ctx.app)
      .post('/api/auth/login', { email, password: PASSWORD })
      .expect(200);
    expect(res.body.status).toBe('mfa_required');
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('bloqueia força bruta: 10 tentativas por e-mail a cada 15 min', async () => {
    const email = uniqueStudentEmail();
    await registerAndVerify(email);
    for (let i = 0; i < 10; i++) {
      await client(ctx.app)
        .post('/api/auth/login', { email, password: `errada-${i}-xxxxx` })
        .expect(401);
    }
    // Nem a senha certa passa enquanto o limite estiver estourado.
    const res = await client(ctx.app)
      .post('/api/auth/login', { email, password: PASSWORD })
      .expect(429);
    expect(res.body.error.code).toBe('RATE_LIMITED');
  });

  it('falhas ficam na auditoria sem a senha', async () => {
    const email = uniqueStudentEmail();
    await registerAndVerify(email);
    await client(ctx.app)
      .post('/api/auth/login', { email, password: 'tentativa-errada-x' })
      .expect(401);
    const { rows } = await ctx.pool.query(
      `select a.metadata::text from private.audit_logs a join public.users u on u.id = a.actor_id
        where u.email = $1 and a.action = 'auth.login_failed'`,
      [email],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].metadata).not.toContain('tentativa');
  });
});

describe('recuperação de senha', () => {
  it('fluxo completo: pede, redefine, derruba sessões antigas, entra com a nova', async () => {
    const email = uniqueStudentEmail();
    const old = await registerAndVerify(email);

    await client(ctx.app).post('/api/auth/password/forgot', { email }).expect(202);
    const token = lastToken(ctx.outbox, email, 'password_reset');
    const { rows } = await ctx.pool.query(
      `select extract(epoch from t.expires_at - t.created_at) as ttl from private.email_tokens t
         join public.users u on u.id = t.user_id where u.email = $1 and t.purpose = 'password_reset'`,
      [email],
    );
    expect(Number(rows[0].ttl)).toBe(30 * 60);

    await client(ctx.app)
      .post('/api/auth/password/reset', { token, password: 'nova-senha-segura' })
      .expect(204);
    await old.get('/api/me').expect(401);
    await client(ctx.app).post('/api/auth/login', { email, password: PASSWORD }).expect(401);
    await client(ctx.app)
      .post('/api/auth/login', { email, password: 'nova-senha-segura' })
      .expect(200);

    // Uso único.
    const again = await client(ctx.app)
      .post('/api/auth/password/reset', { token, password: 'outra-senha-xyz' })
      .expect(400);
    expect(again.body.error.code).toBe('EMAIL_TOKEN_INVALID');
  });

  it('link expirado é recusado', async () => {
    const email = uniqueStudentEmail();
    await registerAndVerify(email);
    await client(ctx.app).post('/api/auth/password/forgot', { email }).expect(202);
    const token = lastToken(ctx.outbox, email, 'password_reset');
    await ctx.pool.query(
      `update private.email_tokens t set created_at = now() - interval '2 hours', expires_at = now() - interval '1 minute'
         from public.users u where u.id = t.user_id and u.email = $1`,
      [email],
    );
    await client(ctx.app)
      .post('/api/auth/password/reset', { token, password: 'nova-senha-segura' })
      .expect(400);
  });

  it('conta sem senha (criada por magic link) define senha pela recuperação', async () => {
    ctx.outbox.clear();
    await client(ctx.app).post('/api/auth/password/forgot', { email: SEED.admin }).expect(202);
    const token = lastToken(ctx.outbox, SEED.admin, 'password_reset');
    await client(ctx.app)
      .post('/api/auth/password/reset', { token, password: 'admin-senha-forte' })
      .expect(204);
    await client(ctx.app)
      .post('/api/auth/login', { email: SEED.admin, password: 'admin-senha-forte' })
      .expect(200);
  });

  it('e-mail desconhecido: mesma resposta, nenhum e-mail', async () => {
    ctx.outbox.clear();
    await client(ctx.app)
      .post('/api/auth/password/forgot', { email: 'ninguem@escola.example' })
      .expect(202);
    expect(ctx.outbox.list()).toHaveLength(0);
  });
});

describe('troca de senha logado', () => {
  it('exige a senha atual e derruba as outras sessões', async () => {
    const email = uniqueStudentEmail();
    const a = await registerAndVerify(email);
    const b = client(ctx.app);
    await b.post('/api/auth/login', { email, password: PASSWORD }).expect(200);

    const bad = await a
      .post('/api/auth/password/change', {
        currentPassword: 'nao-e-essa-xx',
        newPassword: 'nova-senha-123',
      })
      .expect(400);
    expect(bad.body.error.code).toBe('CURRENT_PASSWORD_INVALID');

    await a
      .post('/api/auth/password/change', {
        currentPassword: PASSWORD,
        newPassword: 'nova-senha-123',
      })
      .expect(204);
    await a.get('/api/me').expect(200);
    await b.get('/api/me').expect(401);
  });

  it('quem ainda não tem senha define sem senha atual', async () => {
    const email = uniqueStudentEmail();
    const { c } = await login(ctx, email);
    expect((await c.get('/api/me')).body.hasPassword).toBe(false);
    await c.post('/api/auth/password/change', { newPassword: 'primeira-senha-1' }).expect(204);
    expect((await c.get('/api/me')).body.hasPassword).toBe(true);
  });
});
