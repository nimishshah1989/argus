// @vitest-environment node
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { rootTheme } from '../../gallery/showcase/theme.js';
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
    // Only the pointed-at machine's row is lit, and it is the TC-5 row.
    expect(out.match(/<tr data-link=""/g)).toHaveLength(1);
    expect(out).toMatch(/<tr data-link=""[^>]*><th[^>]*>TC-5/);
    // Only the February header and the February squares carry `data-on`.
    expect(out.match(/<th[^>]*data-on=""/g)).toHaveLength(1);
    expect(out).toMatch(/<th[^>]*data-on=""[^>]*><span aria-hidden="true">Feb</);
    const squares = out.match(/<td[^>]*data-on=""[^>]*>/g) ?? [];
    expect(squares).toHaveLength(2);
    for (const square of squares) expect(square).toContain('data-c="1"');
  });
  it('gives the squares one tab stop when it answers the pointer, none when it does not', () => {
    expect(grid()).not.toMatch(/<td[^>]*tabindex=/);
    const linked = grid({ link: { onPoint: () => {} } });
    expect(linked.match(/<td[^>]*tabindex="0"/g)).toHaveLength(1);
    expect(linked.match(/<td[^>]*tabindex="-1"/g)).toHaveLength(3);
  });
});

describe('who owns the page theme in the gallery', () => {
  it('lets the showcase follow the system when no theme is asked for', () => {
    expect(rootTheme('showcase', null, 'dark')).toBe('dark');
    expect(rootTheme('showcase', 'light', 'dark')).toBe('light');
    expect(rootTheme('showcase', 'dark', 'light')).toBe('dark');
  });
  it('keeps every other view light unless dark is asked for, whatever the system says', () => {
    expect(rootTheme(null, null, 'dark')).toBe('light');
    expect(rootTheme('elements', null, 'dark')).toBe('light');
    expect(rootTheme('elements', 'dark', 'light')).toBe('dark');
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
      trend: {
        values: [1, null, 3],
        label: 'Breakdowns by month',
        partial: true,
        wide: true,
        quiet: true,
      },
      unit: 'h',
      unitBeside: true,
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
  it('keeps a quiet line out of the button name, and a short unit beside the figure', () => {
    expect(tile).not.toContain('Breakdowns by month');
    expect(tile).not.toContain('role="img"');
    expect(tile).toMatch(/<svg[^>]*aria-hidden="true"/);
    expect(tile).not.toContain('block');
    expect(tile).toContain('>\u00a0h</span>');
  });
  it('leaves the default unit markup exactly as it was for every other screen', () => {
    const plain = renderToStaticMarkup(
      createElement(KpiTile, {
        label: 'Downtime',
        value: 12,
        format: (n: number) => String(n),
        unit: 'hours',
      }),
    );
    expect(plain).toContain(
      '12 <span class="block whitespace-nowrap text-footnote font-semibold text-neutral-600 sm:inline">hours</span>',
    );
  });
});
