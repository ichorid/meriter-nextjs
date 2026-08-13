import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:8004',
    browserName: 'chromium',
    channel: process.env.CI ? undefined : 'msedge',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-320', use: { viewport: { width: 320, height: 800 } } },
    { name: 'mobile-360', use: { viewport: { width: 360, height: 800 } } },
    { name: 'tablet-768', use: { viewport: { width: 768, height: 1024 } } },
  ],
  webServer: {
    command: '.\\node_modules\\.bin\\next.CMD dev --webpack -p 8004',
    url: 'http://127.0.0.1:8004/login',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      NEXT_PUBLIC_DEFAULT_COMMUNITY_ID: 'a1000001-0000-4000-8000-000000000001',
      NEXT_PUBLIC_FAKE_DATA_MODE: 'false',
    },
  },
});
