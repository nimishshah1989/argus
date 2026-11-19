import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/** MILESTONES 78a goal 2: 0 job handlers fail without a log line. Every `.work(` is wrapped by `logFailures(`. */

const SRC = new URL('../src/', import.meta.url).pathname;

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === 'test' ? [] : sources(path);
    return name.endsWith('.ts') ? [path] : [];
  });
}

describe('every job handler logs its failure', () => {
  it('counts 0 handlers registered without logFailures', () => {
    const unwrapped: string[] = [];
    let registered = 0;
    for (const file of sources(SRC)) {
      const text = readFileSync(file, 'utf8');
      for (const match of text.matchAll(/\.work(?:<[^>]*>)?\(/g)) {
        registered += 1;
        const call = text.slice(match.index, match.index + 400);
        if (!call.includes('logFailures(')) unwrapped.push(file.slice(SRC.length));
      }
    }
    expect(registered).toBeGreaterThanOrEqual(10);
    expect(unwrapped).toEqual([]);
  });
});
