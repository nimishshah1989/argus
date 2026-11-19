import { useEffect, useRef, useState, type RefObject } from 'react';
import type { ECharts, EChartsCoreOption } from 'echarts/core';
import { reducedMotion } from './motion.js';

/** The colours a chart reads from the page's custom properties, so a direction or theme change reaches it. */
export interface Ink {
  accent: string;
  accentTint: string;
  ink: string;
  ink2: string;
  line: string;
  surface: string;
  good: string;
  bad: string;
  seq: string[];
  font: string;
  /** The chart's width in px when it was last built, for choices that depend on room. */
  width: number;
}

let loader: ReturnType<typeof load> | null = null;

/** The only place the showcase loads ECharts: one cached import of the modules its four charts use. */
async function load() {
  const [core, charts, components, renderers] = await Promise.all([
    import('echarts/core'),
    import('echarts/charts'),
    import('echarts/components'),
    import('echarts/renderers'),
  ]);
  core.use([
    charts.LineChart,
    charts.BarChart,
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

export function readInk(el: HTMLElement): Ink {
  const css = getComputedStyle(el);
  const read = (name: string) => css.getPropertyValue(name).trim();
  return {
    accent: read('--color-accent'),
    accentTint: read('--color-accent-tint'),
    ink: read('--color-neutral-900'),
    ink2: read('--color-neutral-600'),
    line: read('--color-neutral-200'),
    surface: read('--color-surface'),
    good: read('--color-ok'),
    bad: read('--color-danger'),
    seq: [1, 2, 3, 4, 5].map((n) => read(`--proto-seq-${n}`)),
    font: read('--font-sans'),
    width: el.clientWidth,
  };
}

/** The draw-in every chart shares: once, 700 ms, ease-out; off under reduced motion. */
export function motionOption(): EChartsCoreOption {
  const off = reducedMotion();
  return {
    animation: !off,
    animationDuration: 700,
    animationEasing: 'cubicOut',
    animationDurationUpdate: 320,
    animationEasingUpdate: 'cubicInOut',
  };
}

/**
 * Mount one ECharts instance in the returned element and keep its option current. `make` runs when the chart is
 * ready and whenever `deps` change; options merge, so a changed series moves instead of redrawing. `onReady` hands
 * the instance out once, for event wiring and linked highlights.
 */
export function useEchart(
  make: (ink: Ink) => EChartsCoreOption,
  deps: readonly unknown[],
  onReady?: (chart: ECharts) => void,
): { ref: RefObject<HTMLDivElement | null>; chart: RefObject<ECharts | null>; ready: boolean } {
  const ref = useRef<HTMLDivElement>(null);
  const chart = useRef<ECharts | null>(null);
  const [ready, setReady] = useState(false);
  const ready0 = useRef(onReady);
  ready0.current = onReady;

  useEffect(() => {
    let dead = false;
    let watch: ResizeObserver | undefined;
    loader ??= load();
    void loader.then((core) => {
      const el = ref.current;
      if (dead || !el) return;
      const instance = core.init(el, undefined, { renderer: 'svg' });
      chart.current = instance;
      watch = new ResizeObserver(() => instance.resize());
      watch.observe(el);
      ready0.current?.(instance);
      setReady(true);
    });
    return () => {
      dead = true;
      watch?.disconnect();
      chart.current?.dispose();
      chart.current = null;
      setReady(false);
    };
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!ready || !el || !chart.current) return;
    chart.current.setOption({ ...motionOption(), ...make(readInk(el)) });
  }, [ready, ...deps]);

  return { ref, chart, ready };
}

/** The tooltip frame every chart shares: no ECharts box at all, so the card in `formatter` is the whole tooltip. */
export function tooltipBase(
  ink: Ink,
  axisPointer: Record<string, unknown>,
  card: (index: number) => string,
) {
  return {
    trigger: 'axis',
    confine: true,
    padding: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
    extraCssText: 'box-shadow:none;',
    transitionDuration: reducedMotion() ? 0 : 0.14,
    axisPointer,
    formatter: (params: { dataIndex: number } | { dataIndex: number }[]) =>
      card((Array.isArray(params) ? params[0]! : params).dataIndex),
  };
}
