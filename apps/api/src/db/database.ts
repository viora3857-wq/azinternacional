import pg from 'pg';

export type DbClient = pg.PoolClient;

export function createPool(opts: {
  connectionString: string;
  ssl: 'disable' | 'require';
  max: number;
}) {
  return new pg.Pool({
    connectionString: opts.connectionString,
    ssl: opts.ssl === 'require' ? { rejectUnauthorized: true } : false,
    max: opts.max,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });
}

/**
 * Duas formas de acessar o banco:
 *  - `asUser`: muda para o papel `authenticated` com o id do usuário nas claims. O RLS é aplicado.
 *    Use para tudo que o próprio usuário lê ou altera.
 *  - `system`: papel dono das tabelas (ignora RLS). Só para fluxos do servidor que precisam
 *    disso (login, sessões, auditoria, consentimento). Cada uso deve checar autorização antes.
 */
export class Database {
  constructor(readonly pool: pg.Pool) {}

  async system<T>(fn: (c: DbClient) => Promise<T>): Promise<T> {
    return this.tx(fn);
  }

  async asUser<T>(userId: string, fn: (c: DbClient) => Promise<T>): Promise<T> {
    return this.tx(async (c) => {
      await c.query(`select set_config('request.jwt.claims', $1, true)`, [
        JSON.stringify({ sub: userId, role: 'authenticated' }),
      ]);
      await c.query('set local role authenticated');
      return fn(c);
    });
  }

  async ping(): Promise<void> {
    await this.pool.query('select 1');
  }

  private async tx<T>(fn: (c: DbClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const result = await fn(client);
      await client.query('commit');
      return result;
    } catch (err) {
      await client.query('rollback').catch(() => undefined);
      throw err;
    } finally {
      client.release();
    }
  }
}
