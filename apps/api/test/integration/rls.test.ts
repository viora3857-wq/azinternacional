import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SEED, TEST_DATABASE_URL } from './helpers';

/**
 * Testa o RLS diretamente no Postgres, como o Supabase aplica: papel `authenticated` + claims.
 * Não passa pela API: prova que o banco se defende sozinho mesmo se o back-end errar.
 */
let pool: pg.Pool;
let otherStudentId: string;

beforeAll(async () => {
  pool = new pg.Pool({ connectionString: TEST_DATABASE_URL, max: 2 });
  const { rows } = await pool.query(
    `insert into public.users (email, role, school_id, onboarded_at)
     values ('rls-${Date.now()}@escola.example', 'student', $1, now()) returning id`,
    [SEED.schoolId],
  );
  otherStudentId = rows[0].id;
  await pool.query(
    `insert into public.consents (user_id, kind, document_version, granted) values ($1, 'terms', 'v', true)`,
    [otherStudentId],
  );
});
afterAll(() => pool.end());

async function as<T>(userId: string | null, fn: (c: pg.PoolClient) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query('begin');
    if (userId) {
      await c.query(`select set_config('request.jwt.claims', $1, true)`, [
        JSON.stringify({ sub: userId, role: 'authenticated' }),
      ]);
      await c.query('set local role authenticated');
    } else {
      await c.query('set local role anon');
    }
    return await fn(c);
  } finally {
    await c.query('rollback');
    c.release();
  }
}

const pgCode = async (p: Promise<unknown>) =>
  p.then(
    () => 'ok',
    (e: { code?: string }) => e.code,
  );

describe('RLS: users', () => {
  it('aluno vê só a própria linha', async () => {
    const rows = await as(
      SEED.studentId,
      async (c) => (await c.query('select id from public.users')).rows,
    );
    expect(rows).toEqual([{ id: SEED.studentId }]);
  });

  it('aluno não lê outro aluno nem filtrando pelo id', async () => {
    const rows = await as(
      SEED.studentId,
      async (c) =>
        (await c.query('select id from public.users where id = $1', [otherStudentId])).rows,
    );
    expect(rows).toEqual([]);
  });

  it('aluno não marca o próprio e-mail como confirmado', async () => {
    expect(
      await as(SEED.studentId, (c) =>
        pgCode(
          c.query(`update public.users set email_verified_at = now() where id = $1`, [
            SEED.studentId,
          ]),
        ),
      ),
    ).toBe('42501');
  });

  it('aluno não altera papel nem escola (grant por coluna)', async () => {
    expect(
      await as(SEED.studentId, (c) =>
        pgCode(c.query(`update public.users set role = 'owner' where id = $1`, [SEED.studentId])),
      ),
    ).toBe('42501');
    expect(
      await as(SEED.studentId, (c) =>
        pgCode(c.query(`update public.users set school_id = null where id = $1`, [SEED.studentId])),
      ),
    ).toBe('42501');
  });

  it('aluno altera o próprio nome, mas update em outro aluno não afeta nada', async () => {
    const own = await as(
      SEED.studentId,
      async (c) =>
        (
          await c.query(`update public.users set display_name = 'Aluno Demo' where id = $1`, [
            SEED.studentId,
          ])
        ).rowCount,
    );
    expect(own).toBe(1);
    const other = await as(
      SEED.studentId,
      async (c) =>
        (
          await c.query(`update public.users set display_name = 'Hacker' where id = $1`, [
            otherStudentId,
          ])
        ).rowCount,
    );
    expect(other).toBe(0);
  });

  it('aluno não insere nem apaga usuários', async () => {
    expect(
      await as(SEED.studentId, (c) =>
        pgCode(c.query(`insert into public.users (email) values ('x@escola.example')`)),
      ),
    ).toBe('42501');
    expect(
      await as(SEED.studentId, (c) =>
        pgCode(c.query(`delete from public.users where id = $1`, [otherStudentId])),
      ),
    ).toBe('42501');
  });

  it('admin vê usuários da própria escola', async () => {
    const ids = await as(SEED.adminId, async (c) =>
      (await c.query('select id from public.users')).rows.map((r) => r.id),
    );
    expect(ids).toContain(SEED.studentId);
    expect(ids).toContain(otherStudentId);
    expect(ids).not.toContain(SEED.ownerId);
  });

  it('owner vê todos', async () => {
    const ids = await as(SEED.ownerId, async (c) =>
      (await c.query('select id from public.users')).rows.map((r) => r.id),
    );
    expect(ids).toEqual(
      expect.arrayContaining([SEED.ownerId, SEED.adminId, SEED.studentId, otherStudentId]),
    );
  });

  it('anon não lê nada', async () => {
    expect(await as(null, (c) => pgCode(c.query('select id from public.users')))).toBe('42501');
  });
});

describe('RLS: consents', () => {
  it('aluno lê só os próprios consentimentos e não grava', async () => {
    const rows = await as(
      SEED.studentId,
      async (c) => (await c.query('select user_id from public.consents')).rows,
    );
    expect(rows.every((r) => r.user_id === SEED.studentId)).toBe(true);
    expect(
      await as(SEED.studentId, (c) =>
        pgCode(
          c.query(
            `insert into public.consents (user_id, kind, document_version, granted) values ($1, 'terms', 'v', true)`,
            [SEED.studentId],
          ),
        ),
      ),
    ).toBe('42501');
  });
});

describe('schema private', () => {
  it.each([
    'sessions',
    'magic_link_tokens',
    'user_mfa',
    'mfa_challenges',
    'user_credentials',
    'email_tokens',
    'audit_logs',
  ])('authenticated não acessa private.%s', async (table) => {
    expect(
      await as(SEED.ownerId, (c) => pgCode(c.query(`select 1 from private.${table} limit 1`))),
    ).toBe('42501');
  });

  it('anon não acessa o schema private', async () => {
    expect(await as(null, (c) => pgCode(c.query('select 1 from private.sessions limit 1')))).toBe(
      '42501',
    );
  });
});

describe('cobertura de RLS', () => {
  it('toda tabela em public e private tem RLS ligado', async () => {
    const { rows } = await pool.query(
      `select n.nspname || '.' || c.relname as t from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where c.relkind = 'r' and n.nspname in ('public', 'private') and not c.relrowsecurity`,
    );
    expect(rows).toEqual([]);
  });
});
