import { describe, expect, it } from 'vitest';
import { splitTotal, type PrintedCell } from '../printed-table.js';

const rowsOf = (rows: string[][]): PrintedCell[][] =>
  rows.map((r) => r.map((text) => ({ text, sort: text, chips: [] })));
const names = (rows: PrintedCell[][]) => rows.map((r) => r[0]?.text);

describe('printed tables: total footer edges (ADR 0041, was ticket 689)', () => {
  it('a "Total" row in the middle leaves the rows and becomes the total', () => {
    const split = splitTotal(
      rowsOf([
        ['Cell 1', '12'],
        ['Total', '42'],
        ['Cell 2', '30'],
      ]),
    );
    expect(names(split.rows)).toEqual(['Cell 1', 'Cell 2']);
    expect(split.total?.map((c) => c.text)).toEqual(['Total', '42']);
  });

  it('two total rows: both leave the rows, the last one wins', () => {
    const split = splitTotal(
      rowsOf([
        ['total', '40'],
        ['Cell 1', '12'],
        ['Plant Total', '42'],
      ]),
    );
    expect(names(split.rows)).toEqual(['Cell 1']);
    expect(split.total?.map((c) => c.text)).toEqual(['Plant Total', '42']);
  });

  it('no total row → no total; a word that only starts with "total" stays a row', () => {
    expect(splitTotal(rowsOf([['Cell 1', '12']])).total).toBeUndefined();
    const split = splitTotal(
      rowsOf([
        ['Cell 1', '12'],
        ['Totalizer line', '5'],
        ['TOTAL', '17'],
      ]),
    );
    expect(names(split.rows)).toEqual(['Cell 1', 'Totalizer line']);
    expect(split.total?.map((c) => c.text)).toEqual(['TOTAL', '17']);
  });

  it('an empty table stays empty with no total', () => {
    expect(splitTotal([])).toEqual({ rows: [] });
  });
});
