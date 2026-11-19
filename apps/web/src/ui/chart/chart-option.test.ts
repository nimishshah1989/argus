// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { chartOption } from './chart-option.js';
import { frameOption, settle } from './chart-parts.js';
import { paretoRows, type ChartSpec } from './chart-spec.js';
import { contrast, mix, parseHex } from './chart-color.js';
import type { Palette } from './chart-palette.js';

const SERIES = ['#a1', '#a2', '#a3', '#a4', '#a5', '#a6', '#a7', '#a8'];
const palette: Palette = { series: SERIES, axis: '#ax', grid: '#gr', font: 'x' };

interface SeriesView {
  type?: string;
  name?: string;
  color?: string;
  data?: unknown[];
  stack?: string;
  yAxisIndex?: number;
}
interface AxisView {
  type?: string;
  data?: string[];
  inverse?: boolean;
  max?: number;
}
interface OptionView {
  animation?: boolean;
  series?: SeriesView[];
  xAxis?: AxisView;
  yAxis?: AxisView | AxisView[];
  tooltip?: { trigger?: string };
  legend?: { data?: string[] };
  visualMap?: object;
}
const view = (spec: ChartSpec): OptionView => chartOption(spec, palette) as unknown as OptionView;

const three = [
  { name: 'A', values: [1, 2] },
  { name: 'B', values: [3, 4] },
  { name: 'C', values: [5, 6] },
];
const specs: Record<string, ChartSpec> = {
  bar: { kind: 'bar', title: 't', categoryLabel: 'c', categories: ['x', 'y'], series: [three[0]!] },
  line: { kind: 'line', title: 't', categoryLabel: 'c', categories: ['x', 'y'], series: three },
  scatter: {
    kind: 'scatter',
    title: 't',
    machineLabel: 'm',
    xLabel: 'x',
    yLabel: 'y',
    mttrLabel: 'r',
    points: [{ x: 1, y: 2, r: 5, label: 'M-1' }],
  },
  mixed: { kind: 'mixed', title: 't', categoryLabel: 'c', categories: ['x'], bars: [three[0]!] },
  heatmap: {
    kind: 'heatmap',
    title: 't',
    categoryLabel: 'c',
    categories: ['x', 'y'],
    series: three,
  },
  pareto: {
    kind: 'pareto',
    title: 't',
    categoryLabel: 'c',
    categories: ['x', 'y'],
    series: [three[0]!],
    cumulativeLabel: 'Cumulative %',
  },
};

describe('chartOption, every kind', () => {
  it.each(Object.entries(specs))(
    'draws %s with no animation, so reduced motion sees none',
    (_k, spec) => {
      expect(view(spec).animation).toBe(false);
    },
  );
});

describe('stacked and horizontal bars', () => {
  const bar: ChartSpec = {
    kind: 'bar',
    title: 't',
    categoryLabel: 'c',
    categories: ['x', 'y'],
    series: three,
    stacked: true,
    horizontal: true,
  };
  it('stacks every series on one stack, in the palette order, with a legend and a tooltip', () => {
    const option = view(bar);
    expect(option.series?.map((s) => s.stack)).toEqual(['total', 'total', 'total']);
    expect(option.series?.map((s) => s.color)).toEqual(['#a1', '#a2', '#a3']);
    expect(option.legend?.data).toEqual(['A', 'B', 'C']);
    expect(option.tooltip?.trigger).toBe('axis');
  });
  it('puts the categories on the y axis when horizontal', () => {
    const option = view(bar);
    expect(option.yAxis).toMatchObject({ type: 'category', data: ['x', 'y'] });
    expect(option.xAxis).toMatchObject({ type: 'value' });
  });
  it('lets the spec turn the legend off, and keeps an unstacked bar legend-free', () => {
    expect(view({ ...bar, legend: false }).legend).toBeUndefined();
    expect(view({ ...bar, stacked: undefined }).legend).toBeUndefined();
  });
});

