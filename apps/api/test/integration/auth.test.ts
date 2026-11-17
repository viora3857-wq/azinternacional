import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { JSON_BODY_LIMIT } from '../../src/app';
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

describe('magic link', () => {
  it('cria conta de aluno no primeiro acesso por e-mail de escola cadastrada', async () => {
    const email = uniqueStudentEmail();
    const { c, verify } = await login(ctx, email);
    expect(verify.status).toBe('authenticated');
    const me = await c.get('/api/me').expect(200);
    expect(me.body).toMatchObject({
      email,
      role: 'student',
      status: 'onboarding_required',
      mfaEnabled: false,
    });
    expect(me.body.school).toEqual({ id: SEED.schoolId, name: 'Colégio Demonstração' });
  });

  it('guarda só o hash do token e expira em 15 minutos', async () => {
    const email = uniqueStudentEmail();
    await client(ctx.app).post('/api/auth/magic-link', { email }).expect(202);
    const token = lastToken(ctx.outbox, email, 'magic_link');
    const { rows } = await ctx.pool.query(
      `select token_hash, extract(epoch from expires_at - created_at) as ttl
         from private.magic_link_tokens where email = $1`,
      [email],
    );
    expect(rows).toHaveLength(1);
    expect(Buffer.isBuffer(rows[0].token_hash)).toBe(true);
    expect(rows[0].token_hash.toString('base64url')).not.toBe(token);
    expect(Number(rows[0].ttl)).toBe(15 * 60);
  });

  it('é de uso único', async () => {
    const email = uniqueStudentEmail();
    const c = client(ctx.app);
    await c.post('/api/auth/magic-link', { email }).expect(202);
    const token = lastToken(ctx.outbox, email, 'magic_link');
    await c.post('/api/auth/magic-link/verify', { token }).expect(200);
    const again = await client(ctx.app).post('/api/auth/magic-link/verify', { token }).expect(400);
    expect(again.body.error.code).toBe('MAGIC_LINK_INVALID');
  });

  it('usos simultâneos: só um vence', async () => {
    const email = uniqueStudentEmail();
    await client(ctx.app).post('/api/auth/magic-link', { email }).expect(202);
    const token = lastToken(ctx.outbox, email, 'magic_link');
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        client(ctx.app).post('/api/auth/magic-link/verify', { token }),
      ),
    );
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
  });

  it('recusa link expirado', async () => {
    const email = uniqueStudentEmail();
    await client(ctx.app).post('/api/auth/magic-link', { email }).expect(202);
    const token = lastToken(ctx.outbox, email, 'magic_link');
    await ctx.pool.query(
      `update private.magic_link_tokens set created_at = now() - interval '20 minutes',
              expires_at = now() - interval '5 minutes' where email = $1`,
      [email],
    );
    const res = await client(ctx.app).post('/api/auth/magic-link/verify', { token }).expect(400);
    expect(res.body.error.code).toBe('MAGIC_LINK_INVALID');
  });

  it('link novo invalida o anterior', async () => {
    const email = uniqueStudentEmail();
    const c = client(ctx.app);
    await c.post('/api/auth/magic-link', { email }).expect(202);
    const first = lastToken(ctx.outbox, email, 'magic_link');
    await c.post('/api/auth/magic-link', { email }).expect(202);
    await c.post('/api/auth/magic-link/verify', { token: first }).expect(400);
  });

  it('domínio fora das escolas: mesma resposta, nenhum e-mail enviado, nada gravado', async () => {
    const email = 'alguem@gmail.example';
    const res = await client(ctx.app).post('/api/auth/magic-link', { email }).expect(202);
    expect(res.body).toEqual({ ok: true });
    expect(ctx.outbox.list(email)).toHaveLength(0);
    const { rowCount } = await ctx.pool.query(
      'select 1 from private.magic_link_tokens where email = $1',
      [email],
    );
    expect(rowCount).toBe(0);
  });

  it('owner de fora do domínio escolar entra porque já tem conta', async () => {
    const { c } = await login(ctx, SEED.owner);
    const me = await c.get('/api/me').expect(200);
    expect(me.body.role).toBe('owner');
  });

  it('conta desativada não recebe link', async () => {
    const email = uniqueStudentEmail();
    await login(ctx, email);
    await ctx.pool.query('update public.users set disabled_at = now() where email = $1', [email]);
    ctx.outbox.clear();
    await client(ctx.app).post('/api/auth/magic-link', { email }).expect(202);
    expect(ctx.outbox.list(email)).toHaveLength(0);
  });

  it('limita 5 pedidos por e-mail por hora', async () => {
    const email = uniqueStudentEmail();
    const c = client(ctx.app);
    for (let i = 0; i < 5; i++) await c.post('/api/auth/magic-link', { email }).expect(202);
    const res = await c.post('/api/auth/magic-link', { email }).expect(429);
    expect(res.body.error.code).toBe('RATE_LIMITED');
  });
});

