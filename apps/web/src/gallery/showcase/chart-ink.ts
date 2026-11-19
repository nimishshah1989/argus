import type { Family } from './families.js';
import { reducedMotion } from './motion.js';

/** The colours a chart reads from the page's custom properties, so a direction or theme change reaches it. */
export interface Ink {
  accent: string;
  accentTint: string;
  ink: string;
  ink2: string;
  line: string;
  surface: string;
  seq: string[];
  font: string;
  /** The chart's width in px when it was last built, for choices that depend on room. */
  width: number;
}

/** `family` swaps the chart's accent for that metric family's identity colour (ticket 80u); the rest stays neutral. */
export function readInk(el: HTMLElement, family?: Family): Ink {
  const css = getComputedStyle(el);
  const read = (name: string) => css.getPropertyValue(name).trim();
  return {
    accent: read(family ? `--color-family-${family}` : '--color-accent'),
    accentTint: read(family ? `--color-family-${family}-tint` : '--color-accent-tint'),
    ink: read('--color-neutral-900'),
    ink2: read('--color-neutral-600'),
    line: read('--color-neutral-200'),
    surface: read('--color-surface'),
    seq: [1, 2, 3, 4, 5].map((n) => read(`--proto-seq-${n}`)),
    font: read('--font-sans'),
    width: el.clientWidth,
  };
}

/** The tooltip frame every showcase chart shares: no ECharts box at all, so the card in `formatter` is the whole tooltip. */
export function tooltipBase(axisPointer: Record<string, unknown>, card: (index: number) => string) {
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
