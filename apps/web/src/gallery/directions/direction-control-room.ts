import type { Direction, Palette, Shape, Variant } from './variant.js';

/**
 * Control Room (ticket 80, D33): dense, signals stand out of a graphite ground, TV-ready. A flat panel with a 3 px
 * tone edge, the delta in tone ink beside the value, a 160 px chart on surface-2. Every colour is the slice's table,
 * round-3 corrections in.
 */
const variant: Variant = {
  tile: 'edge',
  delta: 'inline',
  legend: 'inline',
  density: 'compact',
  chartFrame: 'panel',
  chartHeight: 160,
};

/** No shadow: surface steps and a 1 px line carry the depth. The edge tile takes the card radius. */
const shape: Shape = {
  depth: { raised: 'none', overlay: 'none' },
  radius: { control: 6, card: 8, sheet: 12, chip: 4, tile: 8 },
  type: { display: 'inherit', tracking: '-0.02em' },
};

const light: Palette = {
  page: '#eef1f5',
  surface: '#ffffff',
  'surface-2': '#f6f8fa',
  line: '#dfe4ea',
  control: '#7c8796',
  ink: '#0b1220',
  'ink-2': '#4a5568',
  accent: '#0e7490',
  'on-accent': '#ffffff',
  'accent-tint': '#e0f2f7',
  'critical-ink': '#b91c1c',
  'critical-tint': '#fdeaea',
  'critical-fill': '#dc2626',
  'attention-ink': '#92400e',
  'attention-tint': '#fdf1dc',
  'attention-fill': '#cf7206',
  'good-ink': '#166534',
  'good-tint': '#e5f5ea',
  'good-fill': '#159f48',
  'info-ink': '#1d4ed8',
  'info-tint': '#e7eefd',
  'info-fill': '#2563eb',
  'neutral-ink': '#4a5568',
  'neutral-tint': '#e9edf2',
  'neutral-fill': '#64748b',
  series: ['#095e6f', '#798f0c', '#08614a', '#7478f4', '#5f19ec', '#c64ff1', '#9e0d81', '#f04181'],
  seq: ['#e3f8fd', '#aae9f8', '#68d7f3', '#0d83a0', '#085568'],
  div: ['#0a647b', '#71daf4', '#f6f8fa', '#f471c4', '#7b0a51'],
};

const dark: Palette = {
  page: '#0b0f14',
  surface: '#121821',
  'surface-2': '#19212c',
  line: '#2a3544',
  control: '#5f6e82',
  ink: '#e6edf5',
  'ink-2': '#9aa7b8',
  accent: '#22d3ee',
  'on-accent': '#04141a',
  'accent-tint': '#0b2a33',
  'critical-ink': '#ff7a7a',
  'critical-tint': '#3a1418',
  'critical-fill': '#ff5c5c',
  'attention-ink': '#ffb84d',
  'attention-tint': '#3a2808',
  'attention-fill': '#ffa41b',
  'good-ink': '#4ade80',
  'good-tint': '#0e2e1c',
  'good-fill': '#22c55e',
  'info-ink': '#7cb8ff',
  'info-tint': '#11233d',
  'info-fill': '#3b9bff',
  'neutral-ink': '#9aa7b8',
  'neutral-tint': '#1f2733',
  'neutral-fill': '#6b7a8f',
  series: ['#11b4d4', '#65770a', '#0fba90', '#565cf1', '#b594f6', '#b113eb', '#f476db', '#d8115a'],
  seq: ['#053642', '#085568', '#0b748e', '#4cd0f0', '#97e4f7'],
  div: ['#84dff5', '#0b748e', '#19212c', '#8e0b5e', '#f584cc'],
};

export const controlRoom: Direction = { variant, shape, light, dark };
