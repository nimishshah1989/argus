import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/** MILESTONES 78a goal 2: 0 job handlers fail without a log line. Every `.work(` handler is `logFailures(...)`. */

const SRC = new URL('../src/', import.meta.url).pathname;

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === 'test' ? [] : sources(path);
    return name.endsWith('.ts') ? [path] : [];
  });
}

/** The last top-level argument of the call whose `(` is at `open`: the handler itself. */
function lastArgument(text: string, open: number): string {
  let depth = 0;
  let start = open + 1;
  let last = '';
  for (let i = open; i < text.length; i += 1) {
    const ch = text[i]!;
    if ('([{'.includes(ch)) depth += 1;
    else if (')]}'.includes(ch)) {
      depth -= 1;
      if (depth === 0) return text.slice(start, i).trim() || last;
    } else if (ch === ',' && depth === 1) {
      last = text.slice(start, i).trim();
      start = i + 1;
    }
  }
  throw new Error('unbalanced call');
}

describe('every job handler logs its failure', () => {
  it('counts 0 handlers registered without logFailures as the handler itself', () => {
    const unwrapped: string[] = [];
    let registered = 0;
    for (const file of sources(SRC)) {
      const text = readFileSync(file, 'utf8');
      for (const match of text.matchAll(/\.work(?:<[^>]*>)?\(/g)) {
        registered += 1;
        const handler = lastArgument(text, match.index + match[0].length - 1);
        if (!handler.startsWith('logFailures(')) unwrapped.push(file.slice(SRC.length));
      }
    }
    expect(registered).toBeGreaterThanOrEqual(11);
    expect(unwrapped).toEqual([]);
  });
});
