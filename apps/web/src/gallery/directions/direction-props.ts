import { TONE_ROLES, type Direction, type ToneRole } from './variant.js';

export type Theme = 'light' | 'dark';

/** What the harness hands every screen: the direction and the theme it is drawn in. */
export interface ScreenProps {
  direction: Direction;
  theme: Theme;
}

/** The kit tokens each tone role stands for (R7): a role sets the base, ink and tint of every token it names. */
const TONE_TOKENS: Record<ToneRole, string[]> = {
  critical: ['danger'],
  attention: ['warning', 'hold'],
  good: ['ok'],
  info: ['info', 'moved'],
  neutral: ['muted'],
};

/**
 * The inline custom properties one direction sets on `<html>` in one theme. The roles the kit reads are written
 * over its own tokens; series 3 to 8, the ramps and the variant's depth, corners and type live under `--proto-*`.
 * Light and dark give the same keys, so switching theme never leaves a stale value.
 */
export function directionProps(direction: Direction, theme: Theme): Record<string, string> {
  const p = direction[theme];
  const { depth, radius, type } = direction.shape;
  const out: Record<string, string> = {
    '--color-neutral-100': p.page,
    '--color-surface': p.surface,
    '--color-neutral-50': p['surface-2'],
    '--color-neutral-200': p.line,
    '--color-control': p.control,
    '--color-neutral-900': p.ink,
    '--color-neutral-600': p['ink-2'],
    '--color-accent': p.accent,
    '--color-accent-strong': p.accent,
    '--color-accent-text': p.accent,
    '--color-accent-ink': p['on-accent'],
    '--color-accent-tint': p['accent-tint'],
    '--color-chart-1': p.series[0],
    '--color-chart-2': p.series[1],
    '--proto-shadow-raised': depth.raised,
    '--proto-shadow-overlay': depth.overlay,
    '--proto-display': type.display,
    '--proto-tracking': type.tracking,
  };
  for (const role of TONE_ROLES) {
    for (const token of TONE_TOKENS[role]) {
      out[`--color-${token}`] = p[`${role}-fill`];
      out[`--color-${token}-ink`] = p[`${role}-ink`];
      out[`--color-${token}-tint`] = p[`${role}-tint`];
    }
  }
  p.series.slice(2).forEach((c, i) => (out[`--proto-series-${i + 3}`] = c));
  p.seq.forEach((c, i) => (out[`--proto-seq-${i + 1}`] = c));
  p.div.forEach((c, i) => (out[`--proto-div-${i + 1}`] = c));
  for (const [name, px] of Object.entries(radius)) out[`--proto-radius-${name}`] = `${px}px`;
  return out;
}
