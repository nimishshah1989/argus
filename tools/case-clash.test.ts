import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

/** Files an extensionless (or `.js`) import can resolve to; a `.css` import always names its file in full. */
const MODULE = /\.[cm]?[jt]sx?$/;
const stem = (path: string) => path.replace(MODULE, '');

/**
 * Groups of tracked modules whose paths are equal ignoring case and extension but not equal as written. On a Mac
 * (case-insensitive disk) an import of one can open the other, so typecheck and tests break there while Linux CI
 * stays green.
 */
function caseClashes(paths: string[]): string[][] {
  const byKey = new Map<string, string[]>();
  for (const path of paths.filter((p) => MODULE.test(p))) {
    const key = stem(path).toLowerCase();
    byKey.set(key, [...(byKey.get(key) ?? []), path]);
  }
  return [...byKey.values()]
    .filter((group) => new Set(group.map(stem)).size > 1)
    .map((group) => [...group].sort());
}

describe('module names that differ only by case', () => {
  it('finds a clash and ignores same-case siblings and stylesheets', () => {
    expect(caseClashes(['a/Bubble.tsx', 'a/bubble.ts', 'a/bubble.css', 'b/live.ts'])).toEqual([
      ['a/Bubble.tsx', 'a/bubble.ts'],
    ]);
    expect(
      caseClashes([
        'a/live.ts',
        'a/live.test.ts',
        'a/NavMap.tsx',
        'a/navmap.css',
        'A/x.ts',
        'a/x.ts',
      ]),
    ).toEqual([['A/x.ts', 'a/x.ts']]);
  });

  it('none exist under apps/ or packages/', () => {
    const listed = execFileSync('git', ['ls-files', '-z', '--', 'apps', 'packages'], {
      encoding: 'utf8',
      maxBuffer: 1 << 26,
    });
    expect(caseClashes(listed.split('\0').filter(Boolean))).toEqual([]);
  });
});
