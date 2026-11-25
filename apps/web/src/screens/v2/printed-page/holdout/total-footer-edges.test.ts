import { describe, expect, it } from 'vitest';
import type { PageTable } from '../../../analytics/page-content.js';
import { printedTable } from '../table.js';

const page = (rows: string[][]): PageTable => ({
  title: 'Downtime by cell',
  header: ['Cell', 'Hours'],
  rows,
  rowCount: rows.length,
  truncated: false,
});
const names = (rows: { text: string }[][]) => rows.map((r) => r[0]?.text);

describe('printed tables: total footer edges (ticket 689)', () => {
  it('a "Total" row in the middle leaves the rows and becomes the total', () => {
    const table = printedTable(
      page([
        ['Cell 1', '12'],
        ['Total', '42'],
        ['Cell 2', '30'],
      ]),
    );
    expect(names(table.rows)).toEqual(['Cell 1', 'Cell 2']);
    expect(table.total?.map((c) => c.text)).toEqual(['Total', '42']);
  });

  it('two total rows: both leave the rows, the last one wins', () => {
    const table = printedTable(
      page([
        ['total', '40'],
        ['Cell 1', '12'],
        ['Plant Total', '42'],
      ]),
    );
    expect(names(table.rows)).toEqual(['Cell 1']);
    expect(table.total?.map((c) => c.text)).toEqual(['Plant Total', '42']);
  });

  it('no total row → no total; a word that only starts with "total" stays a row', () => {
    expect(printedTable(page([['Cell 1', '12']])).total).toBeUndefined();
    const table = printedTable(
      page([
        ['Cell 1', '12'],
        ['Totalizer line', '5'],
        ['TOTAL', '17'],
      ]),
    );
    expect(names(table.rows)).toEqual(['Cell 1', 'Totalizer line']);
    expect(table.total?.map((c) => c.text)).toEqual(['TOTAL', '17']);
  });
});
