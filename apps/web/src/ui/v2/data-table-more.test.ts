// @vitest-environment node
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import '../../i18n/index.js';
import { DataTable } from './data-table.js';

/** Ticket 842: `more` (e.g. "load older") shows only where the loaded rows end: the last page, or the only one. */
const table = (n: number) =>
  renderToStaticMarkup(
    createElement(DataTable<{ id: string }>, {
      rows: Array.from({ length: n }, (_, i) => ({ id: `r${i}` })),
      rowKey: (row) => row.id,
      columns: [{ key: 'id', label: 'Id', cell: (row) => row.id }],
      filters: [],
      text: (row) => row.id,
      words: { title: 'T', search: 'S', showing: '{from}-{to} of {total}', noResults: 'None' },
      more: createElement('button', { type: 'button' }, 'LOAD-OLDER'),
    }),
  );

describe('DataTable more', () => {
  it('is drawn when every row fits on one page', () => {
    expect(table(4)).toContain('LOAD-OLDER');
    expect(table(10)).toContain('LOAD-OLDER');
  });
  it('is not drawn on page 1 of several', () => {
    expect(table(25)).not.toContain('LOAD-OLDER');
  });
});
