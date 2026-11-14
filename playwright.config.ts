import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end harness for the real stack. globalSetup starts a postgres:16-alpine
 * Testcontainer, migrates it, and boots the API (:3001) plus the
 * Vite dev server (:3000). There are no `webServer` entries on purpose: Playwright starts
 * those before globalSetup, so they could not receive the Testcontainer's DATABASE_URL.
 *
 * baseURL is 127.0.0.1, which maps to no tenant (DEFAULT_TENANT_SLUG e2e-unscoped): every spec
 * imports `test` from apps/web/e2e/test.ts, which seeds this worker's tenant e2e-w<n> and points
 * baseURL at e2e-w<n>.localhost:3000 (the server resolves the tenant from the Host header).
 */
const WEB_URL = process.env.E2E_WEB_URL ?? 'http://127.0.0.1:3000';

export default defineConfig<object, { uiLanguage: 'en' | 'gu' }>({
  testDir: './apps/web/e2e',
  testIgnore: '**/gallery/**',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  timeout: 90_000,
  // A shard with retries takes 4 to 5 minutes on CI; at 300 s a slow run died with "2 errors were not a part
  // of any test". Stays under the job's timeout-minutes (ci.yml), so a hang still ends here, with a clear message.
  globalTimeout: 480_000,
  expect: { timeout: 10_000 },
  globalSetup: './apps/web/e2e/global-setup.ts',
  globalTeardown: './apps/web/e2e/teardown.ts',
  use: {
    baseURL: WEB_URL,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    {
      name: 'phone',
      use: { ...devices['Pixel 5'] },
      testIgnore: ['**/gallery/**', '**/actions.spec.ts'],
    },
    // Journeys with the tenant language set to Gujarati; empty gu values fall back to English
    // until ticket 24, so this proves the seed, the config and no regressions, not a translation.
    {
      name: 'gujarati',
      use: { ...devices['Pixel 5'], uiLanguage: 'gu' },
      testIgnore: ['**/gallery/**', '**/actions.spec.ts'],
    },
  ],
});
