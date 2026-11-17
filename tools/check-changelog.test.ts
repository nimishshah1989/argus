import { describe, expect, it } from 'vitest';
import { changelogErrors, type ChangedFile } from './check-changelog.js';

const file = (status: string, path: string): ChangedFile => ({ status, path });

describe('changelog check', () => {
  it.each([
    [[file('A', 'changes/76-green-fast-main.md'), file('M', 'apps/x.ts')], []],
    [[file('M', 'changes/40-breakdowns.md'), file('M', 'apps/x.ts')], []],
    [[file('M', 'apps/x.ts')], ['add exactly one changelog fragment under changes/ (found 0)']],
    [
      [file('A', 'changes/1-a.md'), file('M', 'changes/2-b.md')],
      ['add exactly one changelog fragment under changes/ (found 2)'],
    ],
    [
      [file('A', 'changes/notes.md')],
      ['changes/notes.md: name a fragment changes/<issue>-<slug>.md'],
    ],
    [
      [file('M', 'changes/notes.md')],
      ['changes/notes.md: name a fragment changes/<issue>-<slug>.md'],
    ],
  ])('allows exactly one well-named fragment, added or modified: %j', (files, expected) => {
    expect(changelogErrors(files)).toEqual(expected);
  });
});

describe('merge train changelog check', () => {
  it('allows one fragment per ticket', () => {
    const files = [file('A', 'changes/276-a.md'), file('A', 'changes/277-b.md')];
    expect(changelogErrors(files, { train: true })).toEqual([]);
  });
  it('allows a single fragment', () => {
    expect(changelogErrors([file('A', 'changes/276-a.md')], { train: true })).toEqual([]);
  });
  it('allows a modified fragment, the ticket appending to the one it added earlier', () => {
    expect(changelogErrors([file('M', 'changes/40-breakdowns.md')], { train: true })).toEqual([]);
  });
  it('still requires at least one fragment', () => {
    expect(changelogErrors([file('M', 'apps/x.ts')], { train: true })).toEqual([
      'add at least one changelog fragment under changes/ (found 0)',
    ]);
  });
  it('still rejects a badly named fragment', () => {
    expect(changelogErrors([file('A', 'changes/notes.md')], { train: true })).toEqual([
      'changes/notes.md: name a fragment changes/<issue>-<slug>.md',
    ]);
  });
});
