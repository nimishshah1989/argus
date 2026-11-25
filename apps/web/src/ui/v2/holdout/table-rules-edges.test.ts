// @vitest-environment node
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import '../../../i18n/index.js';
import { DataTable } from '../data-table.js';
import { HOURS, WORDS, hoursColumn, nameColumn, type Hours } from '../insight-fixture.js';
import { isSmall } from '../table-rules.js';

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

describe('small tables, totals, cell status: edges (ticket 687)', () => {
  it('judges small on all rows, not the filtered ones', () => {
    const over20 = [{ key: 'miss', label: 'Over 20 h', test: (r: Hours) => r.hours > 20 }];
    // 10 rows in all, 3 on show: still a full table. 9 rows in all: small, whatever the chip.
    const ten = table(HOURS, { filters: over20 });
    expect(hasSearch(ten)).toBe(true);
    expect(ten).toContain('1–3 of 3');
    expect(hasSearch(table(HOURS.slice(0, 9), { filters: over20 }))).toBe(false);
  });

  it('exactly 10 rows is not small and shows search and pager; 0 rows is small', () => {
    expect(isSmall(10)).toBe(false);
    expect(isSmall(0)).toBe(true);
    const html = table(HOURS);
    expect(hasSearch(html)).toBe(true);
    expect(html).toContain('1–10 of 10');
  });

  it('the total is never ranked, sorted or folded with the rows', () => {
    const total = ['Plant total', '999.0 h'];
    for (const extra of [
      { columns: [nameColumn, hoursColumn(true)], total },
      { initialSort: { key: 'hours', dir: 'desc' }, total },
    ]) {
      const html = table(HOURS, extra);
      const body = html.slice(html.indexOf('<tbody'), html.indexOf('</tbody>'));
      const foot = html.slice(html.indexOf('<tfoot'), html.indexOf('</tfoot>'));
      expect(body).not.toContain('999.0 h');
      expect(foot).toContain('999.0 h');
      expect(html.match(/999\.0 h/g)?.length).toBe(1);
    }
  });

  it('no total → no footer; a column without status → no attribute on its cells', () => {
    const status = { ...hoursColumn(false), status: () => 'watch' as const };
    const html = table(HOURS, { columns: [nameColumn, status] });
    expect(html).not.toContain('<tfoot');
    expect(html.match(/data-status=/g)?.length).toBe(10);
  });
});
