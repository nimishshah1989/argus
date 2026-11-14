import type { Tone } from './status/index.js';

/** A tone as text on the page or card background (the ink, 4.5:1 or better in both themes). */
export const TONE_TEXT: Record<Tone, string> = {
  danger: 'text-danger-ink',
  info: 'text-info-ink',
  warning: 'text-warning-ink',
  hold: 'text-hold-ink',
  moved: 'text-moved-ink',
  ok: 'text-ok-ink',
  muted: 'text-muted-ink',
};
