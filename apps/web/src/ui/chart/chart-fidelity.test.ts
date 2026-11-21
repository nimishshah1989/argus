// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { chartOption } from './chart-option.js';
import { chartRoom, labelPlan, sidePlan, tickWidth } from './chart-labels.js';
import type { Palette } from './chart-palette.js';
import type { ChartSpec } from './chart-spec.js';

const palette: Palette = {
  series: ['#acc', '#neu', '#s3'],
  axis: '#ax',
  grid: '#gr',
  font: 'x',
  meanings: { loss: '#loss', planned: '#plan', gain: '#gain' },
  surface: '#panel',
};

type Series = { name?: string; color?: string; data?: unknown; itemStyle?: { decal?: unknown } };
type Axis = {
  data?: string[];
  inverse?: boolean;
  nameGap?: number;
  axisLabel?: { interval?: number; rotate?: number; width?: number; formatter?: string };
};
type View = {
  series?: Series[];
  xAxis?: Axis;
  yAxis?: Axis;
  grid?: { left?: number };
};
const view = (spec: ChartSpec) => chartOption(spec, palette) as unknown as View;

const NAMES = [
  'Turning Center',
  'Vertical Machining Center',
  'Vertical Double Column Machining Center',
  'Cnc Sliding Head  Automatic Lathe',
  'Horizontal Machining Center',
  'CAM Profile Machine',
  'Vertical Turning Lathe',
  'Turnmill',
  'Cylinderical rotary Grinding',
  'CNC Surface Grinding',
  'CNC Angular Grinding',
  'CNC Internal Grinding',
  'Centerless Grinding Machine',
  'WaterJet CNC',
];
const bar = (over: object = {}): ChartSpec =>
  ({
    kind: 'bar',
    title: 'T',
    categoryLabel: 'Category',
    categories: NAMES,
    series: [{ name: 'BD Hrs', values: NAMES.map((_, i) => 100 - i) }],
    ...over,
  }) as ChartSpec;

describe('series colours by meaning', () => {
  const two = (a: 'loss' | 'planned' | 'neutral' | undefined, b: 'loss' | 'planned' | 'gain') =>
    ({
      kind: 'bar',
      title: 'T',
      categoryLabel: 'Cell',
      categories: ['Cell 1'],
      series: [
        { name: 'BD %', values: [1], meaning: a },
        { name: 'PM %', values: [1], meaning: b },
      ],
      legend: true,
    }) as ChartSpec;

  it('draws a loss series in the loss colour and a planned one in the planned colour', () => {
    const out = view(two('loss', 'planned'));
    expect(out.series?.map((s) => s.color)).toEqual(['#loss', '#plan']);
  });

  it('keeps the palette slot for a neutral series or one with no meaning', () => {
    expect(view(two('neutral', 'gain')).series?.map((s) => s.color)).toEqual(['#acc', '#gain']);
    expect(view(two(undefined, 'gain')).series?.[0]?.color).toBe('#acc');
  });

  it('keeps the palette slot in a palette that carries no meaning colours', () => {
    const plain = chartOption(two('loss', 'planned'), { ...palette, meanings: undefined });
    expect((plain as unknown as View).series?.map((s) => s.color)).toEqual(['#acc', '#neu']);
  });

  it('stripes a planned bar so it differs from a loss bar in pattern as well as hue', () => {
    const out = view(two('loss', 'planned'));
    expect(out.series?.[0]?.itemStyle?.decal).toBeUndefined();
    expect(out.series?.[1]?.itemStyle?.decal).toMatchObject({ color: '#panel' });
  });

  it('draws a planned line dashed with triangle marks and a loss line solid with round ones', () => {
    const spec = {
      kind: 'line',
      title: 'T',
      categoryLabel: 'Month',
      categories: ['Jan', 'Feb'],
      series: [
        { name: 'BD Hrs', values: [1, 2], meaning: 'loss' },
        { name: 'PM Hrs', values: [1, 2], meaning: 'planned' },
      ],
      legend: true,
    } as ChartSpec;
    const out = chartOption(spec, palette) as unknown as {
      series: {
        color: string;
        symbol: string;
        lineStyle: { type: string };
        endLabel: { show: boolean };
      }[];
    };
    expect(out.series.map((s) => [s.color, s.symbol, s.lineStyle.type])).toEqual([
      ['#loss', 'circle', 'solid'],
      ['#plan', 'triangle', 'dashed'],
    ]);
    // The legend names the lines: an end label would print over the last point.
    expect(out.series.map((s) => s.endLabel.show)).toEqual([false, false]);
  });

  it('names a legend-free line at its end', () => {
    const out = chartOption(
      {
        kind: 'line',
        title: 'T',
        categoryLabel: 'Month',
        categories: ['Jan'],
        series: [{ name: 'Hours', values: [1] }],
      },
      palette,
    ) as unknown as { series: { endLabel: { show: boolean } }[] };
    expect(out.series[0]?.endLabel.show).toBe(true);
  });
});

