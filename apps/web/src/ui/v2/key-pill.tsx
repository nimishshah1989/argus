import type { Tone } from './points.js';

/** A pill always has a meaning; plain weight (`strong`) is for text, not pills. */
export type PillTone = Exclude<Tone, 'strong'>;

/** A key pointer visible without clicking: a short word or number on a soft tint of its meaning. */
export function KeyPill({ text, tone }: { text: string; tone: PillTone }) {
  return <span className={`v2-pill v2-pill-${tone}`}>{text}</span>;
}
