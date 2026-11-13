import { useEffect, useRef, useState, type RefObject } from 'react';
import type { ComposeOption } from 'echarts/core';
import type { BarSeriesOption, LineSeriesOption } from 'echarts/charts';
import type { GridComponentOption } from 'echarts/components';

export interface ChartSeries {
  name: string; // translated; end label, table header
  values: number[]; // one per category
}
export type ChartSpec =
  | {
      kind: 'bar';
      title: string;
      categoryLabel: string;
      categories: string[];
      series: [ChartSeries];
    }
  | {
      kind: 'line';
      title: string;
      categoryLabel: string;
      categories: string[];
      series: [ChartSeries] | [ChartSeries, ChartSeries];
    };
export type ChartState = 'loading' | 'ready' | 'error';

type Option = ComposeOption<BarSeriesOption | LineSeriesOption | GridComponentOption>;
interface Palette {
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
  core.use([charts.BarChart, charts.LineChart, components.GridComponent, renderers.SVGRenderer]);
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

function chartOption(spec: ChartSpec, p: Palette): Option {
  const longest = Math.max(...spec.series.map((s) => s.name.length));
  const axis = { axisLabel: { color: p.axis } };
  return {
    animation: false,
    textStyle: { fontFamily: p.font, fontSize: 12, color: p.axis },
    grid: {
      left: 8,
      top: 24,
      bottom: 8,
      right: spec.kind === 'line' ? 16 + 7 * longest : 16,
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: spec.categories,
      axisTick: { show: false },
      axisLine: { lineStyle: { color: p.grid } },
      ...axis,
    },
    yAxis: { type: 'value', splitLine: { lineStyle: { color: p.grid } }, ...axis },
    series: spec.series.map((s, i) =>
      spec.kind === 'bar'
        ? {
            type: 'bar' as const,
            name: s.name,
            data: s.values,
            color: p.series[0],
            label: { show: true, position: 'top' as const, color: p.axis },
          }
        : {
            type: 'line' as const,
            name: s.name,
            data: s.values,
            color: p.series[i],
            symbol: ['circle', 'triangle'][i],
            symbolSize: 8,
            showAllSymbol: true,
            lineStyle: { width: 2, type: (['solid', 'dashed'] as const)[i] },
            endLabel: { show: true, formatter: '{a}', color: p.series[i] },
          },
    ),
  };
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
        const chart = echarts.init(el, null, { renderer: 'svg' });
        chart.setOption(chartOption(JSON.parse(key) as ChartSpec, palette(el)));
        const resize = () => chart.resize();
        window.addEventListener('resize', resize);
        dispose = () => {
          window.removeEventListener('resize', resize);
          chart.dispose();
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
