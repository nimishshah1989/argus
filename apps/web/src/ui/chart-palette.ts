/**
 * The chart palette as data (ticket 81, D33): 8 categorical colours, one sequential and one diverging ramp, per theme.
 * The same values live in `tokens.css` as `--color-series-1..8`, `--color-ramp-seq-1..5` and `--color-ramp-div-1..5`;
 * `tokens.test.ts` fails when the two differ. A chart reads the CSS variables (so the theme switches by itself); this
 * file is for code that needs the numbers without a browser: a test, a canvas or an export.
 */
export type ChartTheme = 'light' | 'dark';

export interface ChartPalette {
  /** Series 1 to 8, in the order a chart assigns them. */
  series: readonly string[];
  /** Light to dark in light theme, dark to light in dark theme: more is always stronger. */
  seq: readonly string[];
  /** One end, a neutral middle, the other end. */
  div: readonly string[];
}

export const CHART_PALETTE: Record<ChartTheme, ChartPalette> = {
  light: {
    series: [
      '#2a9278',
      '#642b3e',
      '#78922a',
      '#6931d8',
      '#245e7b',
      '#9469bf',
      '#7d6f26',
      '#27206f',
    ],
    seq: ['#e5fbf9', '#b0f2ed', '#73e8de', '#18958b', '#10605a'],
    div: ['#13726a', '#7beae0', '#f8f9fb', '#d47bea', '#5f1372'],
  },
  dark: {
    series: [
      '#76e5e5',
      '#c63968',
      '#9cd629',
      '#ab29d6',
      '#9090ea',
      '#b3a64d',
      '#ce8da3',
      '#c9e198',
    ],
    seq: ['#0a3d39', '#10605a', '#15847a', '#58e4d8', '#9fefe9'],
    div: ['#8dece4', '#15847a', '#1e2228', '#6e1584', '#d98dec'],
  },
};

/** The CSS custom properties, in the same order as the arrays above. */
export const CHART_VARS = {
  series: Array.from({ length: 8 }, (_, i) => `--color-series-${i + 1}`),
  seq: Array.from({ length: 5 }, (_, i) => `--color-ramp-seq-${i + 1}`),
  div: Array.from({ length: 5 }, (_, i) => `--color-ramp-div-${i + 1}`),
} as const;
