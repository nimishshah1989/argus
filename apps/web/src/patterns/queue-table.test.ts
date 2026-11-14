import { describe, expect, it } from 'vitest';
import { sorted, type QueueColumn } from './queue-table.js';

interface Row {
  ref: string;
  count: number;
  at: Date;
}
const rows: Row[] = [
  { ref: 'BD-10', count: 2, at: new Date('2026-11-14T08:00:00Z') },
  { ref: 'BD-9', count: 1, at: new Date('2026-11-13T08:00:00Z') },
  { ref: 'BD-11', count: 2, at: new Date('2026-11-12T08:00:00Z') },
];
const columns: QueueColumn<Row>[] = [
  { label: 'Ref', cell: (r) => r.ref, sortKey: (r) => r.ref },
  { label: 'Count', cell: (r) => r.count, sortKey: (r) => r.count },
  { label: 'At', cell: (r) => r.at.toISOString(), sortKey: (r) => r.at },
  { label: 'Note', cell: () => '' },
];
const refs = (column: number, direction: 'ascending' | 'descending') =>
  sorted(rows, columns, { column, direction }).map((r) => r.ref);

describe('queue table sorting', () => {
  it('sorts codes the way people read them, BD-9 before BD-10', () => {
    expect(refs(0, 'ascending')).toEqual(['BD-9', 'BD-10', 'BD-11']);
    expect(refs(0, 'descending')).toEqual(['BD-11', 'BD-10', 'BD-9']);
  });

  it('sorts numbers and keeps equal rows in their loaded order both ways', () => {
    expect(refs(1, 'ascending')).toEqual(['BD-9', 'BD-10', 'BD-11']);
    expect(refs(1, 'descending')).toEqual(['BD-10', 'BD-11', 'BD-9']);
  });

  it('sorts dates by time, not by their text', () => {
    expect(refs(2, 'ascending')).toEqual(['BD-11', 'BD-9', 'BD-10']);
    expect(refs(2, 'descending')).toEqual(['BD-10', 'BD-9', 'BD-11']);
  });

  it('leaves the order alone with no sort or a column that cannot sort', () => {
    expect(sorted(rows, columns, null)).toBe(rows);
    expect(sorted(rows, columns, { column: 3, direction: 'ascending' })).toBe(rows);
  });
});
