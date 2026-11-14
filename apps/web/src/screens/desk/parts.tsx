import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Machine, Ticket } from '../../api.js';
import { machineLabel } from '../../components/format.js';

export const rowClass =
  'flex min-h-target items-center justify-between gap-3 rounded-2xl border border-neutral-200 bg-surface px-4 py-3';

/** The small capitals over a group of cards or rows. */
export function ListHeading({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-caption font-bold tracking-wide text-neutral-600 uppercase">{children}</h2>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="flex flex-col gap-2">
      <ListHeading>{title}</ListHeading>
      {children}
    </section>
  );
}

export function Empty() {
  const { t } = useTranslation();
  return <p className="text-body text-neutral-600">{t('desk.view.none')}</p>;
}

export interface RowProps {
  ticket: Ticket;
  machines: Machine[];
  detail: string;
  time?: string;
}

export function TicketRow({ ticket, machines, detail, time }: RowProps) {
  return (
    <li>
      <Link to={`/desk/${ticket.id}`} className={rowClass}>
        <span className="min-w-0">
          <span className="block text-body font-semibold">{ticket.ref}</span>
          <span className="block truncate text-footnote text-neutral-600">
            {machineLabel(ticket, machines)}
          </span>
          <span className="block truncate text-caption text-neutral-600">{detail}</span>
        </span>
        {time && <span className="shrink-0 text-right text-caption text-neutral-600">{time}</span>}
      </Link>
    </li>
  );
}