describe('a ranking of categories', () => {
  const ranked = bar({ horizontal: true, highlight: 3 });

  it('reads from the top down, the first three in the accent and the rest in the neutral slot', () => {
    const out = view(ranked);
    expect(out.yAxis?.inverse).toBe(true);
    const colours = (out.series?.[0]?.data as { itemStyle: { color: string } }[]).map(
      (d) => d.itemStyle.color,
    );
    expect(colours.slice(0, 3)).toEqual(['#acc', '#acc', '#acc']);
    expect(new Set(colours.slice(3))).toEqual(new Set(['#neu']));
  });

  it('prints every category name on its own row', () => {
    const out = view(ranked);
    expect(out.yAxis?.data).toEqual(NAMES);
    expect(out.yAxis?.axisLabel?.interval).toBe(0);
  });
});

describe('every category label is drawn', () => {
  it('never skips a label, on a vertical chart or a line', () => {
    expect(view(bar()).xAxis?.axisLabel?.interval).toBe(0);
    const line = { ...bar(), kind: 'line' } as ChartSpec;
    expect(view(line).xAxis?.axisLabel?.interval).toBe(0);
  });

  it('lays labels flat when they fit, tilts them when they do not, and scrolls when 45 degrees is still too tight', () => {
    expect(labelPlan(['Jan', 'Feb', 'Mar'], 600)).toMatchObject({ rotate: 0, room: 0 });
    const cells = Array.from({ length: 9 }, (_, i) => `Cell ${i + 1}`);
    expect(labelPlan(cells, 1000).rotate).toBe(0);
    const tilted = labelPlan(NAMES, 700);
    expect(tilted.rotate).toBe(45);
    expect(tilted.room).toBeGreaterThan(150);
    expect(tilted.scrollWidth).toBeUndefined();
    const many = Array.from({ length: 40 }, (_, i) => `Machine number ${i}`);
    expect(labelPlan(many, 320).scrollWidth).toBeGreaterThan(320);
  });

  it('tilts a vertical chart through the axis and makes the box taller for the tilted names', () => {
    const wide = chartOption(bar(), { ...palette, width: 700 }) as unknown as View;
    expect(wide.xAxis?.axisLabel?.rotate).toBe(45);
    expect(chartRoom(bar(), 700).height).toBeGreaterThan(300);
  });

  it('makes a horizontal chart tall enough for a row a name, and wraps names that would crowd out the bars', () => {
    const horizontal = bar({ horizontal: true });
    expect(chartRoom(horizontal, 1000).height).toBeGreaterThanOrEqual(14 * 24);
    expect(sidePlan(NAMES, 1000).wrap).toBeUndefined();
    const narrow = sidePlan(NAMES, 360);
    expect(narrow.wrap).toBe(144);
    expect(narrow.lines).toBeGreaterThan(1);
    expect(chartRoom(horizontal, 360).height).toBeGreaterThan(chartRoom(horizontal, 1000).height);
    const out = chartOption(horizontal, { ...palette, width: 360 }) as unknown as View;
    expect(out.yAxis?.axisLabel?.width).toBe(144);
  });
});

describe('the value axis title clears the tick numbers', () => {
  it('puts the title further out for wider tick numbers', () => {
    const titled = (top: number) =>
      view(bar({ valueLabel: 'BD Hrs', series: [{ name: 'BD Hrs', values: [top] }] })).yAxis
        ?.nameGap ?? 0;
    expect(titled(1057.79)).toBeGreaterThan(titled(6.15));
    expect(titled(1057.79)).toBeGreaterThanOrEqual(tickWidth(1057.79) + 10);
  });

  it('makes room beside the plot for the title, and prints a percent unit on the axis numbers', () => {
    const out = view(bar({ valueLabel: 'BD %', unit: '%' }));
    expect(out.grid?.left).toBeGreaterThan(8);
    expect(out.yAxis?.axisLabel?.formatter).toBe('{value}%');
    expect(tickWidth(1.4, '%')).toBeGreaterThan(tickWidth(1.4));
  });
});
