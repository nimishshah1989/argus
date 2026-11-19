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

/** The 8 categorical slots, each as the design tokens to try in order (ticket 81 adds `--color-series-N`). */
const SLOTS: string[][] = [
  ['--color-series-1', '--color-chart-1'],
  ['--color-series-2', '--color-chart-2'],
  ['--color-series-3', '--color-info'],
  ['--color-series-4', '--color-moved'],
  ['--color-series-5', '--color-warning'],
  ['--color-series-6', '--color-hold'],
  ['--color-series-7', '--color-ok'],
  ['--color-series-8', '--color-muted'],
];

/** The one place a chart reads its colours: the 8-colour palette, the axis and grid inks and the tones. */
export function readPalette(el: HTMLElement): Palette {
  const css = getComputedStyle(el);
  const read = (name: string) => css.getPropertyValue(name).trim();
  return {
    series: SLOTS.map((names) => names.map(read).find((value) => value !== '') ?? ''),
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
