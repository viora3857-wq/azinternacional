import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestCtx, login, onboardAdult, uniqueStudentEmail, type TestCtx } from './helpers';

let ctx: TestCtx;
beforeAll(() => {
  ctx = createTestCtx();
});
afterAll(() => ctx.close());

describe('onboarding', () => {
  it('registra aceite com versão e data e libera a conta', async () => {
    const email = uniqueStudentEmail();
    const { c } = await login(ctx, email);
    expect((await c.get('/api/me')).body.status).toBe('onboarding_required');
    await onboardAdult(c, 'Carla Dias');
    expect((await c.get('/api/me').expect(200)).body).toMatchObject({
      status: 'active',
      displayName: 'Carla Dias',
    });
    const { rows } = await ctx.pool.query(
      `select c.kind, c.document_version, c.granted, c.created_at from public.consents c
         join public.users u on u.id = c.user_id where u.email = $1 order by c.kind`,
      [email],
    );
    expect(rows.map((r) => [r.kind, r.granted])).toEqual([
      ['privacy', true],
      ['terms', true],
    ]);
    expect(rows[0].document_version).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(rows[0].created_at).toBeInstanceOf(Date);
  });

  it('não pergunta nem guarda idade (minimização)', async () => {
    const { rows } = await ctx.pool.query(
      `select column_name from information_schema.columns where table_schema = 'public' and table_name = 'users'`,
    );
    const cols = rows.map((r) => r.column_name);
    expect(cols).not.toContain('is_minor');
    expect(cols).not.toContain('birth_date');
  });

  it('não aceita onboarding duas vezes', async () => {
    const { c } = await login(ctx, uniqueStudentEmail());
    await onboardAdult(c);
    const res = await c
      .post('/api/account/onboarding', {
        displayName: 'Outro Nome',
        locale: 'pt',
        acceptTerms: true,
        acceptPrivacy: true,
      })
      .expect(400);
    expect(res.body.error.code).toBe('ONBOARDING_ALREADY_DONE');
  });

  it('exige aceite dos termos', async () => {
    const { c } = await login(ctx, uniqueStudentEmail());
    const res = await c
      .post('/api/account/onboarding', {
        displayName: 'Ana Lima',
        locale: 'pt',
        acceptTerms: false,
        acceptPrivacy: true,
      })
      .expect(400);
    expect(res.body.error.fields).toContain('acceptTerms');
  });
});
