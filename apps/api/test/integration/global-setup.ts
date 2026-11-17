import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { TEST_DATABASE_URL } from './helpers';

/** Recria o banco de teste do zero (shim do Supabase + migrações + seed) antes da suíte. */
export default function setup() {
  const root = fileURLToPath(new URL('../../../../', import.meta.url));
  execFileSync('bash', ['scripts/db-setup-local.sh'], {
    cwd: root,
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: 'inherit',
  });
}
