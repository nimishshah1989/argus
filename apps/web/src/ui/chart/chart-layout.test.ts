// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { chartRoom } from './chart-labels.js';
import { chartOption } from './chart-option.js';
import type { ChartSpec } from './chart-spec.js';
import { loadEcharts } from './use-chart.js';

const palette = {
  series: ['#111111', '#222222', '#333333', '#444444', '#555555'],
  axis: '#666666',
  grid: '#dddddd',
  font: 'sans-serif',
  tones: { hold: '#cc5500', danger: '#cc0000' },
};

const KINDS = Array.from(
  { length: 15 },
  (_, i) => `Vertical Double Column Machining Center ${i + 1} (${i + 2})`,
);

/** What these checks read of ECharts' laid-out chart. */
type Rect = { y: number; height: number };
interface Inner {
  getModel(): { getComponent(name: string): { coordinateSystem: { getRect(): Rect } } };
  getViewOfComponentModel(model: unknown): { group: { y: number; getBoundingRect(): Rect } };
}

/** The chart laid out by the real ECharts, with the modules the app loads, in a box as tall as the kit makes it. */
async function drawn(spec: ChartSpec, width: number) {
  const echarts = await loadEcharts();
  const option = chartOption(spec, { ...palette, width });
  const legend = option.legend ? (option.grid as { top: number }).top - 40 : 0;
  const height = chartRoom(spec, width).height + legend;
  const chart = echarts.init(null, null, { renderer: 'svg', ssr: true, width, height });
  chart.setOption(option);
  return { chart, option };
}

describe('a map of named rows (ADR 0065)', () => {
  const map: ChartSpec = {
    kind: 'scatter',
    title: 'Risk map',
    machineLabel: 'Machine',
    xLabel: 'Unavailable (% of machine hours), further right is more downtime',
    yLabel: '',
    mttrLabel: 'BD hrs',
    yTickLabels: KINDS,
    points: KINDS.map((_, i) => ({ x: i / 3, y: i, r: 6, label: `TMC-${i}`, showLabel: true })),
  };

  it.each([684, 464, 324])('keeps every row apart in a %i px card', async (width) => {
    const { chart, option } = await drawn(map, width);
    const at = (lane: number) => chart.convertToPixel({ yAxisIndex: 0 }, lane) as number;
    for (let lane = 1; lane < KINDS.length; lane += 1)
      expect(at(lane) - at(lane - 1)).toBeGreaterThanOrEqual(24);
    const grid = option.grid as { left: number; right: number };
    expect(grid.left).toBeLessThan(width * 0.35 + 17);
    expect(grid.right).toBeGreaterThanOrEqual(16 + 'TMC-14'.length * 6);
    expect(option.yAxis).toMatchObject({
      tooltip: { show: true },
      axisLabel: { overflow: 'truncate' },
    });
    chart.dispose();
  });

  it('keeps its plot even in a box as short as the kit default', async () => {
    const echarts = await loadEcharts();
    const chart = echarts.init(null, null, { renderer: 'svg', ssr: true, width: 684, height: 220 });
    chart.setOption(chartOption(map, { ...palette, width: 684 }));
    const inner = chart as unknown as Inner;
    expect(
      inner.getModel().getComponent('grid').coordinateSystem.getRect().height,
    ).toBeGreaterThanOrEqual(150);
    chart.dispose();
  });
});

describe('the legend and a long month axis (ADR 0065)', () => {
  const months = Array.from({ length: 57 }, (_, i) => `M${i}`);
  const names = ['Actual', 'Current model', 'Age-adjusted', 'Recent-weighted', 'Age + recent'];
  const lines: ChartSpec = {
    kind: 'line',
    title: 'Forecast',
    categoryLabel: 'Month',
    categories: months,
    legend: true,
    series: names.map((name) => ({ name, values: months.map((_, i) => i) })),
  };

  /** Five names, and the twenty-five a legend once had to hold (five series over five years). */
  const crowded: ChartSpec = {
    ...lines,
    series: names.flatMap((name) =>
      [22, 23, 24, 25, 26].map((year) => ({ name: `${name} ${year}`, values: [year] })),
    ),
  };

  it.each([
    [lines, 1350],
    [lines, 320],
    [crowded, 1350],
    [crowded, 430],
    [crowded, 320],
  ])('never prints the legend over the plot (%#)', async (spec, width) => {
    const { chart } = await drawn(spec, width);
    // ECharts' own boxes, as laid out: the legend ends above the top of the plot.
    const inner = chart as unknown as Inner;
    const legend = inner.getModel().getComponent('legend');
    const group = inner.getViewOfComponentModel(legend).group;
    const box = group.getBoundingRect();
    const plot = inner.getModel().getComponent('grid').coordinateSystem.getRect();
    expect(group.y + box.y + box.height).toBeLessThanOrEqual(plot.y);
    expect(plot.height).toBeGreaterThanOrEqual(100);
    chart.dispose();
  });

  it('thins the month names instead of widening the chart', () => {
    const option = chartOption(lines, { ...palette, width: 430 });
    expect(option.xAxis).toMatchObject({ data: months, axisLabel: { interval: 3 } });
    expect(chartRoom(lines, 430)).not.toHaveProperty('scrollWidth');
  });
});

describe('a series coloured bar by bar', () => {
  it('wears in the legend the colour most of its bars wear', () => {
    const option = chartOption(
      {
        kind: 'bar',
        title: 'Expected',
        categoryLabel: 'Machine',
        categories: ['a', 'b', 'c'],
        series: [{ name: 'Expected', values: [3, 2, 1], tones: ['danger', 'hold', 'hold'] }],
      },
      palette,
    ) as { series: { color: string }[] };
    expect(option.series[0]?.color).toBe('#cc5500');
  });
});
