import { useTranslation } from 'react-i18next';
import type { Config, Machine } from '../../api.js';
import {
  elapsedLabel,
  errorMessage,
  formatMinutes,
  machineLabel,
} from '../../components/format.js';
import {
  CANCELLED_WINDOW_MS,
  CLOSED_WINDOW_MS,
  cancelledLast24h,
  closedLast30Days,
  monthlyTotals,
  ticketTime,
  type MonthTotals,
} from './views.js';
import { Empty, Section, TicketRow } from './parts.js';
import { useTicketWindow } from './useTicketWindow.js';

function names(config?: Config): Record<string, string> {
  const map: Record<string, string> = {};
  for (const person of config?.people ?? []) map[person.id] = person.name;
  return map;
}

function monthLabel(month: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${month}-01T00:00:00Z`));
}

function MonthList({ totals, config }: { totals: MonthTotals[]; config?: Config }) {
  const { t } = useTranslation();
  const people = names(config);
  return (
    <div className="mt-4 space-y-3">
      <h3 className="text-xs font-medium text-neutral-500">{t('desk.view.monthly')}</h3>
      {totals.map((month) => (
        <div key={month.month} className="rounded-xl bg-white p-3 shadow-sm">
          <p className="text-sm font-medium">{monthLabel(month.month)}</p>
          <ul className="mt-1 space-y-1">
            {month.rows.map((row) => (
              <li key={row.personId} className="flex justify-between gap-3 text-sm">
                <span>{people[row.personId] ?? t('common.teamMember')}</span>
                <span className="text-right text-neutral-600">
                  <span className="block">
                    {formatMinutes(row.primary)} {t('role.primary')}
                  </span>
                  {row.support > 0 && (
                    <span className="block">
                      {formatMinutes(row.support)} {t('role.support')}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export function RecentCancelled({ machines }: { machines: Machine[] }) {
  const { t } = useTranslation();
  const query = useTicketWindow({ status: ['cancelled'] }, Date.now() - CANCELLED_WINDOW_MS);
  const cancelled = cancelledLast24h(query.items);
  return (
    <Section title={t('desk.view.cancelled24h')}>
      {query.loading ? (
        <p className="mt-2 text-neutral-500">{t('common.loading')}</p>
      ) : query.error ? (
        <p role="alert" className="mt-2 rounded-xl bg-stopped/10 p-3 text-stopped">
          {errorMessage(query.error)}
        </p>
      ) : cancelled.length === 0 ? (
        <Empty />
      ) : (
        <ul className="mt-3 grid gap-2">
          {cancelled.map((ticket) => (
            <TicketRow
              key={ticket.id}
              ticket={ticket}
              machines={machines}
              detail={machineLabel(ticket, machines)}
              time={elapsedLabel(new Date(ticketTime(ticket)).toISOString())}
            />
          ))}
        </ul>
      )}
    </Section>
  );
}

export function ClosedTotals({ machines, config }: { machines: Machine[]; config?: Config }) {
  const { t } = useTranslation();
  const query = useTicketWindow({ status: ['closed'] }, Date.now() - CLOSED_WINDOW_MS);
  const closed = closedLast30Days(query.items);
  const totals = monthlyTotals(closed);
  return (
    <Section title={t('desk.view.closed30d')}>
      {query.loading ? (
        <p className="mt-2 text-neutral-500">{t('common.loading')}</p>
      ) : query.error ? (
        <p role="alert" className="mt-2 rounded-xl bg-stopped/10 p-3 text-stopped">
          {errorMessage(query.error)}
        </p>
      ) : closed.length === 0 ? (
        <Empty />
      ) : (
        <>
          <ul className="mt-3 grid gap-2">
            {closed.map((ticket) => (
              <TicketRow
                key={ticket.id}
                ticket={ticket}
                machines={machines}
                detail={machineLabel(ticket, machines)}
                time={elapsedLabel(ticket.closedAt ?? ticket.reportedAt)}
              />
            ))}
          </ul>
          <MonthList totals={totals} config={config} />
        </>
      )}
    </Section>
  );
}
