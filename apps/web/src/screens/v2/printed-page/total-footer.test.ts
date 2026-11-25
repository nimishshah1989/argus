// @vitest-environment node
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import '../../../i18n/index.js';
import type { PageTable } from '../../analytics/page-content.js';
import { PrintedDataTable } from '../../../ui/v2/domain/printed-table.js';
import { printedTable } from './table.js';

const page = (rows: string[][]): PageTable => ({
  title: 'Downtime by cell',
  header: ['Cell', 'Hours'],
  rows,
  rowCount: rows.length,
  truncated: false,
});
const WORDS = { title: 'Table', search: 'Search', showing: '', noResults: 'None', open: 'Open' };

describe('printed tables: PLANT TOTAL is the footer (ADR 0036 R14; ticket 689)', () => {
  it('takes the PLANT TOTAL row out of the rows and makes it the total', () => {
    const table = printedTable(
      page([
        ['Cell 1', '12'],
        ['Cell 2', '30'],
        ['PLANT TOTAL', '42'],
      ]),
    );
    expect(table.rows.map((r) => r[0]?.text)).toEqual(['Cell 1', 'Cell 2']);
    expect(table.total?.map((c) => c.text)).toEqual(['PLANT TOTAL', '42']);
  });

  it('the printed table draws its total in the footer, not the body', () => {
    const table = printedTable(
      page([
        ['Cell 1', '12'],
        ['Cell 2', '30'],
        ['PLANT TOTAL', '42'],
      ]),
    );
    const html = renderToStaticMarkup(h(PrintedDataTable, { table, words: WORDS }));
    const body = html.slice(html.indexOf('<tbody'), html.indexOf('</tbody>'));
    const foot = html.slice(html.indexOf('<tfoot'), html.indexOf('</tfoot>'));
    expect(html).toContain('<tfoot');
    expect(foot).toContain('PLANT TOTAL');
    expect(body).not.toContain('PLANT TOTAL');
  });
});
