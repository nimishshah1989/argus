import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tools/**/*.test.ts', 'packages/**/*.test.ts', 'apps/**/*.test.ts'],
    environment: 'node',
    env: { CHECK_REPLIES: '1' },
    passWithNoTests: true,
    // Integration files boot real Postgres containers; cap concurrency to avoid shutdown races.
    maxWorkers: 4,
    // Integration tests start a Testcontainer and seed it; under a full parallel run the
    // default 5s test timeout is too tight (the cosmos seed legitimately takes longer).
    testTimeout: 20_000,
    hookTimeout: 120_000,
  },
});
