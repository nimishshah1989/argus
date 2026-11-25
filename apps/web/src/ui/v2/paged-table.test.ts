// @vitest-environment node
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import '../../i18n/index.js';
import { HOURS, WORDS, nameColumn, type Hours } from './insight-fixture.js';
import { PagedTable, type SelectFilter } from './paged-table.js';

const select = (value: string): SelectFilter => ({
  key: 'cell',
  label: 'Cell',
  all: 'All cells',
  value,
  options: ['Press', 'Weld'],
  onChange: () => {},
});

const paged = (total: number, extra: object = {}) =>
  renderToStaticMarkup(
    h(PagedTable<Hours>, {
      rows: HOURS.slice(0, Math.min(total, 10)),
      rowKey: (r) => r.name,
      columns: [nameColumn],
      filters: [{ key: 'all', label: 'All' }],
      chip: 'all',
      onChip: () => {},
      onQuery: () => {},
      page: 1,
      total,
      onPage: () => {},
      loading: false,
      words: { ...WORDS, page: 'Page {page}', loading: 'Loading' },
      onOpen: () => {},
      ...extra,
    }),
  );

describe('a filtered paged table keeps its count (ADR 0036 R13: small is judged on all rows; ticket 757)', () => {
  it('a search that leaves 1 row still says "1–1 of 1"', () => {
    expect(paged(1, { query: 'press' })).toContain('1–1 of 1');
  });

  it('a select that leaves 3 rows still says "1–3 of 3"', () => {
    expect(paged(3, { selects: [select('Press')] })).toContain('1–3 of 3');
  });

  it('a chip other than all that leaves 2 rows still says "1–2 of 2"', () => {
    expect(paged(2, { chip: 'high' })).toContain('1–2 of 2');
  });

  it('a select beside the table (narrowed) that leaves 1 row still says "1–1 of 1"', () => {
    expect(paged(1, { narrowed: true })).toContain('1–1 of 1');
  });

  it('with nothing filtered, under 10 rows in all, there is still no pager', () => {
    expect(paged(4)).not.toContain('1–4 of 4');
    expect(paged(4, { query: '', selects: [select('')] })).not.toContain('1–4 of 4');
    expect(paged(4, { narrowed: false })).not.toContain('1–4 of 4');
  });
});
