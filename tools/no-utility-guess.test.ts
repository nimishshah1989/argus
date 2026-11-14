import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// v3.alerts.08: Bhavin hid utility machines by guessing from their names. Hiding is now the group's
// hidden flag, so no name list for this purpose may come back into our code.
const STEMS = ['tank', 'compressor', 'dryer', 'stabili', 'generator', 'transformer', 'chiller'];
const SKIP = new Set(['node_modules', 'dist', 'coverage', 'generated']);

function codeFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return SKIP.has(entry.name) ? [] : codeFiles(path);
    return /\.(ts|tsx|js|mjs|sql)$/.test(entry.name) ? [path] : [];
  });
}

/** A line that joins two or more utility names as alternatives is a name guess. */
function guesses(line: string): boolean {
  const parts = line.toLowerCase().split('|');
  return STEMS.filter((stem) => parts.some((part) => part.includes(stem))).length >= 2;
}

describe('no utility name guess in code', () => {
  it('recognises the guess it replaces', () => {
    const bhavin = readFileSync('docs/discovery/bhavin-v3/app.js', 'utf8').split('\n');
    expect(bhavin.filter(guesses)).toHaveLength(1);
  });

  it('finds none in apps or packages', () => {
    const found = ['apps', 'packages'].flatMap(codeFiles).flatMap((path) =>
      readFileSync(path, 'utf8')
        .split('\n')
        .flatMap((line, index) => (guesses(line) ? [`${path}:${index + 1}`] : [])),
    );
    expect(found).toEqual([]);
  });
});
