import { Icon, type IconName } from './icons.js';
import type { Tone } from './points.js';

/** A pill always has a meaning; plain weight (`strong`) is for text, not pills. */
export type PillTone = Exclude<Tone, 'strong'> | 'neutral';

/**
 * A key pointer or a status tag, visible without clicking: a short word on a soft tint of its meaning, with an icon
 * when it names a state, so colour never carries it alone.
 */
export function KeyPill({
  text,
  tone,
  icon,
  cat,
}: {
  text: string;
  tone: PillTone;
  icon?: IconName;
  /** A category's fixed colour (1 to 5, `catOf` in table-look.ts): a dot of it before the word. */
  cat?: number;
}) {
  return (
    <span className={`v2-pill v2-pill-${tone}`} data-cat={cat} data-pill-cat={cat ? '' : undefined}>
      {icon ? <Icon name={icon} size={12} /> : null}
      {text}
    </span>
  );
}
