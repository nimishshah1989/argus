// @vitest-environment node
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import '../../i18n/index.js';
import { HeatMatrix, type HeatCell, type HeatMatrixData } from './domain/heat-matrix.js';
import { dropEmptyColumns, mostlyEmpty } from './heat-rules.js';

const cell = (n: number | null): HeatCell => ({
  text: n === null ? '–' : String(n),
  level: n === null ? null : 3,
  name: n === null ? 'no hours' : `${n} h`,
});
const matrix = (months: string[], rows: [string, (number | null)[]][]): HeatMatrixData => ({
  id: 'm',
  title: 'Hours by month',
  header: { first: 'Machine', cells: months, plain: [] },
  rows: rows.map(([head, cells]) => ({ head, cells: cells.map(cell), plain: [] })),
});
const render = (m: HeatMatrixData) =>
  renderToStaticMarkup(
    createElement(HeatMatrix, { matrix: m, words: { low: 'less', high: 'more' } }),
  );

describe('Heat grid rules (ADR 0036 R22)', () => {
  it('drops a month that is empty in every row', () => {
    expect(
      dropEmptyColumns(
        ['Jan', 'Feb', 'Mar'],
        [
          [4, null, 2],
          [1, undefined, null],
        ],
      ),
    ).toEqual({
      columns: ['Jan', 'Mar'],
      rows: [
        [4, 2],
        [1, null],
      ],
    });
  });

  it('calls a grid mostly empty when over half its cells are empty', () => {
    expect(
      mostlyEmpty([
        [1, null, null],
        [null, 2, null],
      ]),
    ).toBe(true);
    expect(
      mostlyEmpty([
        [1, 2, null],
        [null, 3, 4],
      ]),
    ).toBe(false);
  });

  it('never draws an all-empty month', () => {
    const html = render(
      matrix(
        ['Jan', 'Feb', 'Mar'],
        [
          ['VMC-1', [4, null, 2]],
          ['VMC-2', [1, null, 3]],
        ],
      ),
    );
    expect(html).toContain('>Jan<');
    expect(html).not.toContain('>Feb<');
  });

  it('draws a mostly-empty grid as a ranked list of every row', () => {
    const html = render(
      matrix(
        ['Jan', 'Feb', 'Mar', 'Apr'],
        [
          ['VMC-1', [4, null, null, null]],
          ['VMC-2', [null, 9, null, null]],
          ['VMC-3', [null, null, 1, null]],
        ],
      ),
    );
    expect(html).not.toContain('data-heat="matrix"');
    for (const head of ['VMC-1', 'VMC-2', 'VMC-3']) expect(html).toContain(head);
  });
});
