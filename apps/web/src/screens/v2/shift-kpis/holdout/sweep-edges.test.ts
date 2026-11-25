// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { ChartSpec } from '../../../../ui/chart/chart-spec.js';
import { paretoRows } from '../sweep.js';

/** Sweep #706, batch D, hidden: Pareto rows at the edges. */

const mixed = (categories: string[], values: (number | undefined)[]): ChartSpec => ({
  kind: 'mixed',
  title: 'Pareto',
  categoryLabel: 'Code',
  categories,
  bars: [{ name: 'BD hours', values }],
  line: { name: 'Cumulative %', values: values.map(() => 50) },
});

describe('paretoRows at the edges', () => {
  it('leaves out a category with no value or a value that is not finite', () => {
    const rows = paretoRows(mixed(['E', 'M', 'X', 'Y'], [5, undefined, Number.NaN, Infinity]));
    expect(rows!.map((r) => r.key)).toEqual(['E']);
  });

  it('is empty for a Pareto with no categories or no bar series', () => {
    expect(paretoRows(mixed([], []))).toEqual([]);
    expect(
      paretoRows({ kind: 'mixed', title: 'P', categoryLabel: 'C', categories: ['A'], bars: [] }),
    ).toEqual([]);
  });

  it('keeps the spec’s order and never re-rounds the engine’s number', () => {
    const rows = paretoRows(mixed(['small', 'big'], [0.125, 123456.789]))!;
    expect(rows.map((r) => [r.key, r.value, r.valueText])).toEqual([
      ['small', 0.125, '0.13'],
      ['big', 123456.789, '1,23,456.79'],
    ]);
    expect(rows.every((r) => r.countText === undefined && r.moneyText === undefined)).toBe(true);
  });

  it('keeps a zero bar, and ignores the running-total line entirely', () => {
    const rows = paretoRows({
      kind: 'mixed',
      title: 'P',
      categoryLabel: 'C',
      categories: ['A', 'B'],
      bars: [{ name: 'BD hours', values: [0, 2] }],
    })!;
    expect(rows.map((r) => r.valueText)).toEqual(['0', '2']);
  });

  it('is null for line, heat map and scatter charts', () => {
    const line: ChartSpec = {
      kind: 'line',
      title: 'L',
      categoryLabel: 'Month',
      categories: ['Jan'],
      series: [{ name: 'h', values: [1] }],
    };
    expect(paretoRows(line)).toBeNull();
    expect(
      paretoRows({
        kind: 'heatmap',
        title: 'H',
        categoryLabel: 'M',
        categories: ['A'],
        series: [{ name: 'Jan', values: [1] }],
      }),
    ).toBeNull();
  });
});
