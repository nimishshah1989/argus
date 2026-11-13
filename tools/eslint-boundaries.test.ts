import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

async function lint(filePath: string, code: string): Promise<number> {
  const results = await new ESLint({ cwd: process.cwd() }).lintText(code, { filePath });
  return (results[0]?.messages ?? []).filter((m) => m.ruleId === 'no-restricted-imports').length;
}

const from = (spec: string) => `import { x } from '${spec}';`;
const MODULE = 'apps/server/src/modules/reports/a.ts';

describe('eslint module boundaries', () => {
  it("forbids another module's non-index file", async () => {
    expect(await lint(MODULE, from('../plant/repo.js'))).toBe(1);
    expect(await lint(MODULE, from('../plant/index.js'))).toBe(0);
  });

  it('forbids leaving apps/server/src and kernel internals', async () => {
    expect(await lint(MODULE, from('../../../../packages/db/src/index.js'))).toBe(1);
    expect(await lint(MODULE, from('../../kernel/guard.js'))).toBe(1);
    expect(await lint(MODULE, from('../../kernel/index.js'))).toBe(0);
  });

  it('applies at repo/ depth', async () => {
    const file = 'apps/server/src/modules/tickets/repo/a.ts';
    expect(await lint(file, from('../../plant/repo.js'))).toBe(1);
    expect(await lint(file, from('../ticket.js'))).toBe(0);
    expect(await lint(file, from('../../plant/index.js'))).toBe(0);
  });

  it('guards the root, kernel and seed', async () => {
    expect(await lint('apps/server/src/app.ts', from('./modules/tickets/routes.js'))).toBe(1);
    expect(await lint('apps/server/src/kernel/a.ts', from('../modules/plant/index.js'))).toBe(1);
    const seed = 'apps/server/src/seed/a.ts';
    expect(await lint(seed, from('../modules/plant/repo/config.js'))).toBe(1);
    expect(await lint(seed, from('../modules/plant/index.js'))).toBe(0);
  });
});
