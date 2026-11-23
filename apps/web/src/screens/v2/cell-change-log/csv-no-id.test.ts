// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { cellLogCsv, cellMoves } from '../../analytics/machine-values.js';
import { UUID } from '../figures/real-reply.js';

/** G1.3: a machine the plant no longer lists is a dash in the export, as it is on the screen; never its database id. */

const LISTED = '10000000-0000-4000-8000-0000000000a1';
const GONE = '10000000-0000-4000-8000-0000000000ff';
const LABELS = {
  docNo: 'DOC. NO. CE-MTN-F-01',
  title: 'Cell / Location Change Log',
  date: 'Date',
  machine: 'Machine',
  fromCell: 'From cell',
  toCell: 'To cell',
  fromLocation: 'From location',
  toLocation: 'To location',
};
const moves = cellMoves({
  moves: [
    {
      id: 'mv1',
      machineId: GONE,
      date: '2026-02-10',
      fromCell: '2',
      toCell: '6',
      fromLocation: '434',
      toLocation: '434',
    },
  ],
});

describe('the cell change log export', () => {
  it('prints a dash, not the database id, for a machine the plant no longer lists', () => {
    const csv = cellLogCsv(moves, (id) => (id === LISTED ? 'CNC-01' : null), LABELS);
    expect(csv).not.toMatch(UUID);
    expect(csv.trimEnd().split('\n')[4]).toBe('10-02-2026,—,2,6,434,434');
  });
});
