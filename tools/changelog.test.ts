import { describe, expect, it } from 'vitest';
import { changelogErrors, type ChangedFile } from './check-changelog.js';

const file = (status: string, path: string): ChangedFile => ({ status, path });

describe('changelog check', () => {
  it.each([
    [[file('A', 'changes/76-green-fast-main.md'), file('M', 'apps/x.ts')], []],
    [
      [file('M', 'changes/70-old.md')],
      ['add exactly one changelog fragment under changes/ (found 0)'],
    ],
    [
      [file('A', 'changes/1-a.md'), file('A', 'changes/2-b.md')],
      ['add exactly one changelog fragment under changes/ (found 2)'],
    ],
    [
      [file('A', 'changes/notes.md')],
      ['changes/notes.md: name a fragment changes/<issue>-<slug>.md'],
    ],
  ])('allows exactly one well-named fragment: %j', (files, expected) => {
    expect(changelogErrors(files)).toEqual(expected);
  });
});
