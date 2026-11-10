import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end harness for the real stack. globalSetup starts a postgres:16-alpine
 * Testcontainer, migrates and seeds the fake cosmos, and boots the API (:3001) plus the
 * Vite dev server (:3000). There are no `webServer` entries on purpose: Playwright starts
 * those before globalSetup, so they could not receive the Testcontainer's DATABASE_URL.
 *
 * baseURL is 127.0.0.1 rather than localhost because the server resolves the tenant from
 * the Host header: an IP address maps to DEFAULT_TENANT_SLUG (cosmos), while the bare
 * host "localhost" carries no tenant slug and every sign-in would 404.
 */
const WEB_URL = process.env.E2E_WEB_URL ?? 'http://127.0.0.1:3000';

export default defineConfig({
  testDir: './apps/web/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  timeout: 90_000,
  globalTimeout: 300_000,
  expect: { timeout: 10_000 },
  globalSetup: './apps/web/e2e/global-setup.ts',
  globalTeardown: './apps/web/e2e/teardown.ts',
  use: {
    baseURL: WEB_URL,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'phone', use: { ...devices['Pixel 5'] } },
  ],
});
