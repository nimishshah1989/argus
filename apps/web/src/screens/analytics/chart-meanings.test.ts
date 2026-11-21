import { describe, expect, it } from 'vitest';
import type { ChartSpec } from '../../ui/chart/use-chart.js';
import { withMeaning } from './chart-meanings.js';

const bar = (values: (number | undefined)[], name = 'BD Hrs'): ChartSpec => ({
  kind: 'bar',
  title: 'T',
  categoryLabel: 'Category',
  categories: ['A', 'B', 'C', 'D'],
  series: [{ name, values }],
});

type Bar = Extract<ChartSpec, { kind: 'bar' }>;

describe('what an engine chart means', () => {
  it('draws A1 breakdown series as a loss and preventive maintenance as planned', () => {
    const two: ChartSpec = {
      kind: 'bar',
      title: 'T',
      categoryLabel: 'Cell',
      categories: ['Cell 1'],
      series: [
        { name: 'BD %', values: [1] },
        { name: 'PM %', values: [2] },
      ],
    };
    const [out] = withMeaning('ch-a1-cell', [two]) as Bar[];
    expect(out?.series.map((s) => s.meaning)).toEqual(['loss', 'planned']);
    expect(out?.unit).toBe('%');
    const [trend] = withMeaning('ch-a1-trend', [{ ...two, kind: 'line' } as ChartSpec]);
    expect(trend?.kind === 'line' && trend.series.map((s) => s.meaning)).toEqual([
      'loss',
      'planned',
    ]);
  });

  it('ranks a by-category chart worst first, horizontal, with the first three marked', () => {
    const [out] = withMeaning('ch-a2-cathrs', [bar([5, 40, undefined, 20])]) as Bar[];
    expect(out?.categories).toEqual(['B', 'D', 'A', 'C']);
    expect(out?.series[0]?.values).toEqual([40, 20, 5, undefined]);
    expect(out?.horizontal).toBe(true);
    expect(out?.highlight).toBe(3);
  });

  it('keeps every number: the ranking is a reordering, nothing more', () => {
    const values = [5, 40, 7, 20];
    const [out] = withMeaning('ch-a3-catmttr', [bar(values, 'MTTR')]) as Bar[];
    expect([...(out?.series[0]?.values ?? [])].sort()).toEqual([...values].sort());
    expect(out?.series[0]?.name).toBe('MTTR');
  });

  it('colours cell charts by what they count: hours lost are a loss, time between failures a gain', () => {
    const [hours] = withMeaning('ch-a2-cellhrs', [bar([1, 2, 3, 4])]) as Bar[];
    expect(hours?.series[0]?.meaning).toBe('loss');
    expect(hours?.highlight).toBeUndefined();
    const [mtbf] = withMeaning('ch-a3-cellmtbf', [bar([1, 2, 3, 4], 'MTBF')]) as Bar[];
    expect(mtbf?.series[0]?.meaning).toBe('gain');
  });

  it('leaves a chart it does not know, and a people count, neutral and in the engine order', () => {
    const plain = bar([1, 2, 3, 4]);
    expect(withMeaning('ch-a4-count', [plain])).toEqual([plain]);
    expect(withMeaning(undefined, [plain])).toEqual([plain]);
  });

  it('marks the bars of a shift Pareto as hours lost and leaves its share line neutral', () => {
    const mixed: ChartSpec = {
      kind: 'mixed',
      title: 'T',
      categoryLabel: 'Machine',
      categories: ['A'],
      bars: [{ name: 'Hours', values: [3] }],
      line: { name: 'Share', values: [100] },
    };
    const [out] = withMeaning('ch-sk-machine', [mixed]);
    expect(out?.kind === 'mixed' && out.bars[0]?.meaning).toBe('loss');
    expect(out?.kind === 'mixed' && out.line?.meaning).toBeUndefined();
  });
});
