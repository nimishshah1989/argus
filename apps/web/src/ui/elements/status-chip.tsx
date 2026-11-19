import type { ReactNode } from 'react';
import { TONE_ICON, type Tone4 } from '../meaning/index.js';
import { Info, type IconComponent } from '../icon.js';
import { TONE_BOX } from './tone.js';

/** A chip's tone: the four tones of a verdict, or `info` (blue) for a note that is no verdict. */
export type ChipTone = Tone4 | 'info';

/** A tone, its icon and a word on a tint: colour is never the only signal. Not tappable (28 px). */
export function StatusChip({
  tone,
  icon,
  children,
}: {
  tone: ChipTone;
  /** A more specific icon than the tone's own. */
  icon?: IconComponent;
  children: ReactNode;
}) {
  const Icon = icon ?? (tone === 'info' ? Info : TONE_ICON[tone]);
  const box = tone === 'info' ? 'bg-info-tint text-info-ink' : TONE_BOX[tone];
  return (
    <span
      data-tone={tone}
      className={`inline-flex min-h-chip max-w-full items-center gap-2 rounded-chip px-3 text-caption font-bold ${box}`}
    >
      <Icon aria-hidden size={16} className="shrink-0" />
      <span className="min-w-0 break-words">{children}</span>
    </span>
  );
}
