import { describe, expect, it } from 'vitest';
import { changedFiles } from './precheck.js';

describe('precheck changed files', () => {
  it('T10 dedupes a path listed by two git commands', () => {
    expect(changedFiles(['a.ts\nb.ts\n', 'b.ts\n', ''], () => true)).toEqual(['a.ts', 'b.ts']);
  });
  it('T11 drops a path that no longer exists', () => {
    expect(changedFiles(['gone.ts\nkept.ts\n'], (p) => p === 'kept.ts')).toEqual(['kept.ts']);
  });
  it('T12 returns nothing for empty output', () => {
    expect(changedFiles(['', '\n', '  '], () => true)).toEqual([]);
  });
});
