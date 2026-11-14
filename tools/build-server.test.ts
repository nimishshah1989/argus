import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

it('ships every AI prompt beside the server bundle', () => {
  execFileSync('pnpm', ['exec', 'tsx', 'scripts/build-server.ts'], { stdio: 'pipe' });
  const src = 'apps/server/src/modules/ai/prompts/diagnosis.md';
  const out = 'apps/server/dist/prompts/diagnosis.md';
  expect(existsSync(out)).toBe(true);
  expect(readFileSync(out)).toEqual(readFileSync(src));
}, 60_000);
