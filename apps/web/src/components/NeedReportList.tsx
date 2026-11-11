import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getConfig, type Machine, type Ticket } from '../api.js';
import { formatDateTime, machineLabel } from './format.js';

interface Props {
  tickets: Ticket[];
  machines: Machine[];
}

/**
 * The closed-without-report list (SPEC 1.6): a seven-day reminder on the desk, hidden when empty.
 * Each row opens the ticket, where the late report is filed through the existing report form.
 */
export function NeedReportList({ tickets, machines }: Props) {
  const { t } = useTranslation();
  const config = useQuery({ queryKey: ['config'], queryFn: getConfig });
  if (tickets.length === 0) return null;
  return (
    <section aria-label={t('desk.needsReport')} className="mt-6">
      <h2 className="text-sm font-medium text-neutral-600">
        {t('desk.needsReport')} <span className="text-neutral-400">({tickets.length})</span>
      </h2>
      <ul className="mt-3 grid gap-2">
        {tickets.map((ticket) => (
          <li key={ticket.id}>
            <Link
              to={`/desk/${ticket.id}`}
              className="flex min-h-13 items-center justify-between gap-3 rounded-xl border border-waiting/40 bg-white px-4 py-3 shadow-sm"
            >
              <span className="min-w-0">
                <span className="block font-semibold">{ticket.ref}</span>
                <span className="block truncate text-sm text-neutral-600">
                  {machineLabel(ticket, machines)}
                </span>
              </span>
              <span className="shrink-0 text-right text-xs text-neutral-500">
                <span className="block">{t('ticket.fact.closed')}</span>
                <span className="block">
                  {ticket.closedAt ? formatDateTime(ticket.closedAt, config.data?.timeZone) : ''}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
