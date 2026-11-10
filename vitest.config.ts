import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const dbPath = fileURLToPath(new URL('./packages/db/src/index.ts', import.meta.url));
const sharedPath = fileURLToPath(new URL('./packages/shared/src/index.ts', import.meta.url));
const domainPath = fileURLToPath(new URL('./packages/domain/src/index.ts', import.meta.url));

export default defineConfig({
  resolve: {
    alias: { '@uptimo/db': dbPath, '@uptimo/shared': sharedPath, '@uptimo/domain': domainPath },
  },
  test: {
    include: ['tools/**/*.test.ts', 'packages/**/*.test.ts', 'apps/**/*.test.ts'],
    environment: 'node',
    passWithNoTests: true,
    // Integration tests start a Testcontainer and seed it; under a full parallel run the
    // default 5s test timeout is too tight (the cosmos seed legitimately takes longer).
    testTimeout: 20_000,
    hookTimeout: 120_000,
  },
});
