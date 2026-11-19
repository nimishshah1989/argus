import { luminance, parseHex } from './chart-color.js';
import type { ChartTone } from './chart-spec.js';

export interface Palette {
  /** The categorical series colours, in order; a chart cycles when it has more series than colours. */
  series: string[];
  axis: string;
  grid: string;
  font: string;
  /** A test palette may omit the tones and keep the series colours. */
  tones?: Partial<Record<ChartTone, string>>;
}

const TONES = ['danger', 'warning', 'info', 'hold', 'moved', 'ok', 'muted'] as const;

/**
 * Slots 3 to 8 until ticket 81 adds `--color-series-N`: eight colours apart in hue and lightness, none in the
 * red (345 to 50), green (90 to 160) or info-blue (205 to 235) bands, so none can pass for a status.
 * Slots 1 and 2 keep the chart tokens.
 */
export const FALLBACK_LIGHT = ['#7a7a00', '#9b59b6', '#3f2fa0', '#5bc0de', '#c2308f', '#2e2a5e'];
export const FALLBACK_DARK = ['#c9c94a', '#a64bd0', '#6a5cf0', '#7fd3ec', '#e0509f', '#ecebff'];

/** The 8 slots' tokens: the design token first, then (slots 1 and 2) the chart token. */
const SLOTS: string[][] = [
  ['--color-series-1', '--color-chart-1'],
  ['--color-series-2', '--color-chart-2'],
  ...[3, 4, 5, 6, 7, 8].map((n) => [`--color-series-${n}`]),
];

/** The one place a chart reads its colours: the 8-colour palette, the axis and grid inks and the tones. */
export function readPalette(el: HTMLElement): Palette {
  const css = getComputedStyle(el);
  const read = (name: string) => css.getPropertyValue(name).trim();
  const surface = parseHex(read('--color-surface'));
  const fallback =
    surface !== undefined && luminance(surface) < 0.4 ? FALLBACK_DARK : FALLBACK_LIGHT;
  return {
    series: SLOTS.map(
      (names, at) => names.map(read).find((value) => value !== '') ?? fallback[at - 2] ?? '',
    ),
    axis: read('--color-chart-axis'),
    grid: read('--color-chart-grid'),
    font: read('--font-sans'),
    tones: Object.fromEntries(TONES.map((tone) => [tone, read(`--color-${tone}`)])),
  };
}

/** A named tone's colour, or the fallback when the palette (a test) carries no tones. */
export function toneColor(tone: ChartTone | undefined, p: Palette, fallback?: string) {
  return (tone === undefined ? undefined : p.tones?.[tone]) ?? fallback;
}

/** The colour of series `index`, cycling through the palette. */
export function seriesColor(p: Palette, index: number): string | undefined {
  return p.series[index % p.series.length];
}
