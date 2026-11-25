// @vitest-environment node
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import '../../i18n/index.js';
import { DataTable } from './data-table.js';
import { applyFilters, optionsOf, type TableSelect } from './table-filters.js';

type Stop = { id: string; cell: string; category: string; shift: string };
const STOPS: Stop[] = [
  { id: 's1', cell: 'Cell 2', category: 'Electrical', shift: 'A' },
  { id: 's2', cell: 'Cell 10', category: 'Mechanical', shift: 'B' },
  { id: 's3', cell: 'Cell 2', category: 'Mechanical', shift: 'A' },
  { id: 's4', cell: 'Cell 1', category: 'Electrical', shift: 'B' },
  { id: 's5', cell: 'Cell 2', category: 'Electrical', shift: 'B' },
];
const cell: TableSelect<Stop> = { key: 'cell', label: 'Cell', value: (r) => r.cell };
const category: TableSelect<Stop> = {
  key: 'category',
  label: 'Category',
  value: (r) => r.category,
};
const shift: TableSelect<Stop> = { key: 'shift', label: 'Shift', value: (r) => r.shift };
const ids = (rows: Stop[]) => rows.map((r) => r.id);

describe('table filters (ADR 0036 R16; ticket 688)', () => {
  it('keeps the rows every chosen filter keeps, in their order', () => {
    const selects = [cell, category, shift];
    expect(ids(applyFilters(STOPS, selects, { cell: 'Cell 2' }))).toEqual(['s1', 's3', 's5']);
    expect(ids(applyFilters(STOPS, selects, { cell: 'Cell 2', category: 'Electrical' }))).toEqual([
      's1',
      's5',
    ]);
    expect(
      ids(applyFilters(STOPS, selects, { cell: 'Cell 2', category: 'Electrical', shift: 'A' })),
    ).toEqual(['s1']);
    expect(applyFilters(STOPS, selects, { cell: 'Cell 9' })).toEqual([]);
  });

  it('offers each distinct value once, in natural order', () => {
    expect(optionsOf(STOPS, cell)).toEqual(['Cell 1', 'Cell 2', 'Cell 10']);
    expect(optionsOf(STOPS, shift)).toEqual(['A', 'B']);
  });

  it('draws a dropdown per select with its options', () => {
    const html = renderToStaticMarkup(
      h(DataTable<Stop>, {
        rows: STOPS,
        rowKey: (r) => r.id,
        columns: [{ key: 'cell', label: 'Cell', cell: (r) => r.cell }],
        filters: [],
        text: (r) => r.id,
        words: { title: 'Stops', search: 'Search', showing: '', noResults: 'None', open: 'Open' },
        selects: [cell, shift],
      }),
    );
    expect(html.match(/<select/g)?.length).toBe(2);
    for (const v of ['Cell 1', 'Cell 2', 'Cell 10', 'A', 'B'])
      expect(html).toContain(`<option value="${v}">`);
  });
});
