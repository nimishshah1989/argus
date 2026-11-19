import { useEffect, useRef, useState, type RefObject } from 'react';
import type { ComposeOption } from 'echarts/core';
import type { BarSeriesOption, LineSeriesOption, ScatterSeriesOption } from 'echarts/charts';
import type { GridComponentOption, TooltipComponentOption } from 'echarts/components';

/** A design token a series or point can be drawn in; absent keeps the kit's series colour. */
export type ChartTone = 'danger' | 'warning' | 'info' | 'hold' | 'moved' | 'ok' | 'muted';

export interface ChartSeries {
  name: string; // translated; end label, table header
  values: (number | undefined)[]; // one per category; a gap where the plant had no value
  /** The series' own tone (the Lab's actual line, the forecast's plan); absent keeps its palette slot. */
  tone?: ChartTone;
  /** One tone per category (a bar coloured by band); absent keeps the series colour. */
  tones?: (ChartTone | undefined)[];
}
interface ScatterPoint {
  x: number;
  y: number;
  r: number; // bubble radius
  label: string; // the machine, data not copy
  mttr?: number;
  /** The point's rating tone (A9's map); absent keeps the series colour. */
  tone?: ChartTone;
  /** Whether the point prints its label; A9 labels only High and Critical. */
  showLabel?: boolean;
}
export type ChartSpec =
  | {
      kind: 'bar';
      title: string;
      categoryLabel: string;
      categories: string[];
      series: [ChartSeries] | [ChartSeries, ChartSeries];
      /** The value axis title; absent leaves the axis unnamed. */
      valueLabel?: string;
      /** Draw the bars horizontally (long machine labels, the planning chart). */
      horizontal?: true;
    }
  | {
      kind: 'line';
      title: string;
      categoryLabel: string;
      categories: string[];
      series: ChartSeries[];
      /** Two series on two axes: the first on the left, the second on the right. */
      secondAxis?: boolean;
      /** The value axis title. */
      valueLabel?: string;
    }
  | {
      kind: 'scatter';
      title: string;
      machineLabel: string;
      xLabel: string;
      yLabel: string;
      mttrLabel: string;
      points: ScatterPoint[];
      /** The raw category per lane (A9's map); the y axis reads these instead of numbers. */
      yTickLabels?: string[];
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
  /** A test palette may omit the tones and keep the series colours. */
  tones?: Partial<Record<ChartTone, string>>;
}

const TONES = ['danger', 'warning', 'info', 'hold', 'moved', 'ok', 'muted'] as const;

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
    components.MarkLineComponent,
    components.MarkAreaComponent,
    components.MarkPointComponent,
    components.DataZoomComponent,
    renderers.SVGRenderer,
  ]);
  return core;
}

export function loadEcharts(): ReturnType<typeof load> {
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
    tones: Object.fromEntries(TONES.map((tone) => [tone, read(`--color-${tone}`)])),
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

/** A named tone's colour, or the fallback when the palette (a test) carries no tones. */
function toneColor(tone: ChartTone | undefined, p: Palette, fallback?: string) {
  return (tone === undefined ? undefined : p.tones?.[tone]) ?? fallback;
}

/** The value axis, titled when the chart names its quantity (A9's forecast, the Lab's month hours). */
function titledValueAxis(label: string | undefined, p: Palette) {
  const axis = valueAxis(p);
  if (label === undefined) return axis;
  return {
    ...axis,
    name: label,
    nameLocation: 'middle' as const,
    nameGap: 28,
    nameTextStyle: { color: p.axis },
  };
}

function barOption(spec: BarSpec, p: Palette): Option {
  const horizontal = spec.horizontal === true;
  const category = categoryAxis(spec.categories, p);
  const value = titledValueAxis(spec.valueLabel, p);
  return {
    ...baseOption(p, 16),
    xAxis: horizontal ? value : category,
    yAxis: horizontal ? category : value,
    series: spec.series.map((series, index) => {
      const color = toneColor(series.tone, p, p.series[index]);
      return {
        type: 'bar' as const,
        name: series.name,
        data:
          series.tones === undefined
            ? series.values
            : series.values.map((item, at) => ({
                value: item ?? null,
                itemStyle: { color: toneColor(series.tones?.[at], p, color) },
              })),
        color,
        label: {
          show: true,
          position: horizontal ? ('right' as const) : ('top' as const),
          color: p.axis,
        },
      };
    }),
  };
}

function lineOption(spec: LineSpec, p: Palette): Option {
  const longest = Math.max(...spec.series.map((s) => s.name.length));
  const secondAxis = spec.secondAxis === true && spec.series.length === 2;
  const axis = titledValueAxis(spec.valueLabel, p);
  return {
    ...baseOption(p, 16 + 7 * longest),
    xAxis: categoryAxis(spec.categories, p),
    yAxis: secondAxis ? [axis, { ...axis, splitLine: { show: false } }] : axis,
    series: spec.series.map((s, i) => ({
      type: 'line' as const,
      name: s.name,
      data: s.values,
      color: toneColor(s.tone, p, p.series[i % p.series.length]),
      ...(secondAxis && i === 1 ? { yAxisIndex: 1 } : {}),
      symbol: (['circle', 'triangle'] as const)[i % 2],
      symbolSize: 8,
      showAllSymbol: true,
      lineStyle: { width: 2, type: (i === 0 ? 'solid' : 'dashed') as 'solid' | 'dashed' },
      endLabel: {
        show: true,
        formatter: '{a}',
        color: toneColor(s.tone, p, p.series[i % p.series.length]),
      },
    })),
  };
}

function scatterOption(spec: ScatterSpec, p: Palette): Option {
  const named = {
    ...valueAxis(p),
    nameLocation: 'middle' as const,
    nameGap: 28,
    nameTextStyle: { color: p.axis },
  };
  const ticks = spec.yTickLabels;
  const yAxis =
    ticks === undefined
      ? { ...named, name: spec.yLabel }
      : {
          ...named,
          name: spec.yLabel,
          inverse: true,
          min: -0.6,
          max: ticks.length - 0.4,
          interval: 1,
          splitLine: { show: false },
          axisLabel: {
            color: p.axis,
            interval: 0,
            formatter: (value: string | number) => ticks[Math.round(Number(value))] ?? '',
          },
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
    xAxis: { ...named, name: spec.xLabel },
    yAxis,
    series: [{ type: 'scatter', data: spec.points.map((point) => scatterItem(point, p)) }],
  };
}

/** One point: its arm, its rating tone and, only where the spec asks, its machine label. */
function scatterItem(point: ScatterPoint, p: Palette) {
  return {
    value: [point.x, point.y],
    symbolSize: point.r,
    name: point.label,
    ...(point.tone === undefined
      ? {}
      : { itemStyle: { color: toneColor(point.tone, p, p.series[0]) } }),
    ...(point.showLabel === true
      ? {
          label: {
            show: true,
            position: 'right' as const,
            formatter: point.label,
            color: p.axis,
            fontSize: 10,
          },
        }
      : {}),
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
