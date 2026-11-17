import { randomBytes } from 'node:crypto';
import { defineConfig, devices } from '@playwright/test';

const E2E_DATABASE_URL =
  process.env.E2E_DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/az_e2e';
const APP_URL = 'http://localhost:5173';

export default defineConfig({
  testDir: './tests',
  globalSetup: './global-setup.ts',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  timeout: 60_000,
  use: { baseURL: APP_URL, trace: 'off', locale: 'pt-BR' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] }, grepInvert: /@mobile/ },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, grep: /@mobile/ },
  ],
  webServer: [
    {
      // API compilada (mesmo artefato do deploy), com e-mail em modo dev para ler os links.
      command: 'node apps/api/dist/server.js',
      cwd: '..',
      url: 'http://localhost:3000/api/health',
      reuseExistingServer: !process.env.CI,
      env: {
        NODE_ENV: 'test',
        PORT: '3000',
        LOG_LEVEL: 'warn',
        APP_URL,
        DATABASE_URL: E2E_DATABASE_URL,
        DATA_ENCRYPTION_KEY: randomBytes(32).toString('base64'),
        HASH_PEPPER: randomBytes(32).toString('hex'),
        EMAIL_PROVIDER: 'dev',
        EMAIL_FROM_ADDRESS: 'no-reply@az.example',
        AUTH_RATE_LIMIT_PER_15MIN: '1000',
      },
    },
    {
      command: 'npm run preview -w @az/web',
      cwd: '..',
      url: APP_URL,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
