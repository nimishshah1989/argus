// @vitest-environment node
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DataTable, MAX_PAGE_ROWS } from '../ui/elements/index.js';
import { LOG_COLUMNS, type LogRow, TABLE_LABELS, logPage } from './elements-data.js';

/** A list that can pass 200 rows pages on the server: the table is driven by what the fetch answers, a page at a time. */
const draw = async (page: number, filter = '') => {
  const answer = await logPage({ page, filter, pageSize: MAX_PAGE_ROWS });
  return {
    answer,
    html: renderToStaticMarkup(
      createElement(DataTable<LogRow>, {
        columns: LOG_COLUMNS,
        rows: answer.rows,
        rowKey: (r) => String(r.id),
        total: answer.total,
        page,
        pageSize: MAX_PAGE_ROWS,
        labels: TABLE_LABELS,
        onSort: () => {},
        onPage: () => {},
      }),
    ),
  };
};

describe('the server-paged table', () => {
  it('paints the first 50 of 1,343 and offers the next page', async () => {
    const { html } = await draw(0);
    expect(html.match(/<tr/g)).toHaveLength(51);
    expect(html).toContain('1 to 50 of 1,343');
    expect(html).toContain('Page 1 of 27');
  });

  it('paints the short last page with its true range', async () => {
    const { html, answer } = await draw(26);
    expect(answer.rows).toHaveLength(43);
    expect(html).toContain('1,301 to 1,343 of 1,343');
    expect(html).toMatch(/<button[^>]*disabled[^>]*>Next/);
  });

  it('reports the total that matches the filter, not the whole log', async () => {
    const { html } = await draw(0, 'Machine 13');
    expect(html).toContain('of 55');
  });
});