describe('line, scatter and the legend', () => {
  it('shows a line legend only when asked, and gives every line a palette colour', () => {
    const line = specs.line as Extract<ChartSpec, { kind: 'line' }>;
    expect(view(line).legend).toBeUndefined();
    const option = view({ ...line, legend: true });
    expect(option.legend?.data).toEqual(['A', 'B', 'C']);
    expect(option.series?.map((s) => s.color)).toEqual(['#a1', '#a2', '#a3']);
    expect(option.tooltip?.trigger).toBe('axis');
  });
  it('cycles the palette past eight series', () => {
    const many = Array.from({ length: 9 }, (_v, i) => ({ name: `S${i}`, values: [i] }));
    const option = view({
      kind: 'line',
      title: 't',
      categoryLabel: 'c',
      categories: ['x'],
      series: many,
    });
    expect(option.series?.[8]?.color).toBe('#a1');
  });
  it('keeps the scatter tooltip on the point', () => {
    expect(view(specs.scatter!).tooltip?.trigger).toBe('item');
  });
});

describe('heatmap', () => {
  const heat: ChartSpec = {
    kind: 'heatmap',
    title: 't',
    categoryLabel: 'Machine',
    categories: ['M-1', 'M-2'],
    series: [
      { name: 'Mon', values: [4, undefined] },
      { name: 'Tue', values: [2, 8] },
    ],
  };
  it('draws one cell per value on a category grid, a gap staying empty, a scale from the grid ink to the series colour', () => {
    const option = view(heat);
    expect(option.series?.[0]?.type).toBe('heatmap');
    const cells = (option.series?.[0]?.data as { value: number[] }[]).map((c) => c.value);
    expect(cells).toEqual([
      [0, 0, 4],
      [1, 0, 2],
      [1, 1, 8],
    ]);
    expect(option.visualMap).toMatchObject({ min: 0, max: 8, inRange: { color: ['#gr', '#a1'] } });
    expect(option.xAxis?.data).toEqual(['Mon', 'Tue']);
    expect(option.yAxis).toMatchObject({ data: ['M-1', 'M-2'], inverse: true });
    expect(option.tooltip?.trigger).toBe('item');
  });
});

describe('pareto', () => {
  const pareto: Extract<ChartSpec, { kind: 'pareto' }> = {
    kind: 'pareto',
    title: 't',
    categoryLabel: 'Cause',
    categories: ['Wear', 'Heat', 'Oil'],
    series: [{ name: 'Hours', values: [2, 6, 2] }],
    cumulativeLabel: 'Cumulative %',
  };
  it('orders the steps from the largest and accumulates their share to 100 %', () => {
    expect(paretoRows(pareto)).toEqual([
      { category: 'Heat', value: 6, share: 60 },
      { category: 'Wear', value: 2, share: 80 },
      { category: 'Oil', value: 2, share: 100 },
    ]);
  });
  it('draws bars plus a share line on a 0 to 100 right axis, with legend and tooltip', () => {
    const option = view(pareto);
    expect(option.series?.map((s) => s.type)).toEqual(['bar', 'line']);
    expect(option.series?.[0]?.data).toEqual([6, 2, 2]);
    expect(option.series?.[1]?.data).toEqual([60, 80, 100]);
    expect(option.series?.[1]?.yAxisIndex).toBe(1);
    expect((option.yAxis as AxisView[])[1]?.max).toBe(100);
    expect(option.xAxis?.data).toEqual(['Heat', 'Wear', 'Oil']);
    expect(option.legend?.data).toEqual(['Hours', 'Cumulative %']);
    expect(option.tooltip?.trigger).toBe('axis');
  });
  it('shares 0 % for a Pareto of zeros', () => {
    const zero = {
      ...pareto,
      series: [{ name: 'Hours', values: [0, 0, 0] }] as [{ name: string; values: number[] }],
    };
    expect(paretoRows(zero).map((r) => r.share)).toEqual([0, 0, 0]);
  });
});

