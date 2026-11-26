// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { chartOption } from './chart-option.js';
import { chartRoom, labelPlan, sidePlan, tickWidth } from './chart-labels.js';
import { strokeOf } from './option-lines.js';
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

  const coloursOf = (spec: ChartSpec) =>
    (view(spec).series?.[0]?.data as { itemStyle: { color: string } }[]).map(
      (d) => d.itemStyle.color,
    );

  it('reads from the top down, the first three in the accent and the rest in the neutral slot', () => {
    expect(view(ranked).yAxis?.inverse).toBe(true);
    const colours = coloursOf(ranked);
    expect(colours.slice(0, 3)).toEqual(['#acc', '#acc', '#acc']);
    expect(new Set(colours.slice(3))).toEqual(new Set(['#neu']));
  });

  it('marks the first three bars in the series meaning when it has one, and the accent only when it has none', () => {
    const lost = bar({
      horizontal: true,
      highlight: 3,
      series: [{ name: 'BD Hrs', values: [9, 8, 7, 6, 5], meaning: 'loss' }],
      categories: ['A', 'B', 'C', 'D', 'E'],
    });
    expect(coloursOf(lost)).toEqual(['#loss', '#loss', '#loss', '#neu', '#neu']);
  });

  it('never marks a bar of nothing, however few bars have a value', () => {
    const few = bar({
      horizontal: true,
      highlight: 3,
      series: [{ name: 'BD Hrs', values: [9, 0, 0, 0] }],
      categories: ['A', 'B', 'C', 'D'],
    });
    expect(coloursOf(few)).toEqual(['#acc', '#neu', '#neu', '#neu']);
  });

  it('draws the value-axis title of a ranking clear of the plot, with room under it', () => {
    const out = view({ ...ranked, valueLabel: 'BD Hrs' } as ChartSpec) as View & {
      grid?: { bottom?: number };
      xAxis?: { name?: string };
    };
    expect(out.xAxis?.name).toBe('BD Hrs');
    expect(out.grid?.bottom).toBeGreaterThanOrEqual(36);
  });

  it('prints every category name on its own row', () => {
    const out = view(ranked);
    expect(out.yAxis?.data).toEqual(NAMES);
    expect(out.yAxis?.axisLabel?.interval).toBe(0);
  });
});

describe('how a line is told apart from the others without its colour', () => {
  it('draws a loss solid with round marks, planned and gain dashed with triangles', () => {
    expect(strokeOf({ meaning: 'loss' }, 0)).toEqual({ symbol: 'circle', dashed: false });
    expect(strokeOf({ meaning: 'loss' }, 1)).toEqual({ symbol: 'circle', dashed: false });
    expect(strokeOf({ meaning: 'planned' }, 1)).toEqual({ symbol: 'triangle', dashed: true });
    expect(strokeOf({ meaning: 'gain' }, 1)).toEqual({ symbol: 'triangle', dashed: true });
  });

  it('keeps the kit order for lines with no meaning: the first solid, the rest dashed, marks alternating', () => {
    expect([0, 1, 2, 3, 4].map((i) => strokeOf({}, i))).toEqual([
      { symbol: 'circle', dashed: false },
      { symbol: 'triangle', dashed: true },
      { symbol: 'circle', dashed: true },
      { symbol: 'triangle', dashed: true },
      { symbol: 'circle', dashed: true },
    ]);
  });
});

describe('a box with a size of its own', () => {
  it('keeps ECharts own label spacing: no forced labels, no tilt, no extra room', () => {
    const fixed = chartOption(bar(), {
      ...palette,
      fixed: true,
      width: undefined,
    }) as unknown as View;
    expect(fixed.xAxis?.axisLabel).toEqual({ color: '#ax' });
    const titled = chartOption(bar({ axisTitles: true }), {
      ...palette,
      fixed: true,
    }) as unknown as View & { grid?: { bottom?: number } };
    expect(titled.grid?.bottom).toBe(36);
  });
});

describe('the axis title under tilted names', () => {
  it('is pushed down and given room by as much as the names take', () => {
    const wide = { ...palette, width: 700 };
    const out = chartOption(bar({ axisTitles: true }), wide) as unknown as View & {
      grid?: { bottom?: number };
      xAxis?: { nameGap?: number };
    };
    const room = labelPlan(NAMES, 700).room;
    expect(room).toBeGreaterThan(150);
    expect(out.grid?.bottom).toBe(36 + room);
    expect(out.xAxis?.nameGap).toBe(28 + room);
  });
});

describe('a percent chart', () => {
  it('prints the unit on the bar labels and in the tooltip as well as on the axis', () => {
    const out = view(bar({ unit: '%' })) as View & {
      series?: { label?: { formatter?: string } }[];
    } & { tooltip?: { valueFormatter?: (v: unknown) => string } };
    expect(out.series?.[0]?.label?.formatter).toBe('{c}%');
    expect(out.tooltip?.valueFormatter?.(1.36)).toBe('1.36%');
  });
});

describe('category labels', () => {
  it('never skips a label while there is room, on a vertical chart or a line', () => {
    expect(view(bar()).xAxis?.axisLabel?.interval).toBe(0);
    const line = { ...bar(), kind: 'line' } as ChartSpec;
    expect(view(line).xAxis?.axisLabel?.interval).toBe(0);
  });

  it('lays labels flat when they fit, tilts them when they do not, and thins them when 45 degrees is still too tight', () => {
    expect(labelPlan(['Jan', 'Feb', 'Mar'], 600)).toMatchObject({ rotate: 0, room: 0 });
    const cells = Array.from({ length: 9 }, (_, i) => `Cell ${i + 1}`);
    expect(labelPlan(cells, 1000).rotate).toBe(0);
    const tilted = labelPlan(NAMES, 700);
    expect(tilted.rotate).toBe(45);
    expect(tilted.room).toBeGreaterThan(150);
    expect(tilted.every).toBeUndefined();
    const many = Array.from({ length: 40 }, (_, i) => `Machine number ${i}`);
    expect(labelPlan(many, 320).every).toBeGreaterThan(1);
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
