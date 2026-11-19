// @vitest-environment node
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { HeatGrid } from './heat-grid.js';
import { KpiTile } from './kpi-tile.js';

const grid = (extra: Record<string, unknown> = {}) =>
  renderToStaticMarkup(
    createElement(HeatGrid, {
      label: 'Hours lost',
      rows: ['TMC-2', 'TC-5'],
      columns: ['Jan', 'Feb'],
      columnNames: ['January', 'February'],
      rowHeader: 'Machine',
      values: [
        [0, 12],
        [5, undefined],
      ],
      format: (v: number) => (v <= 0 ? '' : String(v)),
      ...extra,
    }),
  );

describe('a heat grid that answers the pointer', () => {
  it('keeps the long month names and the machine heading for a screen reader', () => {
    const out = grid();
    expect(out).toContain('January');
    expect(out).toContain('Machine');
  });
  it('keeps a blank square readable as its number and prints a dash for no value', () => {
    const out = grid();
    expect(out).toContain('<span class="sr-only">0</span>');
    expect(out).toContain('—');
  });
  it('lights the rows and the column it is told to', () => {
    const out = grid({ link: { onPoint: () => {}, column: 1, rows: ['TC-5'] } });
    expect(out.match(/<tr data-link/g)).toHaveLength(1);
    expect(out.match(/data-on/g)?.length).toBeGreaterThanOrEqual(3);
  });
  it('gives the squares one tab stop when it answers the pointer, none when it does not', () => {
    expect(grid()).not.toContain('tabindex="0" class="el-pop');
    const linked = grid({ link: { onPoint: () => {} } });
    expect(linked.match(/<td[^>]*tabindex="0"/g)).toHaveLength(1);
    expect(linked.match(/<td[^>]*tabindex="-1"/g)).toHaveLength(3);
  });
});

describe('a figure tile with its own tags and detail', () => {
  const tile = renderToStaticMarkup(
    createElement(KpiTile, {
      label: 'Breakdowns',
      value: 1279,
      format: (n: number) => String(Math.round(n)),
      note: 'Year to date',
      tags: [{ tone: 'bad', word: 'Worsening' }],
      detail: createElement('span', null, '21 more than in Sep'),
      trend: { values: [1, null, 3], label: 'Breakdowns by month', partial: true, wide: true },
      testId: 'kpi-x',
      valueTestId: 'kpi-x-value',
      onOpen: () => {},
    }),
  );
  it('prints the figure alone under its own handle, then the note, tags and detail', () => {
    expect(tile).toContain('data-testid="kpi-x"');
    expect(tile).toContain('<span data-testid="kpi-x-value">1279</span>');
    expect(tile.indexOf('Year to date')).toBeLessThan(tile.indexOf('Worsening'));
    expect(tile.indexOf('Worsening')).toBeLessThan(tile.indexOf('21 more than in Sep'));
  });
  it('draws the line with its words', () => {
    expect(tile).toContain('aria-label="Breakdowns by month"');
  });
});
