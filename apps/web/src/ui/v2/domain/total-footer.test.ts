// @vitest-environment node
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import '../../../i18n/index.js';
import {
  PrintedDataTable,
  splitTotal,
  type PrintedCell,
  type PrintedTable,
} from './printed-table.js';

const cell = (text: string): PrintedCell => ({ text, sort: Number(text) || text, chips: [] });
const rowsOf = (rows: string[][]) => rows.map((r) => r.map(cell));
const table = (rows: string[][]): PrintedTable => ({
  title: 'Downtime by cell',
  header: [
    { label: 'Cell', numeric: false },
    { label: 'Hours', numeric: true },
  ],
  rows: rowsOf(rows),
  chips: [],
});
const WORDS = { title: 'Table', search: 'Search', showing: '', noResults: 'None', open: 'Open' };
const ROWS = [
  ['Cell 1', '12'],
  ['Cell 2', '30'],
  ['PLANT TOTAL', '42'],
];

describe('printed tables: PLANT TOTAL is the footer (ADR 0036 R14, ADR 0041)', () => {
  it('takes the PLANT TOTAL row out of the rows and makes it the total', () => {
    const split = splitTotal(rowsOf(ROWS));
    expect(split.rows.map((r) => r[0]?.text)).toEqual(['Cell 1', 'Cell 2']);
    expect(split.total?.map((c) => c.text)).toEqual(['PLANT TOTAL', '42']);
  });

  it('the printed table draws its total in the footer, not the body', () => {
    const html = renderToStaticMarkup(h(PrintedDataTable, { table: table(ROWS), words: WORDS }));
    const body = html.slice(html.indexOf('<tbody'), html.indexOf('</tbody>'));
    const foot = html.slice(html.indexOf('<tfoot'), html.indexOf('</tfoot>'));
    expect(html).toContain('<tfoot');
    expect(foot).toContain('PLANT TOTAL');
    expect(body).not.toContain('PLANT TOTAL');
  });
});