describe('rate limit por IP', () => {
  it('bloqueia após o limite configurado nas rotas de auth', async () => {
    const strict = createTestCtx({ AUTH_RATE_LIMIT_PER_15MIN: '3' });
    try {
      const c = client(strict.app);
      for (let i = 0; i < 3; i++)
        await c.post('/api/auth/magic-link/verify', { token: 'x'.repeat(43) }).expect(400);
      const res = await c
        .post('/api/auth/magic-link/verify', { token: 'x'.repeat(43) })
        .expect(429);
      expect(res.body.error.code).toBe('RATE_LIMITED');
      expect(res.headers['ratelimit-policy'] ?? res.headers['ratelimit']).toBeTruthy();
    } finally {
      await strict.close();
    }
  });
});

describe('sessão', () => {
  it('sem cookie: 401', async () => {
    const res = await client(ctx.app).get('/api/me').expect(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('cookie é HttpOnly e SameSite=Lax', async () => {
    const email = uniqueStudentEmail();
    const c = client(ctx.app);
    await c.post('/api/auth/magic-link', { email });
    const token = lastToken(ctx.outbox, email, 'magic_link');
    const res = await c.post('/api/auth/magic-link/verify', { token }).expect(200);
    const cookie = String(res.headers['set-cookie']);
    expect(cookie).toMatch(/az_session=/);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Lax/);
  });

  it('logout invalida a sessão no servidor', async () => {
    const { c, cookie } = await login(ctx, uniqueStudentEmail());
    expect(cookie).toMatch(/^[A-Za-z0-9_-]{43}$/);
    await client(ctx.app).agent.get('/api/me').set('Cookie', `az_session=${cookie}`).expect(200);
    await c.post('/api/auth/logout').expect(204);
    await c.get('/api/me').expect(401);
    // Mesmo reapresentando o cookie antigo, a sessão está revogada no servidor.
    await client(ctx.app).agent.get('/api/me').set('Cookie', `az_session=${cookie}`).expect(401);
  });

  it('logout-all derruba todas as sessões', async () => {
    const email = uniqueStudentEmail();
    const a = await login(ctx, email);
    const b = await login(ctx, email);
    await a.c.post('/api/auth/logout-all').expect(204);
    await b.c.get('/api/me').expect(401);
  });
});

describe('proteções gerais', () => {
  it('rejeita POST sem Origin do app (CSRF)', async () => {
    const res = await client(ctx.app)
      .agent.post('/api/auth/magic-link')
      .set('Origin', 'https://evil.example')
      .send({ email: uniqueStudentEmail() })
      .expect(403);
    expect(res.body.error.code).toBe('CSRF_REJECTED');
  });

  it('valida entrada e devolve só os nomes dos campos', async () => {
    const res = await client(ctx.app)
      .post('/api/auth/magic-link', { email: 'nao-e-email' })
      .expect(400);
    expect(res.body.error).toMatchObject({ code: 'VALIDATION_FAILED', fields: ['email'] });
    expect(JSON.stringify(res.body)).not.toContain('nao-e-email');
  });

  it('JSON malformado: 400', async () => {
    const res = await client(ctx.app)
      .agent.post('/api/auth/magic-link')
      .set('Origin', 'http://localhost:5173')
      .set('Content-Type', 'application/json')
      .send('{"email":')
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });

  it(`corpo acima de ${JSON_BODY_LIMIT}: 413`, async () => {
    const res = await client(ctx.app)
      .post('/api/auth/magic-link', { email: 'a@escola.example', pad: 'x'.repeat(70 * 1024) })
      .expect(413);
    expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('rota inexistente: 404 com código, sem stack', async () => {
    const res = await client(ctx.app).get('/api/nao-existe').expect(404);
    expect(res.body).toMatchObject({ error: { code: 'NOT_FOUND' } });
    expect(res.headers['x-request-id']).toBeTruthy();
  });

  it('cabeçalhos de segurança do helmet', async () => {
    const res = await client(ctx.app).get('/api/health').expect(200);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-security-policy']).toBeTruthy();
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('auditoria registra login sem e-mail nem token', async () => {
    const email = uniqueStudentEmail();
    await login(ctx, email);
    const { rows } = await ctx.pool.query(
      `select a.action, a.metadata::text, a.ip_hash from private.audit_logs a
         join public.users u on u.id = a.actor_id where u.email = $1 order by a.id`,
      [email],
    );
    expect(rows.map((r) => r.action)).toEqual(['account.created', 'auth.login']);
    for (const r of rows) {
      expect(r.metadata).not.toContain('@');
      expect(r.ip_hash).not.toMatch(/\d+\.\d+\.\d+\.\d+/);
    }
  });
});
