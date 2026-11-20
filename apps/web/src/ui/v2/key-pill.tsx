import { Icon, type IconName } from './icons.js';
import type { Tone } from './points.js';

/** A pill always has a meaning; plain weight (`strong`) is for text, not pills. */
export type PillTone = Exclude<Tone, 'strong'> | 'neutral';

/**
 * A key pointer or a status tag, visible without clicking: a short word on a soft tint of its meaning, with an icon
 * when it names a state, so colour never carries it alone.
 */
export function KeyPill({ text, tone, icon }: { text: string; tone: PillTone; icon?: IconName }) {
  return (
    <span className={`v2-pill v2-pill-${tone}`}>
      {icon ? <Icon name={icon} size={12} /> : null}
      {text}
    </span>
  );
}
