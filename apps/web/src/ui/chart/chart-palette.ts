import { luminance, parseHex } from './chart-color.js';
import type { ChartMeaning, ChartTone } from './chart-spec.js';

export interface Palette {
  /** The categorical series colours, in order; a chart cycles when it has more series than colours. */
  series: string[];
  axis: string;
  grid: string;
  font: string;
  /** A test palette may omit the tones and keep the series colours. */
  tones?: Partial<Record<ChartTone, string>>;
  /** The meaning colours (loss red, planned blue, gain green); a test palette may omit them and keep the series colours. */
  meanings?: Partial<Record<Exclude<ChartMeaning, 'neutral'>, string>>;
  /** The card's surface: the gaps of a striped (planned) bar are drawn in it. */
  surface?: string;
  /** The chart box's width in px when known: the category labels are laid out to fit it. */
  width?: number;
  /** The box has a size of its own and cannot grow or scroll (the v1 chart): labels keep ECharts' own spacing. */
  fixed?: boolean;
}

const TONES = ['danger', 'warning', 'info', 'hold', 'moved', 'ok', 'muted'] as const;

/**
 * Slots 3 to 8 until ticket 81 adds `--color-series-N`: eight colours apart in hue and lightness, none in the
 * red (345 to 50), green (90 to 160) or info-blue (205 to 235) bands, so none can pass for a status.
 * Slots 1 and 2 keep the chart tokens.
 */
export const FALLBACK_LIGHT = ['#7a7a00', '#9b59b6', '#3f2fa0', '#348da6', '#c2308f', '#2e2a5e'];
export const FALLBACK_DARK = ['#c9c94a', '#a64bd0', '#6a5cf0', '#7fd3ec', '#e0509f', '#ecebff'];

/**
 * The 8 slots' tokens. Slots 1 and 2 are the chart tokens first (the accent, which follows the tenant's accent, and
 * the neutral), as every chart drew them before the palette existed; the series tokens are their fallback.
 */
const SLOTS: string[][] = [
  ['--color-chart-1', '--color-series-1'],
  ['--color-chart-2', '--color-series-2'],
  ...[3, 4, 5, 6, 7, 8].map((n) => [`--color-series-${n}`]),
];

/** The one place a chart reads its colours: the 8-colour palette, the axis and grid inks and the tones. */
export function readPalette(el: HTMLElement): Palette {
  const css = getComputedStyle(el);
  const read = (name: string) => css.getPropertyValue(name).trim();
  const fixed = !el.classList.contains('v2-trend');
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
    meanings: {
      loss: read('--color-v2-loss-fill'),
      planned: read('--color-v2-plan-fill'),
      gain: read('--color-v2-gain-fill'),
    },
    surface: read('--color-v2-panel'),
    fixed,
    width: fixed ? undefined : el.clientWidth || undefined,
  };
}

/** A series' colour: its tone, else its meaning, else its palette slot (`index`, cycling). */
export function paintOf(
  series: { tone?: ChartTone; meaning?: ChartMeaning },
  p: Palette,
  index: number,
): string | undefined {
  const { meaning } = series;
  const paint = meaning === undefined || meaning === 'neutral' ? undefined : p.meanings?.[meaning];
  return toneColor(series.tone, p, paint || seriesColor(p, index));
}

/** A named tone's colour, or the fallback when the palette (a test) carries no tones. */
export function toneColor(tone: ChartTone | undefined, p: Palette, fallback?: string) {
  return (tone === undefined ? undefined : p.tones?.[tone]) ?? fallback;
}

/** The colour of series `index`, cycling through the palette. */
export function seriesColor(p: Palette, index: number): string | undefined {
  return p.series[index % p.series.length];
}
