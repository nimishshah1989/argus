import { useEffect, useRef, useState, type RefObject } from 'react';
import { loadEcharts } from './use-chart.js';

/**
 * The interactive door to the chart kit (ticket 80t). `useChart` draws a fixed spec; this hook hands the page an
 * ECharts instance for charts that need an option of their own: a crosshair, a designed tooltip, linked highlights.
 * ECharts itself is still reached only through `use-chart.ts` (the chart guard); this file never imports it.
 */

/** The part of an ECharts instance a page uses: options, size, events and actions. */
export interface Instance {
  setOption(option: object): void;
  resize(): void;
  dispose(): void;
  on(event: string, handler: (e: unknown) => void): void;
  dispatchAction(action: object): void;
}

/** Below this width a chart builds its narrow layout; crossing it rebuilds the option. */
export const NARROW = 520;

const reduced = (): boolean => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** The draw-in every interactive chart shares: once, 700 ms, ease-out; off under reduced motion. */
export function motionOption(): object {
  return {
    animation: !reduced(),
    animationDuration: 700,
    animationEasing: 'cubicOut',
    animationDurationUpdate: 320,
    animationEasingUpdate: 'cubicInOut',
  };
}

/**
 * Mount one ECharts instance (SVG) in the returned element and keep its option current. `make` gets the element
 * (to read colours from) and runs when the chart is ready and whenever `deps` change; options merge, so a changed
 * series moves instead of redrawing. The option is rebuilt when the element crosses `NARROW`. `onReady` hands the
 * instance out once, for event wiring.
 */
export function useEchart(
  make: (el: HTMLElement) => object,
  deps: readonly unknown[],
  onReady?: (chart: Instance) => void,
): { ref: RefObject<HTMLDivElement | null>; chart: RefObject<Instance | null>; ready: boolean } {
  const ref = useRef<HTMLDivElement>(null);
  const chart = useRef<Instance | null>(null);
  const [ready, setReady] = useState(false);
  const ready0 = useRef(onReady);
  ready0.current = onReady;
  const make0 = useRef(make);
  make0.current = make;

  useEffect(() => {
    let dead = false;
    let watch: ResizeObserver | undefined;
    void loadEcharts().then((core) => {
      const el = ref.current;
      if (dead || !el) return;
      const instance = core.init(el, undefined, { renderer: 'svg' }) as unknown as Instance;
      chart.current = instance;
      const narrow = () => el.clientWidth < NARROW;
      let wasNarrow = narrow();
      watch = new ResizeObserver(() => {
        instance.resize();
        if (narrow() === wasNarrow) return;
        wasNarrow = narrow();
        instance.setOption({ ...make0.current(el), animation: false });
      });
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
    chart.current.setOption({ ...motionOption(), ...make0.current(el) });
  }, [ready, ...deps]);

  return { ref, chart, ready };
}
