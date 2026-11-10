import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const dbPath = fileURLToPath(new URL('./packages/db/src/index.ts', import.meta.url));
const sharedPath = fileURLToPath(new URL('./packages/shared/src/index.ts', import.meta.url));
const domainPath = fileURLToPath(new URL('./packages/domain/src/index.ts', import.meta.url));

export default defineConfig({
  resolve: {
    alias: { '@argus/db': dbPath, '@argus/shared': sharedPath, '@argus/domain': domainPath },
  },
  test: {
    include: ['tools/**/*.test.ts', 'packages/**/*.test.ts', 'apps/**/*.test.ts'],
    environment: 'node',
    passWithNoTests: true,
  },
});
