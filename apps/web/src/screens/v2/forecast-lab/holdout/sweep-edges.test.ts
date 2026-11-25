// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { PrintedTable } from '../../../../ui/v2/domain/printed-table.js';
import { labSheets } from '../sweep.js';

/** Sweep #706 (#690), batch D, hidden: the Lab's sheets at the edges. */

const cell = (text: string) => ({ text, sort: text, chips: [] });
const table = (title: string, rows: string[][]): PrintedTable => ({
  title,
  header: [
    { label: 'Month', numeric: false },
    { label: 'Score', numeric: true },
  ],
  rows: rows.map((row) => row.map(cell)),
  chips: [],
});

describe('labSheets at the edges', () => {
  it('is empty with no tables, and a table with no rows is its header only', () => {
    expect(labSheets({ tables: [] })).toEqual([]);
    expect(labSheets({ tables: [table('Empty', [])] })).toEqual([
      { name: 'Empty', rows: [['Month', 'Score']] },
    ]);
  });

  it('writes a numeric column’s plain numbers exactly, and everything else as printed', () => {
    const [sheet] = labSheets({
      tables: [
        table('Month detail', [
          ['2026', '1,234.5'],
          ['Feb', '0.123456'],
          ['Mar', '-3'],
          ['Apr', '99.3%'],
          ['May', '—'],
          ['Jun', ''],
        ]),
      ],
    });
    expect(sheet!.rows.slice(1)).toEqual([
      ['2026', 1234.5],
      ['Feb', 0.123456],
      ['Mar', -3],
      ['Apr', '99.3%'],
      ['May', '—'],
      ['Jun', ''],
    ]);
  });

  it('keeps the model’s row order, never re-sorted', () => {
    const [sheet] = labSheets({
      tables: [
        table('T', [
          ['B', '2'],
          ['A', '1'],
        ]),
      ],
    });
    expect(sheet!.rows.slice(1).map((r) => r[0])).toEqual(['B', 'A']);
  });
});
