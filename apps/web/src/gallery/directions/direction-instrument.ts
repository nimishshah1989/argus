import type { Direction, Palette, Shape, Variant } from './variant.js';

/**
 * Instrument (ticket 80, D33): refined light with layered depth, the finished version of today's world. Raised
 * cards, tint chips, a 192 px chart in a level-1 card. Every colour is the slice's table, round-3 corrections in.
 */
const variant: Variant = {
  tile: 'card',
  delta: 'chip',
  legend: 'above',
  density: 'comfortable',
  chartFrame: 'card',
  chartHeight: 192,
};

const shape: Shape = {
  depth: {
    raised: '0 1px 2px rgb(16 24 40 / 0.06), 0 4px 12px rgb(16 24 40 / 0.06)',
    overlay: '0 12px 32px rgb(16 24 40 / 0.18)',
  },
  radius: { control: 10, card: 14, sheet: 20, chip: 999, tile: 14 },
  type: { display: 'inherit', tracking: 'normal' },
};

const light: Palette = {
  page: '#f4f5f7',
  surface: '#ffffff',
  'surface-2': '#f8f9fb',
  line: '#e3e5e8',
  control: '#878d97',
  ink: '#15171a',
  'ink-2': '#5b616b',
  accent: '#0f766e',
  'on-accent': '#ffffff',
  'accent-tint': '#e3f2f0',
  'critical-ink': '#b42318',
  'critical-tint': '#fdecea',
  'critical-fill': '#d92d20',
  'attention-ink': '#93370d',
  'attention-tint': '#fef4e6',
  'attention-fill': '#dc6803',
  'good-ink': '#05603a',
  'good-tint': '#e7f6ec',
  'good-fill': '#079455',
  'info-ink': '#1d4ed8',
  'info-tint': '#e8effd',
  'info-fill': '#2e6be6',
  'neutral-ink': '#475467',
  'neutral-tint': '#eef0f3',
  'neutral-fill': '#667085',
  series: ['#10635c', '#8a8d17', '#145f79', '#847ae9', '#7522d4', '#cf52e3', '#a11a7d', '#e4568a'],
  seq: ['#e5fbf9', '#b0f2ed', '#73e8de', '#18958b', '#10605a'],
  div: ['#13726a', '#7beae0', '#f8f9fb', '#d47bea', '#5f1372'],
};

const dark: Palette = {
  page: '#0e1013',
  surface: '#171a1f',
  'surface-2': '#1e2228',
  line: '#2b3038',
  control: '#6f7785',
  ink: '#f2f4f7',
  'ink-2': '#a3abb7',
  accent: '#2dd4bf',
  'on-accent': '#04201d',
  'accent-tint': '#12302c',
  'critical-ink': '#f97066',
  'critical-tint': '#3b1714',
  'critical-fill': '#f04438',
  'attention-ink': '#fdb022',
  'attention-tint': '#3a2709',
  'attention-fill': '#f79009',
  'good-ink': '#47cd89',
  'good-tint': '#0f2e1f',
  'good-fill': '#17b26a',
  'info-ink': '#84adff',
  'info-tint': '#172440',
  'info-fill': '#528bff',
  'neutral-ink': '#a3abb7',
  'neutral-tint': '#262a31',
  'neutral-fill': '#7d8694',
  series: ['#1eb9ac', '#717413', '#32b3de', '#675ce4', '#be94ee', '#ba22d1', '#eb82cf', '#d42263'],
  seq: ['#0a3d39', '#10605a', '#15847a', '#58e4d8', '#9fefe9'],
  div: ['#8dece4', '#15847a', '#1e2228', '#6e1584', '#d98dec'],
};

export const instrument: Direction = { variant, shape, light, dark };
