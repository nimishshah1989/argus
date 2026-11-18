import { describe, expect, it } from 'vitest';
import { cellNumber, compareCells, isMissing, nextSort, sortRows } from './sort-table.js';

/**
 * The one sortable table (41e-1): numeric-aware over the engine's printed cells, stable on equal keys, and the
 * dash the matrices print is missing, never zero. A4 sorts by `# BD (Done By)` and back; the same functions
 * decide every header, so this file pins the rule the screen only wires to a click.
 */

const ROWS = [
  ['Person 11', 'Team', '197', '469.40', '15.40%'],
  ['Person 79', 'Team', '149', '403.67', '11.65%'],
  ['Imptex Team', 'Vendor', '5', '20.50', '0.39%'],
];

describe('the printed-cell reader', () => {
  it('reads grouping commas and percentages as numbers and a dash or a word as nothing', () => {
    expect(cellNumber('3,060.1')).toBe(3060.1);
    expect(cellNumber('1,23,456.78')).toBe(123456.78);
    expect(cellNumber('15.40%')).toBe(15.4);
    expect(cellNumber('—')).toBeNull();
    expect(cellNumber('')).toBeNull();
    expect(cellNumber('Person 11')).toBeNull();
    expect(isMissing('—')).toBe(true);
    expect(isMissing('0')).toBe(false);
  });
});

describe('the cell comparator', () => {
  it('orders numbers numerically, words with numeric collation, and puts the dash last', () => {
    expect(compareCells('197', '149')).toBeGreaterThan(0);
    expect(compareCells('15.40%', '11.65%')).toBeGreaterThan(0);
    expect(compareCells('Person 2', 'Person 10')).toBeLessThan(0);
    expect(compareCells('—', '3')).toBeGreaterThan(0);
    expect(compareCells('3', '—')).toBeLessThan(0);
    expect(compareCells('—', '—')).toBe(0);
  });
});

describe('the table sort', () => {
  it('re-orders by a numeric column ascending, then descending, and the second click is the original order', () => {
    const ascending = sortRows(ROWS, { column: 2, direction: 'ascending' });
    expect(ascending.map((row) => row[0])).toEqual(['Imptex Team', 'Person 79', 'Person 11']);
    const descending = sortRows(ROWS, { column: 2, direction: 'descending' });
    expect(descending.map((row) => row[0])).toEqual(['Person 11', 'Person 79', 'Imptex Team']);
    expect(descending).toEqual(ROWS);
  });

  it('keeps equal rows in the engine order in both directions', () => {
    const rows = [
      ['first', '2'],
      ['second', '2'],
      ['third', '1'],
    ];
    expect(sortRows(rows, { column: 1, direction: 'ascending' }).map((row) => row[0])).toEqual([
      'third',
      'first',
      'second',
    ]);
    expect(sortRows(rows, { column: 1, direction: 'descending' }).map((row) => row[0])).toEqual([
      'first',
      'second',
      'third',
    ]);
  });

  it('keeps the dash last in both directions and does not turn it into a zero', () => {
    const rows = [
      ['dash', '—'],
      ['three', '3'],
      ['one', '1'],
    ];
    expect(sortRows(rows, { column: 1, direction: 'ascending' }).map((row) => row[0])).toEqual([
      'one',
      'three',
      'dash',
    ]);
    expect(sortRows(rows, { column: 1, direction: 'descending' }).map((row) => row[0])).toEqual([
      'three',
      'one',
      'dash',
    ]);
  });

  it('returns the rows untouched until a header is clicked', () => {
    expect(sortRows(ROWS, null)).toBe(ROWS);
  });
});

describe('the header click', () => {
  it('starts ascending on a new column and flips the same column', () => {
    expect(nextSort(null, 2)).toEqual({ column: 2, direction: 'ascending' });
    expect(nextSort({ column: 2, direction: 'ascending' }, 2)).toEqual({
      column: 2,
      direction: 'descending',
    });
    expect(nextSort({ column: 2, direction: 'descending' }, 2)).toEqual({
      column: 2,
      direction: 'ascending',
    });
    expect(nextSort({ column: 2, direction: 'descending' }, 0)).toEqual({
      column: 0,
      direction: 'ascending',
    });
  });
});
