import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('..', import.meta.url));

// The production image runs the esbuild bundle, not the TypeScript source the other tests use.
// Loading it must get past every bundled dependency: it may stop only because its settings are missing.
describe('the server bundle', () => {
  it('loads its dependencies and stops only for missing settings', () => {
    execFileSync('pnpm', ['build:server'], { cwd: root, stdio: 'ignore' });
    const run = spawnSync(process.execPath, ['apps/server/dist/server.mjs'], {
      cwd: root,
      env: { PATH: process.env.PATH ?? '' },
      encoding: 'utf8',
      timeout: 30_000,
    });
    const output = `${run.stdout}\n${run.stderr}`;
    expect(output).not.toMatch(/Dynamic require|Cannot find module|ERR_MODULE_NOT_FOUND/);
    expect(run.status).not.toBe(0);
    expect(output).toMatch(/DATABASE_URL/);
  }, 120_000);
});
