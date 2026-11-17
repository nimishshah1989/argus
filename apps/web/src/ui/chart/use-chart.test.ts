// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { chartOption, type ChartSpec, type Palette } from './use-chart.js';

const palette: Palette = { series: ['#1', '#2'], axis: '#3', grid: '#4', font: 'x' };

interface SeriesView {
  type?: string;
  name?: string;
  color?: string;
  data?: unknown;
  stack?: string;
  yAxisIndex?: number;
  symbolSize?: number;
  endLabel?: { show?: boolean };
}
interface AxisView {
  type?: string;
  data?: unknown;
  name?: string;
}
interface OptionView {
  series?: SeriesView[];
  xAxis?: AxisView;
  yAxis?: AxisView | AxisView[];
  tooltip?: { formatter?: unknown };
  legend?: unknown;
}

function view(spec: ChartSpec): OptionView {
  return chartOption(spec, palette) as unknown as OptionView;
}

interface PointView {
  symbolSize?: number;
  value?: [number, number];
  name?: string;
  mttr?: number;
}

describe('chartOption', () => {
  it('keeps the bar chart a single primary-coloured bar series on a category axis', () => {
    const spec: ChartSpec = {
      kind: 'bar',
      title: 'Breakdowns by segment',
      categoryLabel: 'Segment',
      categories: ['CNC', 'VMC'],
      series: [{ name: 'Breakdowns', values: [4, 2] }],
    };
    const option = view(spec);
    expect(option.series?.map((s) => s.type)).toEqual(['bar']);
    expect(option.series?.[0]?.name).toBe('Breakdowns');
    expect(option.series?.[0]?.color).toBe('#1');
    expect(option.series?.[0]?.data).toEqual([4, 2]);
    expect(option.xAxis?.type).toBe('category');
    expect(option.xAxis?.data).toEqual(['CNC', 'VMC']);
  });

  it('keeps the line chart on the two series colours with a category axis and end labels', () => {
    const spec: ChartSpec = {
      kind: 'line',
      title: 'Downtime by week',
      categoryLabel: 'Week',
      categories: ['W1', 'W2'],
      series: [
        { name: 'CNC', values: [3, 5] },
        { name: 'Conventional', values: [1, 2] },
      ],
    };
    const option = view(spec);
    expect(option.series?.map((s) => s.type)).toEqual(['line', 'line']);
    expect(option.series?.map((s) => s.color)).toEqual(['#1', '#2']);
    expect(option.series?.map((s) => s.endLabel?.show)).toEqual([true, true]);
    expect(option.xAxis?.type).toBe('category');
    expect(option.xAxis?.data).toEqual(['W1', 'W2']);
  });

  it('draws one scatter series sized per point and titles both axes from the spec', () => {
    const spec: ChartSpec = {
      kind: 'scatter',
      title: 'Bubble chart',
      machineLabel: 'Machine',
      xLabel: 'BD hours',
      yLabel: 'Breakdowns',
      mttrLabel: 'MTTR',
      points: [
        { x: 12.5, y: 3, r: 9, label: 'M-1', mttr: 4.17 },
        { x: 4, y: 1, r: 5, label: 'M-2' },
      ],
    };
    const option = view(spec);
    expect(option.series).toHaveLength(1);
    expect(option.series?.[0]?.type).toBe('scatter');
    const points = option.series?.[0]?.data as PointView[];
    expect(points.map((p) => p.symbolSize)).toEqual([9, 5]);
    expect(points.map((p) => p.value)).toEqual([
      [12.5, 3],
      [4, 1],
    ]);
    expect(option.xAxis?.name).toBe('BD hours');
    expect(option.yAxis && !Array.isArray(option.yAxis) ? option.yAxis.name : undefined).toBe(
      'Breakdowns',
    );
  });

  it('formats the scatter tooltip from the point label and its MTTR', () => {
    const spec: ChartSpec = {
      kind: 'scatter',
      title: 'Bubble chart',
      machineLabel: 'Machine',
      xLabel: 'BD hours',
      yLabel: 'Breakdowns',
      mttrLabel: 'MTTR',
      points: [{ x: 12.5, y: 3, r: 9, label: 'M-1', mttr: 4.17 }],
    };
    const formatter = view(spec).tooltip?.formatter as (params: unknown) => string;
    const text = formatter({ name: 'M-1', data: { mttr: 4.17 } });
    expect(text).toContain('M-1');
    expect(text).toContain('4.17');
    expect(text).toContain('MTTR');
  });

  it('draws the mixed chart as stacked primary-coloured bars plus an accent line on a second axis', () => {
    const spec: ChartSpec = {
      kind: 'mixed',
      title: 'Expansion timeline',
      categoryLabel: 'Year',
      categories: ['2023', '2024'],
      bars: [
        { name: 'VMC', values: [2, 1] },
        { name: 'CNC', values: [1, 3] },
      ],
      line: { name: 'Cumulative Fleet Size', values: [3, 7] },
    };
    const option = view(spec);
    expect(Array.isArray(option.yAxis)).toBe(true);
    expect(option.yAxis).toHaveLength(2);
    expect(option.series).toHaveLength(3);
    const [first, second, line] = option.series ?? [];
    expect(first?.type).toBe('bar');
    expect(second?.type).toBe('bar');
    expect(first?.stack).toBeDefined();
    expect(first?.stack).toBe(second?.stack);
    expect(first?.color).toBe('#1');
    expect(second?.color).toBe('#1');
    expect(line?.type).toBe('line');
    expect(line?.yAxisIndex).toBe(1);
    expect(line?.color).toBe('#2');
    expect(line?.endLabel?.show).toBe(true);
    expect(option.legend).toBeUndefined();
    expect(option.xAxis?.type).toBe('category');
    expect(option.xAxis?.data).toEqual(['2023', '2024']);
  });

  it('draws the mixed chart without a line when the spec has none', () => {
    const spec: ChartSpec = {
      kind: 'mixed',
      title: 'Expansion timeline',
      categoryLabel: 'Year',
      categories: ['2023'],
      bars: [{ name: 'VMC', values: [2] }],
    };
    const option = view(spec);
    expect(option.series?.map((s) => s.type)).toEqual(['bar']);
    expect(option.yAxis).toHaveLength(2);
  });
});
