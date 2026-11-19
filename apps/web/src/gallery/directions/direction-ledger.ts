import type { Direction, Palette, Shape, Variant } from './variant.js';

/**
 * Ledger (ticket 80, D33): warm paper, ruled lines, figures set like a printed report. A ruled cell with no card,
 * the change written as a sentence under the value, a key row below a 224 px chart between two rules on the page.
 * Every colour is the slice's table.
 */
const variant: Variant = {
  tile: 'ruled',
  delta: 'words',
  legend: 'below',
  density: 'roomy',
  chartFrame: 'rules',
  chartHeight: 224,
};

/**
 * Flat: 1 px rules carry the depth and only the overlay casts a shadow. Every corner is 4 px except the ruled tile,
 * which is a cell between rules and stays square. Figures and headings take a named system serif stack (R3).
 */
const shape: Shape = {
  depth: { raised: 'none', overlay: '0 16px 40px rgb(28 25 23 / 0.2)' },
  radius: { control: 4, card: 4, sheet: 4, chip: 4, tile: 0 },
  type: {
    display: "Georgia, Cambria, 'Times New Roman', 'Noto Serif', 'Noto Sans Gujarati', serif",
    tracking: 'normal',
  },
};

const light: Palette = {
  page: '#f6f3ee',
  surface: '#fffdf9',
  'surface-2': '#faf7f2',
  line: '#ddd5c8',
  control: '#8a8178',
  ink: '#1c1917',
  'ink-2': '#57534e',
  accent: '#3538cd',
  'on-accent': '#ffffff',
  'accent-tint': '#ecebfb',
  'critical-ink': '#b42318',
  'critical-tint': '#fbe9e7',
  'critical-fill': '#c8321f',
  'attention-ink': '#8a4b08',
  'attention-tint': '#faf0dc',
  'attention-fill': '#c27803',
  'good-ink': '#2f6b2f',
  'good-tint': '#e9f2e3',
  'good-fill': '#3f8f3f',
  'info-ink': '#1e4f91',
  'info-tint': '#e6eef8',
  'info-fill': '#2f6fc0',
  'neutral-ink': '#57534e',
  'neutral-tint': '#efeae2',
  'neutral-fill': '#78716c',
  series: ['#4d43c0', '#858e2f', '#206158', '#3b91b1', '#7538a9', '#c65fca', '#923172', '#cc6789'],
  seq: ['#e8e9f7', '#babce8', '#8587d6', '#2b2e82', '#1c1e54'],
  div: ['#212363', '#8c8fd9', '#faf7f2', '#8cd9d2', '#21635e'],
};

const dark: Palette = {
  page: '#171512',
  surface: '#201d19',
  'surface-2': '#28241f',
  line: '#3a342c',
  control: '#7a7166',
  ink: '#f4efe7',
  'ink-2': '#b5ab9c',
  accent: '#a4a7ff',
  'on-accent': '#14123a',
  'accent-tint': '#25244a',
  'critical-ink': '#ff8a7a',
  'critical-tint': '#3d1a15',
  'critical-fill': '#f0604d',
  'attention-ink': '#f5b74a',
  'attention-tint': '#3a2a0e',
  'attention-fill': '#e39b1a',
  'good-ink': '#8fd18f',
  'good-tint': '#1b2e1b',
  'good-fill': '#5fb35f',
  'info-ink': '#8fb8f0',
  'info-tint': '#16263a',
  'info-fill': '#5c93dc',
  'neutral-ink': '#b5ab9c',
  'neutral-tint': '#2c2822',
  'neutral-fill': '#8a8278',
  series: ['#a7a2e0', '#707828', '#3ebbab', '#327b95', '#be9add', '#b53eba', '#db92c2', '#c1466f'],
  seq: ['#121336', '#1c1e54', '#262973', '#6e71cf', '#abade3'],
  div: ['#9c9ede', '#262973', '#28241f', '#26736c', '#9cded8'],
};

export const ledger: Direction = { variant, shape, light, dark };
