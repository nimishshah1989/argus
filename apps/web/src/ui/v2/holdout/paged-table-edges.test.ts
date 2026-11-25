// @vitest-environment node
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import '../../../i18n/index.js';
import { HOURS, WORDS, nameColumn, type Hours } from '../insight-fixture.js';
import { PagedTable, type SelectFilter } from '../paged-table.js';

const select = (key: string, value: string): SelectFilter => ({
  key,
  label: key,
  all: 'All',
  value,
  options: ['A', 'B'],
  onChange: () => {},
});

const paged = (total: number | undefined, extra: object = {}) =>
  renderToStaticMarkup(
    h(PagedTable<Hours>, {
      rows: HOURS.slice(0, Math.min(total ?? 10, 10)),
      rowKey: (r) => r.name,
      columns: [nameColumn],
      filters: [],
      chip: '',
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

describe('a filtered paged table keeps its count: edges (ticket 757)', () => {
  it('a blank search is no filter', () => {
    expect(paged(5, { query: '   ' })).not.toContain('1–5 of 5');
  });

  it('the all chip, by key all or empty, is no filter', () => {
    expect(paged(5, { chip: 'all' })).not.toContain('1–5 of 5');
    expect(paged(5, { chip: '' })).not.toContain('1–5 of 5');
  });

  it('any one select set is a filter, even when the others are all', () => {
    expect(paged(2, { selects: [select('cell', ''), select('shift', 'B')] })).toContain('1–2 of 2');
  });

  it('a filtered list of 10 or more pages as before', () => {
    const html = paged(25, { query: 'press' });
    expect(html).toContain('1–10 of 25');
  });

  it('a list the server does not count keeps its page line, filtered or not', () => {
    expect(paged(undefined, { hasNext: true })).toContain('Page 1');
    expect(paged(undefined, { hasNext: true, query: 'x' })).toContain('Page 1');
  });

  it('an unfiltered list of exactly 10 keeps its pager', () => {
    expect(paged(10)).toContain('1–10 of 10');
  });
});
