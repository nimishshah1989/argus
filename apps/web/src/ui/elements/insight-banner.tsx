import type { ReactNode } from 'react';
import { TONE_ICON, type Tone4 } from '../meaning/index.js';
import { TONE_BOX, WRAP } from './tone.js';

/**
 * A finding the screen wants read first: a verdict in words with its tone's icon, one line of why, and at most one
 * action. A bad finding is announced at once (role alert); the rest politely.
 */
export function InsightBanner({
  tone,
  title,
  children,
  action,
}: {
  tone: Tone4;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  const Icon = TONE_ICON[tone];
  return (
    <div
      role={tone === 'bad' ? 'alert' : 'status'}
      data-tone={tone}
      className={`flex min-w-0 flex-col gap-3 rounded-card p-4 ${TONE_BOX[tone]}`}
    >
      <div className="flex gap-2">
        <Icon aria-hidden size={20} className="shrink-0" />
        <div className={`flex flex-col gap-1 ${WRAP}`}>
          <p className="text-body font-bold">{title}</p>
          {children ? <div className="text-footnote">{children}</div> : null}
        </div>
      </div>
      {action}
    </div>
  );
}
