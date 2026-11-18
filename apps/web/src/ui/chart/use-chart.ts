import { useEffect, useRef, useState, type RefObject } from 'react';
import type { ComposeOption } from 'echarts/core';
import type { BarSeriesOption, LineSeriesOption, ScatterSeriesOption } from 'echarts/charts';
import type { GridComponentOption, TooltipComponentOption } from 'echarts/components';

export interface ChartSeries {
  name: string; // translated; end label, table header
  values: (number | undefined)[]; // one per category; a gap where the plant had no value
}
interface ScatterPoint {
  x: number;
  y: number;
  r: number; // bubble radius
  label: string; // the machine, data not copy
  mttr?: number;
}
export type ChartSpec =
  | {
      kind: 'bar';
      title: string;
      categoryLabel: string;
      categories: string[];
      series: [ChartSeries] | [ChartSeries, ChartSeries];
    }
  | {
      kind: 'line';
      title: string;
      categoryLabel: string;
      categories: string[];
      series: [ChartSeries] | [ChartSeries, ChartSeries];
      /** Two series on two axes: the first on the left, the second on the right. */
      secondAxis?: boolean;
    }
  | {
      kind: 'scatter';
      title: string;
      machineLabel: string;
      xLabel: string;
      yLabel: string;
      mttrLabel: string;
      points: ScatterPoint[];
    }
  | {
      kind: 'mixed';
      title: string;
      categoryLabel: string;
      categories: string[];
      bars: ChartSeries[];
      line?: ChartSeries;
    };
export type ChartState = 'loading' | 'ready' | 'error';

type BarSpec = Extract<ChartSpec, { kind: 'bar' }>;
type LineSpec = Extract<ChartSpec, { kind: 'line' }>;
type ScatterSpec = Extract<ChartSpec, { kind: 'scatter' }>;
type MixedSpec = Extract<ChartSpec, { kind: 'mixed' }>;

type Option = ComposeOption<
  | BarSeriesOption
  | LineSeriesOption
  | ScatterSeriesOption
  | GridComponentOption
  | TooltipComponentOption
>;
export interface Palette {
  series: [string, string];
  axis: string;
  grid: string;
  font: string;
}

let loader: ReturnType<typeof load> | null = null;

/** The only place that loads ECharts: one cached import of the four modules we use. */
async function load() {
  const [core, charts, components, renderers] = await Promise.all([
    import('echarts/core'),
    import('echarts/charts'),
    import('echarts/components'),
    import('echarts/renderers'),
  ]);
  core.use([
    charts.BarChart,
    charts.LineChart,
    charts.ScatterChart,
    components.GridComponent,
    components.TooltipComponent,
    renderers.SVGRenderer,
  ]);
  return core;
}

function loadEcharts(): ReturnType<typeof load> {
  loader ??= load().catch((error: unknown) => {
    loader = null;
    throw error;
  });
  return loader;
}

function palette(el: HTMLElement): Palette {
  const css = getComputedStyle(el);
  const read = (name: string) => css.getPropertyValue(name).trim();
  return {
    series: [read('--color-chart-1'), read('--color-chart-2')],
    axis: read('--color-chart-axis'),
    grid: read('--color-chart-grid'),
    font: read('--font-sans'),
  };
}

function baseOption(p: Palette, right: number): Option {
  return {
    animation: false,
    textStyle: { fontFamily: p.font, fontSize: 12, color: p.axis },
    grid: { left: 8, top: 24, bottom: 8, right, containLabel: true },
  };
}

function categoryAxis(categories: string[], p: Palette) {
  return {
    type: 'category' as const,
    data: categories,
    axisTick: { show: false },
    axisLine: { lineStyle: { color: p.grid } },
    axisLabel: { color: p.axis },
  };
}

function valueAxis(p: Palette) {
  return {
    type: 'value' as const,
    splitLine: { lineStyle: { color: p.grid } },
    axisLabel: { color: p.axis },
  };
}

function barOption(spec: BarSpec, p: Palette): Option {
  return {
    ...baseOption(p, 16),
    xAxis: categoryAxis(spec.categories, p),
    yAxis: valueAxis(p),
    series: spec.series.map((series, index) => ({
      type: 'bar' as const,
      name: series.name,
      data: series.values,
      color: p.series[index],
      label: { show: true, position: 'top' as const, color: p.axis },
    })),
  };
}

