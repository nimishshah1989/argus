import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tools/**/*.test.ts', 'packages/**/*.test.ts', 'apps/**/*.test.ts'],
    environment: 'node',
    env: { CHECK_REPLIES: '1' },
    passWithNoTests: true,
    // Integration files boot real Postgres containers; cap concurrency to avoid shutdown races.
    maxWorkers: 4,
    // A container start plus seed on a CI runner can pass 20 s, and a timed-out file wastes the whole run.
    testTimeout: 35_000,
    hookTimeout: 120_000,
  },
});
