import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

const repoRoot = path.join(__dirname, '..');

process.env.UZZ_E2E_MONGO_URL ??=
  'mongodb://127.0.0.1:27018/uzz_e2e?directConnection=true';
process.env.UZZ_E2E_EMAIL_CONTROL_URL ??= 'http://127.0.0.1:19090';
process.env.UZZ_E2E_TELEGRAM_CONTROL_URL ??= 'http://127.0.0.1:19091';
process.env.UZZ_E2E_COMMUNITY_ID ??= 'a1000001-0000-4000-8000-000000000001';

export default defineConfig({
  testDir: './e2e/real',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: 'list',
  timeout: 60_000,
  use: {
    baseURL: 'http://127.0.0.1:8004',
    browserName: 'chromium',
    channel: process.env.CI ? undefined : 'msedge',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'desktop', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'docker compose -f docker-compose.uzz-e2e.yml up --build -d --wait',
    cwd: repoRoot,
    url: 'http://127.0.0.1:8004/login',
    reuseExistingServer: true,
    timeout: 15 * 60 * 1000,
  },
});
