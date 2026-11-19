import { statusMeaning, type StatusRef } from '../../ui/meaning.js';
import type { Tone } from '../../ui/status/index.js';

/**
 * The contract every design direction fills in (ticket 80, D33). A direction is a variant map plus a light and
 * a dark value for every role; the prototype's parts read only these, so the pick is two files.
 */
export interface Variant {
  /** Raised card, flat panel with a tone edge, or a ruled cell. */
  tile: 'card' | 'edge' | 'ruled';
  /** Tint chip, tone-ink text beside the value, or a sentence under it. */
  delta: 'chip' | 'inline' | 'words';
  /** Where a chart's series key sits. */
  legend: 'above' | 'inline' | 'below';
  /** How many tiles a row holds and how tall a row is. */
  density: 'comfortable' | 'compact' | 'roomy';
  /** Card on surface, panel on surface-2, or two rules on the page. */
  chartFrame: 'card' | 'panel' | 'rules';
  /** Chart height in px: the three the plan sets (Instrument, Control Room, Ledger). */
  chartHeight: 192 | 160 | 224;
}

export const TONE_ROLES = ['critical', 'attention', 'good', 'info', 'neutral'] as const;
export type ToneRole = (typeof TONE_ROLES)[number];

const SURFACE_ROLES = [
  'page',
  'surface',
  'surface-2',
  'line',
  'control',
  'ink',
  'ink-2',
  'accent',
  'on-accent',
  'accent-tint',
] as const;

type ToneParts = `${ToneRole}-${'ink' | 'tint' | 'fill'}`;

/** Every colour role a direction defines, in both themes: 10 neutral and accent, then ink, tint and fill per tone. */
export const ROLES = [
  ...SURFACE_ROLES,
  'critical-ink',
  'critical-tint',
  'critical-fill',
  'attention-ink',
  'attention-tint',
  'attention-fill',
  'good-ink',
  'good-tint',
  'good-fill',
  'info-ink',
  'info-tint',
  'info-fill',
  'neutral-ink',
  'neutral-tint',
  'neutral-fill',
] as const satisfies readonly ((typeof SURFACE_ROLES)[number] | ToneParts)[];

export type Role = (typeof ROLES)[number];

type Steps<N extends number, A extends string[] = []> = A['length'] extends N
  ? A
  : Steps<N, [...A, string]>;

/**
 * One theme's colours: a value for every role, 8 chart series, and a sequential and a diverging ramp of 5 steps.
 * One type for both themes, so light and dark cannot set different keys.
 */
export type Palette = Record<Role, string> & {
  series: Steps<8>;
  seq: Steps<5>;
  div: Steps<5>;
};

/** Depth, corners and type: the same in light and dark. Level 0 is the page and has no shadow. */
export interface Shape {
  /** Box-shadow of level 1 (raised) and level 2 (overlay); `none` where a direction draws lines instead. */
  depth: { raised: string; overlay: string };
  /** Corner radius in px per role. */
  radius: { control: number; card: number; sheet: number; chip: number };
  /** Font family for figures and headings (`inherit` keeps the system stack) and their letter spacing. */
  type: { display: string; tracking: string };
}

export interface Direction {
  variant: Variant;
  shape: Shape;
  light: Palette;
  dark: Palette;
}

const HEX = /^#[0-9a-f]{6}$/i;

/**
 * What is wrong with a palette, in words, for the direction tests (80i to 80k): a role that is not a hex colour,
 * a series or ramp of the wrong length, and a series that equals a status colour. Empty means fine.
 */
export function paletteProblems(p: Palette): string[] {
  const out: string[] = ROLES.filter((r) => !HEX.test(p[r])).map((r) => `${r} is not a hex colour`);
  if (p.series.length !== 8) out.push(`series has ${p.series.length} colours, not 8`);
  for (const ramp of ['seq', 'div'] as const) {
    if (p[ramp].length !== 5) out.push(`${ramp} has ${p[ramp].length} steps, not 5`);
  }
  const status = ROLES.filter((r) => TONE_ROLES.some((t) => r.startsWith(`${t}-`)));
  p.series.forEach((c, i) => {
    const hit = status.find((r) => p[r].toLowerCase() === c.toLowerCase());
    if (hit) out.push(`series ${i + 1} equals ${hit}`);
  });
  return out;
}

const ROLE_OF_TONE: Record<Tone, ToneRole> = {
  danger: 'critical',
  warning: 'attention',
  hold: 'attention',
  ok: 'good',
  info: 'info',
  moved: 'info',
  muted: 'neutral',
};

/**
 * The tone role a status wears in the directions: Waiting is amber, Transferred blue and Running grey (N1, N2).
 * Today's `ticket.running` is `ok`, so it is the one status the tone table does not decide.
 */
export function statusRole(ref: StatusRef): ToneRole {
  if (ref.group === 'ticket' && ref.id === 'running') return 'neutral';
  return ROLE_OF_TONE[statusMeaning(ref).tone];
}

const INDIAN = new Intl.NumberFormat('en-IN');

/** Indian grouping (N3): 1000000 prints "10,00,000". */
export function formatIN(n: number): string {
  return INDIAN.format(n);
}
