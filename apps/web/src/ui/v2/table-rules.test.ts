// @vitest-environment node
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import '../../i18n/index.js';
import { DataTable, type Column } from './data-table.js';
import { HOURS, WORDS, hoursColumn, nameColumn, type Hours } from './insight-fixture.js';
import { PagedTable } from './paged-table.js';
import { SMALL_TABLE, isSmall } from './table-rules.js';

const table = (rows: Hours[], extra: object = {}) =>
  renderToStaticMarkup(
    h(DataTable<Hours>, {
      rows,
      rowKey: (r) => r.name,
      columns: [nameColumn, hoursColumn(false)],
      filters: [],
      text: (r) => r.name,
      words: WORDS,
      ...extra,
    }),
  );
const hasSearch = (html: string) => html.includes('type="search"');

describe('small tables, totals, cell status (ADR 0036 R13, R14; ticket 687)', () => {
  it('a table is small under 10 rows', () => {
    expect(SMALL_TABLE).toBe(10);
    expect(isSmall(9)).toBe(true);
    expect(isSmall(10)).toBe(false);
  });

  it('a 9-row table has no search box and no pager', () => {
    const html = table(HOURS.slice(0, 9));
    expect(hasSearch(html)).toBe(false);
    expect(html).not.toContain('1–9 of 9');
  });

  it('draws the total as the footer, never as a body row', () => {
    const html = table(HOURS, { total: ['Plant total', '130.0 h'] });
    const body = html.slice(html.indexOf('<tbody'), html.indexOf('</tbody>'));
    const foot = html.slice(html.indexOf('<tfoot'), html.indexOf('</tfoot>'));
    expect(html).toContain('<tfoot');
    expect(foot).toContain('Plant total');
    expect(foot).toContain('130.0 h');
    expect(body).not.toContain('130.0 h');
  });

  it('a cell with a status wears it', () => {
    const status: Column<Hours> = {
      ...hoursColumn(false),
      status: (r) => (r.hours > 20 ? 'bad' : 'good'),
    };
    const html = table(HOURS, { columns: [nameColumn, status] });
    expect(html.match(/data-status="bad"/g)?.length).toBe(3);
    expect(html.match(/data-status="good"/g)?.length).toBe(7);
  });

  it('a paged table with fewer than 10 rows in all has no pager', () => {
    const paged = (total: number) =>
      renderToStaticMarkup(
        h(PagedTable<Hours>, {
          rows: HOURS.slice(0, Math.min(total, 10)),
          rowKey: (r) => r.name,
          columns: [nameColumn],
          filters: [],
          chip: '',
          onChip: () => {},
          page: 1,
          total,
          onPage: () => {},
          loading: false,
          words: { ...WORDS, page: 'Page {page}', loading: 'Loading' },
          onOpen: () => {},
        }),
      );
    expect(paged(9)).not.toContain('1–9 of 9');
    expect(paged(10)).toContain('1–10 of 10');
  });
});
