import { describe, expect, it } from 'vitest';
import { entityOfRow } from './row-entity.js';

describe('entityOfRow: the thing a table row is (ADR 0060)', () => {
  it('reads the row’s own machine, chip, decision or entity', () => {
    expect(entityOfRow({ machine: { kind: 'machine', id: 'TC-1', label: 'TC-1' } })).toEqual({
      kind: 'machine',
      id: 'TC-1',
    });
    expect(entityOfRow({ chip: { kind: 'person', id: 'p1' } })).toEqual({
      kind: 'person',
      id: 'p1',
    });
    expect(entityOfRow({ decision: { kind: 'decision', id: 'd1' } })?.kind).toBe('decision');
  });

  it('falls back to the first chip of the row, then of its cells', () => {
    expect(entityOfRow({ chips: [{ kind: 'cell', id: 'C2' }] })).toEqual({
      kind: 'cell',
      id: 'C2',
    });
    expect(
      entityOfRow({ cells: [{ text: 'x', chips: [] }, { chips: [{ kind: 'machine', id: 'M' }] }] }),
    ).toEqual({ kind: 'machine', id: 'M' });
  });

  it('names nothing for a row with no chip, an unknown kind or an empty id', () => {
    expect(entityOfRow({ text: 'x' })).toBeUndefined();
    expect(entityOfRow({ machine: { kind: 'ticket', id: 't' } })).toBeUndefined();
    expect(entityOfRow({ machine: { kind: 'machine', id: '' } })).toBeUndefined();
    expect(entityOfRow(null)).toBeUndefined();
  });
});
