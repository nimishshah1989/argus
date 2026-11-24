import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';

const GUARD = fileURLToPath(new URL('../.github/loop/check_pr.py', import.meta.url));
const dir = mkdtempSync(join(tmpdir(), 'guard-budget-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const git = (...args: string[]) => execFileSync('git', args, { cwd: dir, encoding: 'utf8' }).trim();
const lines = (n: number, tag: string) =>
  Array.from({ length: n }, (_, i) => `${tag} ${i}`).join('\n') + '\n';
const put = (path: string, text: string) => {
  mkdirSync(dirname(join(dir, path)), { recursive: true });
  writeFileSync(join(dir, path), text);
};
const commit = (msg: string) => {
  git('add', '-A');
  git('commit', '-qm', msg);
  return git('rev-parse', 'HEAD');
};

/** Runs the guard in the temp repo with a budget it always exceeds, and returns its "N files / M lines" count. */
function budgetCount(planBase: string): string {
  const r = spawnSync('python3', [GUARD, 'main', 'build/t1'], {
    cwd: dir,
    encoding: 'utf8',
    env: { ...process.env, PR_BODY: `Plan-base: ${planBase}\nBudget: files <= 0 lines <= 0\n` },
  });
  return /(\d+ files \/ \d+ lines)/.exec(r.stdout)?.[1] ?? r.stdout + r.stderr;
}

describe('loop-guard size budget', () => {
  git('init', '-q', '-b', 'main');
  git('config', 'user.email', 't@example.com');
  git('config', 'user.name', 't');
  put('src/shared.ts', lines(10, 'shared'));
  put('src/old.ts', lines(20, 'old'));
  commit('main: start');

  // Plan seed: a skeleton line in the shared file and a new skeleton file. Neither counts for the builder.
  git('checkout', '-qb', 'build/t1');
  put('src/shared.ts', lines(10, 'shared') + 'seed\n');
  put('src/seed.ts', lines(5, 'seed'));
  const planBase = commit('seed');

  // Builder: rename with one line changed (2 lines), two lines added to the shared file (2 lines).
  git('mv', 'src/old.ts', 'src/new.ts');
  put('src/new.ts', lines(20, 'old').replace('old 19', 'new 19'));
  put('src/shared.ts', lines(10, 'shared') + 'seed\nbuild 1\nbuild 2\n');
  put('docs/loop/handoff/1.md', 'handoff\n');
  commit('build');

  // Main moves on: 100 lines at the top of the shared file and a 50-line file, then the build merges main in.
  git('checkout', '-q', 'main');
  put('src/shared.ts', lines(100, 'main') + lines(10, 'shared'));
  put('src/mainonly.ts', lines(50, 'main'));
  commit('main: more work');
  git('checkout', '-q', 'build/t1');
  git('merge', '-q', '--no-edit', 'main');

  it('counts a rename once and ignores main and the seed, even in a file all three changed', () => {
    expect(readFileSync(join(dir, 'src/shared.ts'), 'utf8')).toContain('main 99');
    expect(budgetCount(planBase)).toBe('2 files / 4 lines');
  });
});
