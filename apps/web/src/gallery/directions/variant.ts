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
  /** Chart height in px (192, 160 or 224 in the three plan directions). */
  chartHeight: number;
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

export type Role = (typeof SURFACE_ROLES)[number] | `${ToneRole}-${'ink' | 'tint' | 'fill'}`;

/** Every colour role a direction defines, in both themes: 10 neutral and accent, then ink, tint and fill per tone. */
export const ROLES = [
  ...SURFACE_ROLES,
  ...TONE_ROLES.flatMap((t) => [`${t}-ink`, `${t}-tint`, `${t}-fill`] as const),
] as readonly Role[];

/** One theme's colours: a value for every role, so light and dark cannot set different keys. */
export type Palette = Record<Role, string>;

export interface Direction {
  variant: Variant;
  light: Palette;
  dark: Palette;
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
