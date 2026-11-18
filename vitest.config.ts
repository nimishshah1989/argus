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
    // 18 Nov: the domain suite now carries the seeded forecast/lab simulations; on a loaded
    // 2-core CI runner unrelated millisecond tests were still timing out at 60s, so allow 120s.
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
});
