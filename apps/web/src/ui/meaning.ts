import { Bot, Cog, Drill, Factory, FlaskConical, Fuel, Zap, type IconComponent } from './icon.js';
import {
  STATUS,
  type StatusDef,
  type StatusGroup,
  type StatusId,
  type Tone,
} from './status/index.js';

/**
 * The one map for icons and colour (slice 4, X1). A segment is a shape and never a colour; a status is a
 * tone, an icon and a word. Colour never works alone.
 */
const SEGMENT_ICON: Record<string, IconComponent> = {
  cnc: Cog,
  conventional: Drill,
  process: FlaskConical,
  utility: Zap,
  dg: Fuel,
  robot: Bot,
};

/** Segment codes are plant data: a code the map does not know gets a plain machine. */
export function segmentIcon(code: string): IconComponent {
  return SEGMENT_ICON[code.toLowerCase()] ?? Factory;
}

/** One status of one group, e.g. `{ group: 'ticket', id: 'stopped' }`. */
export type StatusRef = { [G in StatusGroup]: { group: G; id: StatusId<G> } }[StatusGroup];

export function statusMeaning({ group, id }: StatusRef): StatusDef {
  return (STATUS[group] as Record<string, StatusDef>)[id]!;
}

/** The accent marks a choice ("All"), never a status. */
export type ChipTone = Tone | 'accent';

/** Ink on its tint, 4.5:1 or better in both themes (`tokens.test.ts`). */
export const TONE_FILL: Record<ChipTone, string> = {
  danger: 'bg-danger-tint text-danger-ink',
  info: 'bg-info-tint text-info-ink',
  warning: 'bg-warning-tint text-warning-ink',
  hold: 'bg-hold-tint text-hold-ink',
  moved: 'bg-moved-tint text-moved-ink',
  ok: 'bg-ok-tint text-ok-ink',
  muted: 'bg-muted-tint text-muted-ink',
  accent: 'bg-accent-tint text-accent-text',
};

/** A tone as text on the page or card background. */
export const TONE_TEXT: Record<ChipTone, string> = {
  danger: 'text-danger-ink',
  info: 'text-info-ink',
  warning: 'text-warning-ink',
  hold: 'text-hold-ink',
  moved: 'text-moved-ink',
  ok: 'text-ok-ink',
  muted: 'text-muted-ink',
  accent: 'text-accent-text',
};
