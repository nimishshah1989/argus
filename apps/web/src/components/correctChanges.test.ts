import { describe, expect, it } from 'vitest';
import { buildCorrectChanges, hasCorrectChanges } from './correctChanges.js';

describe('buildCorrectChanges', () => {
  it('keeps only the fields the admin filled, trimmed', () => {
    expect(
      buildCorrectChanges({ problem: '  New problem  ', reportedAt: '2026-11-11T10:00' }),
    ).toEqual({ problem: 'New problem', reportedAt: '2026-11-11T10:00' });
  });

  it('treats empty and whitespace values as unchanged', () => {
    expect(buildCorrectChanges({ problem: '   ', reportedAt: '' })).toEqual({});
    expect(hasCorrectChanges({})).toBe(false);
  });

  it('keeps a machine and a known kind', () => {
    expect(buildCorrectChanges({ machineId: 'machine-1', kind: 'support' })).toEqual({
      machineId: 'machine-1',
      kind: 'support',
    });
  });

  it('ignores an unknown kind', () => {
    expect(buildCorrectChanges({ kind: 'bogus' })).toEqual({});
  });
});
