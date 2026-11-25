// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { TableModel } from '../../../../ui/v2/domain/engine-table.js';
import type { RegisterPageModel } from '../model.js';
import { registerSheets } from '../sweep.js';

/** The edges of the register's sweep helper (#706 batch A): no tables, button columns, notes, short rows, exact numbers. */
const table = (over: Partial<TableModel>): TableModel =>
  ({
    id: 'list',
    title: 'Machine list',
    header: [],
    rows: [],
    chips: [],
    words: {},
    ...over,
  }) as unknown as TableModel;
const page = (tables: TableModel[]): RegisterPageModel =>
  ({ id: 'cnc', label: 'CNC', verdict: {}, kpis: [], tables }) as unknown as RegisterPageModel;

describe('registerSheets edges', () => {
  it('no tables, no sheets', () => {
    expect(registerSheets(page([]))).toEqual([]);
  });

  it('an empty table is its header only', () => {
    const sheets = registerSheets(
      page([table({ header: [{ label: 'Machine ID', numeric: false }] })]),
    );
    expect(sheets).toEqual([{ name: 'Machine list', rows: [['Machine ID']] }]);
  });

  it('skips a column of buttons, keeps a note, and writes the exact number', () => {
    const sheets = registerSheets(
      page([
        table({
          header: [
            { label: 'Machine ID', numeric: false },
            { label: 'Hours', numeric: true },
            { label: '', numeric: false, fixed: true },
            { label: 'Cell', numeric: false },
          ],
          rows: [
            [
              { text: 'VC-1', sort: 'VC-1', note: 'NOT IN PRODUCTION DATA' },
              { text: '1,234.6', sort: 1234.56 },
              { text: 'Open', sort: '', action: 'open' },
              { text: '4', sort: 4 },
            ],
            [
              { text: 'VC-2', sort: 'VC-2' },
              { text: '—', sort: '—' },
            ],
          ],
        }),
      ]),
    );
    expect(sheets[0]!.rows).toEqual([
      ['Machine ID', 'Hours', 'Cell'],
      ['VC-1 NOT IN PRODUCTION DATA', 1234.56, '4'],
      ['VC-2', '—', ''],
    ]);
  });

  it('a non-finite sort in a number column falls back to the printed text', () => {
    const sheets = registerSheets(
      page([
        table({
          header: [{ label: 'Count', numeric: true }],
          rows: [[{ text: '—', sort: Number.NaN }]],
        }),
      ]),
    );
    expect(sheets[0]!.rows[1]).toEqual(['—']);
  });
});