function lineOption(spec: LineSpec, p: Palette): Option {
  const longest = Math.max(...spec.series.map((s) => s.name.length));
  const secondAxis = spec.secondAxis === true && spec.series.length === 2;
  return {
    ...baseOption(p, 16 + 7 * longest),
    xAxis: categoryAxis(spec.categories, p),
    yAxis: secondAxis
      ? [valueAxis(p), { ...valueAxis(p), splitLine: { show: false } }]
      : valueAxis(p),
    series: spec.series.map((s, i) => ({
      type: 'line' as const,
      name: s.name,
      data: s.values,
      color: p.series[i],
      ...(secondAxis && i === 1 ? { yAxisIndex: 1 } : {}),
      symbol: (['circle', 'triangle'] as const)[i],
      symbolSize: 8,
      showAllSymbol: true,
      lineStyle: { width: 2, type: (['solid', 'dashed'] as const)[i] },
      endLabel: { show: true, formatter: '{a}', color: p.series[i] },
    })),
  };
}

function scatterOption(spec: ScatterSpec, p: Palette): Option {
  const axis = {
    ...valueAxis(p),
    nameLocation: 'middle' as const,
    nameGap: 28,
    nameTextStyle: { color: p.axis },
  };
  return {
    ...baseOption(p, 24),
    tooltip: {
      trigger: 'item',
      formatter: (params: unknown) => {
        const name = (params as { name?: string }).name;
        const mttr = spec.points.find((point) => point.label === name)?.mttr;
        return mttr === undefined
          ? String(name ?? '')
          : `${name ?? ''}\n${spec.mttrLabel}: ${mttr}`;
      },
    },
    xAxis: { ...axis, name: spec.xLabel },
    yAxis: { ...axis, name: spec.yLabel },
    series: [
      {
        type: 'scatter',
        data: spec.points.map((point) => ({
          value: [point.x, point.y],
          symbolSize: point.r,
          name: point.label,
        })),
      },
    ],
  };
}

function mixedOption(spec: MixedSpec, p: Palette): Option {
  return {
    ...baseOption(p, 16),
    xAxis: categoryAxis(spec.categories, p),
    yAxis: [valueAxis(p), { ...valueAxis(p), splitLine: { show: false } }],
    series: [
      ...spec.bars.map((s) => ({
        type: 'bar' as const,
        name: s.name,
        data: s.values,
        color: p.series[0],
        stack: 'total',
      })),
      ...(spec.line === undefined
        ? []
        : [
            {
              type: 'line' as const,
              name: spec.line.name,
              data: spec.line.values,
              color: p.series[1],
              yAxisIndex: 1,
              symbol: 'circle',
              symbolSize: 8,
              showAllSymbol: true,
              lineStyle: { width: 2, type: 'dashed' as const },
              endLabel: { show: true, formatter: '{a}', color: p.series[1] },
            },
          ]),
    ],
  };
}

/** The ECharts option for a spec; the one exported builder the node test pins. */
export function chartOption(spec: ChartSpec, p: Palette): Option {
  switch (spec.kind) {
    case 'bar':
      return barOption(spec, p);
    case 'line':
      return lineOption(spec, p);
    case 'scatter':
      return scatterOption(spec, p);
    case 'mixed':
      return mixedOption(spec, p);
  }
}

/** Draws `spec` into the returned ref once ECharts has loaded; `error` if it never does. */
export function useChart(spec: ChartSpec): {
  ref: RefObject<HTMLDivElement | null>;
  state: ChartState;
} {
  const ref = useRef<HTMLDivElement | null>(null);
  const [state, setState] = useState<ChartState>('loading');
  const key = JSON.stringify(spec);
  useEffect(() => {
    let live = true;
    let dispose = (): void => undefined;
    loadEcharts().then(
      (echarts) => {
        const el = ref.current;
        if (!live || !el) return;
        let chart: { setOption(o: unknown): void; resize(): void; dispose(): void } | undefined;
        try {
          chart = echarts.init(el, null, { renderer: 'svg' });
          chart.setOption(chartOption(JSON.parse(key) as ChartSpec, palette(el)));
        } catch {
          chart?.dispose();
          setState('error');
          return;
        }
        const made = chart;
        const resize = () => made.resize();
        window.addEventListener('resize', resize);
        dispose = () => {
          window.removeEventListener('resize', resize);
          made.dispose();
        };
        setState('ready');
      },
      () => {
        if (live) setState('error');
      },
    );
    return () => {
      live = false;
      dispose();
    };
  }, [key]);
  return { ref, state };
}
