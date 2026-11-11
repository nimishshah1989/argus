import { defineConfig } from '@playwright/test';

/** Isolated D0.1 evidence run. Stop the regular E2E stack first: both use ports 3000/3001. */
export default defineConfig({
  testDir: './apps/web/e2e-baseline',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: true,
  reporter: 'list',
  timeout: 90_000,
  globalTimeout: 300_000,
  expect: { timeout: 10_000 },
  globalSetup: './apps/web/e2e/global-setup.ts',
  globalTeardown: './apps/web/e2e/teardown.ts',
  use: {
    baseURL: process.env.E2E_WEB_URL ?? 'http://127.0.0.1:3000',
    viewport: { width: 360, height: 800 },
    deviceScaleFactor: 1,
    colorScheme: 'light',
    reducedMotion: 'reduce',
    locale: 'en-IN',
    timezoneId: 'Asia/Kolkata',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'baseline', use: { browserName: 'chromium' } }],
});
