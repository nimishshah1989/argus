// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { ChartSpec } from '../../../ui/chart/chart-spec.js';
import { realReply } from '../figures/real-reply.js';
import { realT } from '../printed-page/test-support.js';
import { shiftKpisModel } from './adapter.js';
import { paretoRows } from './sweep.js';

/** Sweep #706 (ADR 0043 §2), batch D: every Pareto on Shift-calendar KPIs as ranked-bar rows. */

const mixed: ChartSpec = {
  kind: 'mixed',
  title: 'BD hours by machine — Pareto',
  categoryLabel: 'Machine',
  categories: ['TMC-2', 'TC-5'],
  bars: [{ name: 'BD hours', values: [307.58, 175.08] }],
  line: { name: 'Cumulative %', values: [10.07, 15.8] },
};

describe('paretoRows', () => {
  it('turns the engine’s mixed Pareto into one row per category, bars only, exact text', () => {
    expect(paretoRows(mixed)).toEqual([
      { key: 'TMC-2', label: 'TMC-2', value: 307.58, valueText: '307.58' },
      { key: 'TC-5', label: 'TC-5', value: 175.08, valueText: '175.08' },
    ]);
  });

  it('reads a pareto spec’s one series the same way', () => {
    const spec: ChartSpec = {
      kind: 'pareto',
      title: 'BD hours by shift — Pareto',
      categoryLabel: 'Shift',
      categories: ['1', '2'],
      series: [{ name: 'BD hours', values: [2021.1, 1031.12] }],
      cumulativeLabel: 'Cumulative %',
    };
    expect(paretoRows(spec)).toEqual([
      { key: '1', label: '1', value: 2021.1, valueText: '2,021.1' },
      { key: '2', label: '2', value: 1031.12, valueText: '1,031.12' },
    ]);
  });

  it('leaves any other chart to its chart card', () => {
    const bar: ChartSpec = {
      kind: 'bar',
      title: 'Hours',
      categoryLabel: 'Machine',
      categories: ['TMC-2'],
      series: [{ name: 'BD hours', values: [3] }],
    };
    expect(paretoRows(bar)).toBeNull();
  });

  it('gives rows for every chart of the real breakdown map, one per category with a value', () => {
    const model = shiftKpisModel(realReply(), realT)!;
    const charts = model.sections.flatMap((s) => s.charts);
    expect(charts.length).toBeGreaterThan(0);
    for (const chart of charts) {
      const rows = paretoRows(chart.spec);
      expect(rows, chart.spec.title).not.toBeNull();
      expect(rows!.length).toBeGreaterThan(0);
    }
  });
});
