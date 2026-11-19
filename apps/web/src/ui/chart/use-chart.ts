import { useEffect, useRef, useState, type RefObject } from 'react';
import { chartOption } from './chart-option.js';
import { settle } from './chart-parts.js';
import { readPalette } from './chart-palette.js';
import type { ChartSpec, ChartState } from './chart-spec.js';

export { chartOption } from './chart-option.js';
export { readPalette, type Palette } from './chart-palette.js';
export type { ChartSeries, ChartSpec, ChartState, ChartTone, ScatterPoint } from './chart-spec.js';

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
    charts.HeatmapChart,
    components.GridComponent,
    components.TooltipComponent,
    components.LegendComponent,
    components.VisualMapComponent,
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
          chart.setOption(
            settle(
              chartOption(JSON.parse(key) as ChartSpec, readPalette(el)),
              window.matchMedia('(prefers-reduced-motion: reduce)').matches,
            ),
          );
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
