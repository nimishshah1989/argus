import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tools/**/*.test.ts', 'packages/**/*.test.ts', 'apps/**/*.test.ts'],
    environment: 'node',
    passWithNoTests: true,
  },
});