describe('review fixes', () => {
  it('escapes markup in the scatter and heatmap tooltips', () => {
    const evil = '<img src=x onerror=alert(1)><b>';
    const scatter = chartOption(
      {
        kind: 'scatter',
        title: 't',
        machineLabel: 'm',
        xLabel: 'x',
        yLabel: 'y',
        mttrLabel: 'r',
        points: [{ x: 1, y: 1, r: 5, label: evil, mttr: 2 }],
      },
      palette,
    ) as unknown as { tooltip: { formatter: (p: unknown) => string } };
    const text = scatter.tooltip.formatter({ name: evil });
    expect(text).not.toContain('<img');
    expect(text).not.toContain('<b>');
    expect(text).toContain('&#60;img');
    const heat = chartOption(
      {
        kind: 'heatmap',
        title: 't',
        categoryLabel: 'c',
        categories: [evil],
        series: [{ name: evil, values: [1] }],
      },
      palette,
    ) as unknown as { tooltip: { formatter: (p: unknown) => string } };
    expect(heat.tooltip.formatter({ value: [0, 0, 1] })).not.toContain('<img');
  });

  it('keeps every heatmap label at 4.5:1 or better against its cell', () => {
    const real: Palette = { ...palette, series: ['#0f766e'], grid: '#e8e8ed' };
    const spec: ChartSpec = {
      kind: 'heatmap',
      title: 't',
      categoryLabel: 'c',
      categories: ['a', 'b', 'c', 'd'],
      series: [{ name: 'x', values: [0, 3, 6, 10] }],
    };
    const cells = (chartOption(spec, real) as unknown as OptionView).series?.[0]?.data as {
      value: number[];
      label: { color: string };
    }[];
    const light = parseHex('#e8e8ed')!;
    const dark = parseHex('#0f766e')!;
    for (const cell of cells) {
      const fill = mix(light, dark, cell.value[2]! / 10);
      expect(contrast(fill, parseHex(cell.label.color)!)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('leaves a Pareto category with no value out instead of making it a zero', () => {
    const rows = paretoRows({
      kind: 'pareto',
      title: 't',
      categoryLabel: 'c',
      categories: ['a', 'b', 'c'],
      series: [{ name: 'n', values: [4, undefined, 4] }],
      cumulativeLabel: 'cum',
    });
    expect(rows.map((r) => r.category)).toEqual(['a', 'c']);
    expect(rows.map((r) => r.share)).toEqual([50, 100]);
  });

  it('refuses secondAxis unless there are exactly two series', () => {
    const three = {
      kind: 'line' as const,
      title: 't',
      categoryLabel: 'c',
      categories: ['x'],
      secondAxis: true,
      series: [
        { name: 'A', values: [1] },
        { name: 'B', values: [1] },
        { name: 'C', values: [1] },
      ],
    };
    expect(() => chartOption(three, palette)).toThrow(/exactly 2 series/);
  });

  it('colours a mixed chart per series when its legend is on, and keeps one colour otherwise', () => {
    const mixed = {
      kind: 'mixed' as const,
      title: 't',
      categoryLabel: 'c',
      categories: ['x'],
      bars: [
        { name: 'A', values: [1] },
        { name: 'B', values: [2] },
      ],
      line: { name: 'L', values: [3] },
    };
    expect(view(mixed).series?.map((s) => s.color)).toEqual(['#a1', '#a1', '#a2']);
    const legend = view({ ...mixed, legend: true });
    expect(legend.series?.map((s) => s.color)).toEqual(['#a1', '#a2', '#a3']);
    expect(legend.legend?.data).toEqual(['A', 'B', 'L']);
  });
});

describe('draw-in', () => {
  const kinds = ['bar', 'line', 'pareto'] as const;

  it.each(kinds)('a %s chart that asks to draw in animates once, in under 800 ms', (kind) => {
    const option = view({ ...specs[kind]!, draw: true } as ChartSpec) as Record<string, unknown>;
    expect(option.animation).toBe(true);
    expect(option.animationDuration as number).toBeLessThan(800);
  });

  it.each(kinds)('a %s chart that does not ask stays still', (kind) => {
    expect(view(specs[kind]!).animation).toBe(false);
  });

  it('is switched off by reduced motion, whatever the spec asked for', () => {
    const asked = chartOption({ ...specs.line!, draw: true } as ChartSpec, palette);
    expect(settle(asked, true).animation).toBe(false);
    expect(settle(asked, false).animation).toBe(true);
  });

  it('animates only the first draw of a chart: a data update into the same chart does not redraw', () => {
    const asked = chartOption({ ...specs.line!, draw: true } as ChartSpec, palette);
    expect(frameOption(asked, { first: true, reduced: false }).animation).toBe(true);
    expect(frameOption(asked, { first: false, reduced: false }).animation).toBe(false);
    expect(frameOption(asked, { first: true, reduced: true }).animation).toBe(false);
  });
});
