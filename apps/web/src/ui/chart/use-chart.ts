import { useEffect, useRef, useState, type RefObject } from 'react';
import { chartOption } from './chart-option.js';
import { frameOption } from './chart-parts.js';
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

const REDUCED = '(prefers-reduced-motion: reduce)';

interface Instance {
  setOption(option: unknown, opts?: { notMerge: boolean }): void;
  resize(): void;
  dispose(): void;
}

/** One chart on `el`: made, drawn the first time, kept sized, and still the moment reduced motion is asked for. */
function attach(
  echarts: Awaited<ReturnType<typeof loadEcharts>>,
  el: HTMLElement,
  first: (made: Instance) => void,
): { made: Instance; dispose: () => void } {
  const made: Instance = echarts.init(el, null, { renderer: 'svg' });
  try {
    first(made);
  } catch (error) {
    made.dispose();
    throw error;
  }
  const resize = () => made.resize();
  const query = window.matchMedia(REDUCED);
  const still = () => query.matches && made.setOption({ animation: false });
  window.addEventListener('resize', resize);
  query.addEventListener('change', still);
  return {
    made,
    dispose: () => {
      window.removeEventListener('resize', resize);
      query.removeEventListener('change', still);
      made.dispose();
    },
  };
}

/** The option for the spec held in `key`, framed for the first draw of an instance or for a later update. */
function optionFor(el: HTMLElement, key: string, first: boolean) {
  const reduced = window.matchMedia(REDUCED).matches;
  return frameOption(chartOption(JSON.parse(key) as ChartSpec, readPalette(el)), {
    first,
    reduced,
  });
}

/**
 * Draws `spec` into the returned ref once ECharts has loaded; `error` if it never does. The instance is made once:
 * the first draw may animate in (`draw: true`), a later change to the spec replaces the option in place with no
 * animation, so a live data update never replays the draw. If reduced motion is asked for while it lives, its
 * animation is switched off at once.
 */
export function useChart(spec: ChartSpec): {
  ref: RefObject<HTMLDivElement | null>;
  state: ChartState;
} {
  const ref = useRef<HTMLDivElement | null>(null);
  const chart = useRef<Instance | null>(null);
  const [state, setState] = useState<ChartState>('loading');
  const key = JSON.stringify(spec);
  const latest = useRef(key);
  latest.current = key;

  useEffect(() => {
    let live = true;
    let dispose = (): void => undefined;
    loadEcharts().then(
      (echarts) => {
        const el = ref.current;
        if (!live || !el) return;
        try {
          const attached = attach(echarts, el, (made) =>
            made.setOption(optionFor(el, latest.current, true)),
          );
          chart.current = attached.made;
          dispose = () => {
            attached.dispose();
            chart.current = null;
          };
          setState('ready');
        } catch {
          setState('error');
        }
      },
      () => {
        if (live) setState('error');
      },
    );
    return () => {
      live = false;
      dispose();
    };
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!chart.current || !el) return;
    try {
      chart.current.setOption(optionFor(el, key, false), { notMerge: true });
    } catch {
      setState('error');
    }
  }, [key]);
  return { ref, state };
}
