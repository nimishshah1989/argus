import { defineConfig, devices } from '@playwright/test';

/**
 * Gallery screenshots and axe (ticket 10, D9, D20). No database: two web servers, the dev
 * server (:3100) and the production preview (:3101). Baselines are made in the pinned Playwright
 * image (`pnpm gallery:update:docker`), so they are byte-identical to CI's.
 */
const VITE = 'pnpm --filter @uptimo/web exec vite';

export default defineConfig({
  testDir: './apps/web/e2e/gallery',
  snapshotPathTemplate: '{testDir}/__screenshots__/{arg}{ext}',
  fullyParallel: true,
  retries: 0,
  reporter: 'list',
  timeout: 60_000,
  outputDir: 'test-results/gallery',
  updateSnapshots: 'none',
  expect: { toHaveScreenshot: { animations: 'disabled', caret: 'hide', scale: 'css' } },
  webServer: [
    {
      command: `${VITE} --host 127.0.0.1 --port 3100 --strictPort`,
      url: 'http://127.0.0.1:3100',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: `pnpm build:web && ${VITE} preview --host 127.0.0.1 --port 3101 --strictPort`,
      url: 'http://127.0.0.1:3101',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://127.0.0.1:3100',
        viewport: { width: 360, height: 800 },
        deviceScaleFactor: 1,
        reducedMotion: 'reduce',
        locale: 'en-US',
        timezoneId: 'Asia/Kolkata',
      },
    },
  ],
});
