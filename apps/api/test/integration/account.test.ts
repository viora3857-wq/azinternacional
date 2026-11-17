import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createTestCtx,
  login,
  onboardAdult,
  SEED,
  uniqueStudentEmail,
  type TestCtx,
} from './helpers';

let ctx: TestCtx;
beforeAll(() => {
  ctx = createTestCtx();
});
afterAll(() => ctx.close());

describe('perfil', () => {
  it('altera nome e idioma', async () => {
    const { c } = await login(ctx, uniqueStudentEmail());
    await onboardAdult(c);
    await c.patch('/api/account/profile', { displayName: 'Novo Nome', locale: 'es' }).expect(204);
    expect((await c.get('/api/me')).body).toMatchObject({ displayName: 'Novo Nome', locale: 'es' });
  });

  it('ignora tentativa de mudar papel pelo corpo da requisição', async () => {
    const { c } = await login(ctx, uniqueStudentEmail());
    await onboardAdult(c);
    await c.patch('/api/account/profile', { displayName: 'Nome Ok', role: 'owner' }).expect(204);
    expect((await c.get('/api/me')).body.role).toBe('student');
  });
});

describe('excluir conta (LGPD)', () => {
  it('exige confirmar o próprio e-mail', async () => {
    const { c } = await login(ctx, uniqueStudentEmail());
    const res = await c
      .post('/api/account/delete', { confirmEmail: 'outro@escola.example' })
      .expect(400);
    expect(res.body.error.code).toBe('ACCOUNT_CONFIRMATION_MISMATCH');
  });

  it('apaga conta, sessões, consentimentos e tokens; auditoria fica sem vínculo', async () => {
    const email = uniqueStudentEmail();
    const { c } = await login(ctx, email);
    await onboardAdult(c);
    const userId = (await c.get('/api/me')).body.id as string;
    await c.post('/api/auth/mfa/setup').expect(200);

    await c.post('/api/account/delete', { confirmEmail: email }).expect(204);
    await c.get('/api/me').expect(401);

    const counts = await ctx.pool.query(
      `select
         (select count(*) from public.users where id = $1)::int as users,
         (select count(*) from public.consents where user_id = $1)::int as consents,
         (select count(*) from private.sessions where user_id = $1)::int as sessions,
         (select count(*) from private.user_mfa where user_id = $1)::int as mfa,
         (select count(*) from private.magic_link_tokens where email = $2)::int as tokens,
         (select count(*) from private.audit_logs where actor_id = $1)::int as audit_linked`,
      [userId, email],
    );
    expect(counts.rows[0]).toEqual({
      users: 0,
      consents: 0,
      sessions: 0,
      mfa: 0,
      tokens: 0,
      audit_linked: 0,
    });

    const deleted = await ctx.pool.query(
      `select actor_id from private.audit_logs where action = 'account.deleted' and target_id = $1`,
      [userId],
    );
    expect(deleted.rows).toEqual([{ actor_id: null }]);
  });

  it('o único owner não pode se excluir', async () => {
    const { c } = await login(ctx, SEED.owner);
    const res = await c.post('/api/account/delete', { confirmEmail: SEED.owner }).expect(400);
    expect(res.body.error.code).toBe('LAST_OWNER');
  });
});
