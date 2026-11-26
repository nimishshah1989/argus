import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import type { IconComponent } from './icon.js';
import type { Tone } from './status/index.js';
import { TONE_TEXT } from './meaning.js';

export interface ToneLine {
  text: string;
  tone: Tone;
  icon?: IconComponent;
}

/**
 * One ticket in a list: machine code, ref chip and status on top, then what kind of job it is, the problem,
 * who reported it and how long it has waited. The top part opens the ticket; the card's own action sits under it.
 */
export function TicketCard({
  to,
  title,
  refLabel,
  status,
  kind,
  problem,
  meta,
  time,
  extra,
  children,
}: {
  to: string;
  title: string;
  refLabel: string;
  status: ReactNode;
  kind?: ToneLine;
  problem: string;
  meta: string;
  time?: ToneLine;
  /** More lines inside the link, e.g. SLA timers. */
  extra?: ReactNode;
  /** The card's action: a tonal button, maybe a quiet one under it. */
  children?: ReactNode;
}) {
  const KindIcon = kind?.icon;
  return (
    <article className="flex flex-col gap-3 rounded-2xl bg-surface p-4 shadow-card has-[a[aria-current=page]]:ring-2 has-[a[aria-current=page]]:ring-accent-strong">
      <NavLink to={to} className="flex flex-col gap-1 rounded-lg">
        <span className="flex items-start justify-between gap-2">
          <span className="flex items-baseline gap-2">
            <span className="text-title3 font-bold">{title}</span>
            <span className="rounded-md bg-neutral-200 px-1.5 font-mono text-caption text-neutral-700">
              {refLabel}
            </span>
          </span>
          {status}
        </span>
        {kind ? (
          <span
            className={`flex items-center gap-1 text-footnote font-bold ${TONE_TEXT[kind.tone]}`}
          >
            {KindIcon ? <KindIcon aria-hidden size={16} /> : null}
            {kind.text}
          </span>
        ) : null}
        <span className="text-body text-neutral-900">{problem}</span>
        <span className="flex items-start justify-between gap-2 text-footnote text-neutral-600">
          <span>{meta}</span>
          {time ? (
            <span className={`shrink-0 text-right font-bold ${TONE_TEXT[time.tone]}`}>
              {time.text}
            </span>
          ) : null}
        </span>
        {extra}
      </NavLink>
      {children}
    </article>
  );
}
