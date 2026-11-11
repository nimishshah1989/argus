import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Machine, Ticket } from '../../api.js';
import { machineLabel } from '../../components/format.js';

export const rowClass =
  'flex min-h-13 items-center justify-between gap-3 rounded-xl bg-white px-4 py-3 shadow-sm';

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title}>
      <h2 className="text-sm font-medium text-neutral-600">{title}</h2>
      {children}
    </section>
  );
}

export function Empty() {
  const { t } = useTranslation();
  return <p className="mt-2 text-neutral-500">{t('desk.view.none')}</p>;
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
          <span className="block font-semibold">{ticket.ref}</span>
          <span className="block truncate text-sm text-neutral-600">
            {machineLabel(ticket, machines)}
          </span>
          <span className="block truncate text-xs text-neutral-500">{detail}</span>
        </span>
        {time && <span className="shrink-0 text-right text-xs text-neutral-500">{time}</span>}
      </Link>
    </li>
  );
}
