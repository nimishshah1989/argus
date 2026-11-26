// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { ChartSpec } from '../../../ui/chart/chart-spec.js';
import { realReply } from '../figures/real-reply.js';
import { realT } from '../printed-page/test-support.js';
import { shiftKpisModel } from './adapter.js';
import { halfBars, rankRows } from '../../../ui/v2/ranked-bars.js';
import { paretoRows } from './sweep.js';

/** Sweep 706 (ADR 0043 §2), batch D: every Pareto on Shift-calendar KPIs as ranked-bar rows. */

const mixed: ChartSpec = {
  kind: 'mixed',
  title: 'BD hours by machine — Pareto',
  categoryLabel: 'Machine',
  categories: ['TMC-2', 'TC-5'],
  bars: [{ name: 'BD hours', values: [307.58, 175.08] }],
  line: { name: 'Cumulative %', values: [63.73, 100] },
};

const REST = 'All the others';

describe('paretoRows', () => {
  it('turns the engine’s mixed Pareto into one row per category, bars only, exact text', () => {
    expect(paretoRows(mixed, REST)).toEqual([
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
    expect(paretoRows(spec, REST)).toEqual([
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
    expect(paretoRows(bar, REST)).toBeNull();
  });

  it('gives rows for every chart of the real breakdown map, one per category with a value', () => {
    const model = shiftKpisModel(realReply(), realT)!;
    const charts = model.sections.flatMap((s) => s.charts);
    expect(charts.length).toBeGreaterThan(0);
    for (const chart of charts) {
      const rows = paretoRows(chart.spec, REST);
      expect(rows, chart.spec.title).not.toBeNull();
      expect(rows!.length).toBeGreaterThan(0);
    }
  });

  it('adds a rest row when the engine cut the machines at 15, so shares and the half match the whole plant', () => {
    // 20 machines: M1 40 h, M2..M20 10 h each, 230 h in all. The engine prints the top 15 (180 h) and a cumulative
    // line over all 230 h, ending at 78.26 %. Half the plant's hours (115 h) is first reached by 9 machines.
    const categories = Array.from({ length: 15 }, (_, i) => `M${i + 1}`);
    const values = categories.map((_, i) => (i === 0 ? 40 : 10));
    const line = [
      17.39, 21.74, 26.09, 30.43, 34.78, 39.13, 43.48, 47.83, 52.17, 56.52, 60.87, 65.22, 69.57,
      73.91, 78.26,
    ];
    const spec: ChartSpec = {
      kind: 'mixed',
      title: 'BD hours by machine — Pareto',
      categoryLabel: 'Machine',
      categories,
      bars: [{ name: 'BD hours', values }],
      line: { name: 'Cumulative %', values: line },
    };
    const rows = paretoRows(spec, REST)!;
    expect(rows).toHaveLength(16);
    expect(rows[15]).toMatchObject({ key: '__rest', label: REST, rest: true, valueText: '50' });
    expect(rows[15]!.value).toBeCloseTo(50, 1);
    const ranked = rankRows(rows);
    // Each machine's share is the engine's own cumulative step.
    ranked.slice(0, 15).forEach((bar, i) => {
      expect(bar.share * 100, bar.key).toBeCloseTo(line[i]! - (line[i - 1] ?? 0), 1);
    });
    expect(
      halfBars(
        ranked.map((r) => r.value),
        ranked.map((r) => !!r.rest),
      ),
    ).toBe(9);
  });

  it('adds no rest row when the cumulative line ends at 100', () => {
    expect(paretoRows(mixed, REST)!.some((r) => r.rest)).toBe(false);
  });
});
