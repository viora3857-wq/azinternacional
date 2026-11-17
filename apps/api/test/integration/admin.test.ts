import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestCtx, login, SEED, uniqueStudentEmail, type TestCtx } from './helpers';

let ctx: TestCtx;
let otherSchoolStudentId: string;
let secondAdminId: string;

beforeAll(async () => {
  ctx = createTestCtx();
  const school = await ctx.pool.query(
    `insert into public.schools (name, email_domain) values ('Outra Escola', 'outra-${Date.now()}.example') returning id, email_domain`,
  );
  const user = await ctx.pool.query(
    `insert into public.users (email, role, school_id) values ($1, 'student', $2) returning id`,
    [`x@${school.rows[0].email_domain}`, school.rows[0].id],
  );
  otherSchoolStudentId = user.rows[0].id;
  const admin2 = await ctx.pool.query(
    `insert into public.users (email, role, school_id) values ('admin2-${Date.now()}@escola.example', 'admin', $1) returning id`,
    [SEED.schoolId],
  );
  secondAdminId = admin2.rows[0].id;
});
afterAll(() => ctx.close());

describe('shutdown de sessões (papel verificado no servidor)', () => {
  it('aluno recebe 403', async () => {
    const { c } = await login(ctx, uniqueStudentEmail());
    const res = await c.post(`/api/admin/users/${SEED.studentId}/shutdown`).expect(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('sem sessão recebe 401', async () => {
    const { client } = await import('./helpers');
    await client(ctx.app).post(`/api/admin/users/${SEED.studentId}/shutdown`).expect(401);
  });

  it('admin derruba todas as sessões de um aluno da sua escola', async () => {
    const email = uniqueStudentEmail();
    const s1 = await login(ctx, email);
    const s2 = await login(ctx, email);
    const studentId = (await s1.c.get('/api/me')).body.id;

    const admin = await login(ctx, SEED.admin);
    const res = await admin.c.post(`/api/admin/users/${studentId}/shutdown`).expect(200);
    expect(res.body.revoked).toBe(2);
    await s1.c.get('/api/me').expect(401);
    await s2.c.get('/api/me').expect(401);

    const { rows } = await ctx.pool.query(
      `select action, metadata from private.audit_logs where target_id = $1 and action = 'admin.sessions_revoked'`,
      [studentId],
    );
    expect(rows[0].metadata).toEqual({ count: 2 });
  });

  it('admin não enxerga aluno de outra escola (RLS): 404', async () => {
    const admin = await login(ctx, SEED.admin);
    await admin.c.post(`/api/admin/users/${otherSchoolStudentId}/shutdown`).expect(404);
  });

  it('admin não derruba outro admin da mesma escola: 403', async () => {
    const admin = await login(ctx, SEED.admin);
    await admin.c.post(`/api/admin/users/${secondAdminId}/shutdown`).expect(403);
  });

  it('admin nem enxerga o owner: 404 (não revela que existe)', async () => {
    const admin = await login(ctx, SEED.admin);
    await admin.c.post(`/api/admin/users/${SEED.ownerId}/shutdown`).expect(404);
  });

  it('owner alcança qualquer escola', async () => {
    const owner = await login(ctx, SEED.owner);
    await owner.c.post(`/api/admin/users/${otherSchoolStudentId}/shutdown`).expect(200);
  });

  it('id inválido: 400', async () => {
    const admin = await login(ctx, SEED.admin);
    await admin.c.post('/api/admin/users/nao-e-uuid/shutdown').expect(400);
  });
});
