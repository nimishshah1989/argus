import { useEffect, useRef, useState, type RefObject } from 'react';
import { chartOption } from './chart-option.js';
import { BASE_HEIGHT, chartRoom } from './chart-labels.js';
import { frameOption } from './chart-parts.js';
import { readPalette } from './chart-palette.js';
import type { ChartSpec, ChartState } from './chart-spec.js';

export { chartOption } from './chart-option.js';
export { readPalette, type Palette } from './chart-palette.js';
export type {
  ChartMeaning,
  ChartSeries,
  ChartSpec,
  ChartState,
  ChartTone,
  ScatterPoint,
} from './chart-spec.js';

let loader: ReturnType<typeof load> | null = null;

/** The only place that loads ECharts: one cached import of the five modules we use. */
async function load() {
  const [core, charts, components, renderers, features] = await Promise.all([
    import('echarts/core'),
    import('echarts/charts'),
    import('echarts/components'),
    import('echarts/renderers'),
    import('echarts/features'),
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
    features.LabelLayout,
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

export interface Instance {
  setOption(option: unknown, opts?: { notMerge: boolean }): void;
  resize(): void;
  dispose(): void;
}

/** One chart on `el`: made, drawn the first time, kept sized, and still the moment reduced motion is asked for. */
function attach(
  echarts: Awaited<ReturnType<typeof loadEcharts>>,
  el: HTMLElement,
  first: (made: Instance) => void,
  again: (made: Instance) => void,
): { made: Instance; dispose: () => void } {
  const made: Instance = echarts.init(el, null, { renderer: 'svg' });
  try {
    first(made);
  } catch (error) {
    made.dispose();
    throw error;
  }
  // A new width can need other label room (a drawer opening, a phone turning): size the box, then lay the labels out.
  const resize = () => {
    again(made);
  };
  // The card's width also changes with no window resize (the drawer sliding in, a panel opening): watch the box itself,
  // once a frame, and only when its width changed.
  const box = el.parentElement ?? el;
  let width = box.clientWidth;
  let frame = 0;
  const watch =
    typeof ResizeObserver === 'undefined'
      ? undefined
      : new ResizeObserver(() => {
          if (box.clientWidth === width) return;
          width = box.clientWidth;
          cancelAnimationFrame(frame);
          frame = requestAnimationFrame(resize);
        });
  watch?.observe(box);
  const query = window.matchMedia(REDUCED);
  const still = () => query.matches && made.setOption({ animation: false });
  window.addEventListener('resize', resize);
  query.addEventListener('change', still);
  return {
    made,
    dispose: () => {
      window.removeEventListener('resize', resize);
      watch?.disconnect();
      cancelAnimationFrame(frame);
      query.removeEventListener('change', still);
      made.dispose();
    },
  };
}

/**
 * Replace the option of a live chart with new data: measured again first (its box may have changed width since it was
 * made), then drawn in place with no animation. `ready` if it drew, `error` if the spec could not be drawn; the next
 * good spec recovers.
 */
export function refresh(made: Instance, build: () => unknown): ChartState {
  try {
    made.resize();
    made.setOption(build(), { notMerge: true });
    return 'ready';
  } catch {
    return 'error';
  }
}

/**
 * Size the box for the spec held in `key` NOW (tilted category labels, named rows and a wrapped legend need height),
 * and return the builder of its option, framed for the first draw of an instance or for a later update. The box is
 * sized before ECharts measures it. A v2 chart that needs more than the kit's own height is made taller; a box with a
 * size of its own (the v1 chart's) keeps it. No chart is ever wider than its box (ADR 0065).
 */
function optionFor(el: HTMLElement, key: string, first: boolean): () => unknown {
  const reduced = window.matchMedia(REDUCED).matches;
  const spec = JSON.parse(key) as ChartSpec;
  const palette = readPalette(el);
  const option = chartOption(spec, palette);
  // Rows of legend past the first push the plot down: the box grows by the same, so the plot keeps its height.
  const legend = option.legend ? (option.grid as { top: number }).top - 40 : 0;
  const height = chartRoom(spec, palette.width).height + legend;
  el.style.minHeight =
    el.classList.contains('v2-trend') && height > BASE_HEIGHT ? `${height}px` : '';
  return () => frameOption(option, { first, reduced });
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
          const attached = attach(
            echarts,
            el,
            (made) => {
              const build = optionFor(el, latest.current, true);
              made.resize(); // the box may have grown for its labels since it was made
              made.setOption(build());
            },
            (made) => {
              setState(refresh(made, optionFor(el, latest.current, false)));
            },
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
    setState(refresh(chart.current, optionFor(el, key, false)));
  }, [key]);
  return { ref, state };
}
