import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export default function globalSetup() {
  execFileSync('bash', ['scripts/db-setup-local.sh'], {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    env: {
      ...process.env,
      DATABASE_URL:
        process.env.E2E_DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/az_e2e',
    },
    stdio: 'inherit',
  });
}
