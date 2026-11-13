import { useState, type MouseEvent } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getMe, getToken, listTickets, type Machine, type Ticket } from '../../api.js';
import { elapsedLabel, errorMessage, machineLabel } from '../../components/format.js';
import { closedLast30Days, dayReportHref, todayDate } from './views.js';

const rowClass =
  'flex min-h-13 items-center justify-between gap-3 rounded-xl bg-white px-4 py-3 shadow-sm';

function TicketRow({
  ticket,
  machines,
  time,
}: {
  ticket: Ticket;
  machines: Machine[];
  time: string;
}) {
  return (
    <li>
      <Link to={`/desk/${ticket.id}`} className={rowClass}>
        <span className="min-w-0">
          <span className="block font-semibold">{ticket.ref}</span>
          <span className="block truncate text-sm text-neutral-600">
            {machineLabel(ticket, machines)}
          </span>
        </span>
        <span className="shrink-0 text-right text-xs text-neutral-500">{time}</span>
      </Link>
    </li>
  );
}

interface ListProps {
  title: string;
  tickets: Ticket[];
  machines: Machine[];
  time: (ticket: Ticket) => string;
}

function TicketSection({ title, tickets, machines, time }: ListProps) {
  const { t } = useTranslation();
  return (
    <section aria-label={title}>
      <h2 className="text-sm font-medium text-neutral-600">{title}</h2>
      {tickets.length === 0 ? (
        <p className="mt-2 text-neutral-500">{t('desk.view.none')}</p>
      ) : (
        <ul className="mt-3 grid gap-2">
          {tickets.map((ticket) => (
            <TicketRow key={ticket.id} ticket={ticket} machines={machines} time={time(ticket)} />
          ))}
        </ul>
      )}
    </section>
  );
}

function DayReport() {
  const { t } = useTranslation();
  const [failed, setFailed] = useState(false);

  async function download(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    setFailed(false);
    const token = getToken();
    try {
      const res = await fetch(dayReportHref(), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        setFailed(true);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `day-report-${todayDate()}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setFailed(true);
    }
  }

  return (
    <section aria-label={t('desk.mine.dayReport')}>
      <a
        href={dayReportHref()}
        download
        onClick={(event) => void download(event)}
        className="flex min-h-13 items-center justify-center rounded-xl border border-neutral-300 bg-white px-4 text-base font-semibold text-neutral-900 hover:bg-neutral-100"
      >
        {t('desk.mine.dayReport')}
      </a>
      {failed && (
        <p role="alert" className="mt-2 rounded-xl bg-stopped/10 p-3 text-stopped">
          {t('desk.mine.dayReportError')}
        </p>
      )}
    </section>
  );
}

/** The Mine tab: my working/waiting tickets, my closed 30 days, and the day report. */
export function MinePanel({ machines }: { machines: Machine[] }) {
  const { t } = useTranslation();
  const me = useQuery({ queryKey: ['me'], queryFn: getMe });
  const personId = me.data?.user.actingPersonId;
  const shared = me.data?.user.shared ?? false;
  const mine = useQuery({
    queryKey: ['tickets', 'mine', personId, shared],
    queryFn: () =>
      listTickets({
        ...(shared ? {} : { personId: personId ?? undefined }),
        status: ['working', 'waiting', 'closed'],
        limit: 200,
      }),
    enabled: Boolean(personId) || shared,
    staleTime: 0,
  });
  const tickets = mine.data?.items ?? [];
  const working = tickets.filter((ticket) => ticket.status === 'working');
  const waiting = tickets.filter((ticket) => ticket.status === 'waiting');
  const closed = closedLast30Days(tickets);
  return (
    <div className="mt-6 space-y-6">
      <DayReport />
      {mine.isLoading ? (
        <p className="text-neutral-500">{t('common.loading')}</p>
      ) : mine.error ? (
        <p role="alert" className="rounded-xl bg-stopped/10 p-3 text-stopped">
          {errorMessage(mine.error)}
        </p>
      ) : (
        <>
          <TicketSection
            title={t('status.working')}
            tickets={working}
            machines={machines}
            time={(ticket) => elapsedLabel(ticket.startedAt ?? ticket.reportedAt)}
          />
          <TicketSection
            title={t('status.waiting')}
            tickets={waiting}
            machines={machines}
            time={(ticket) => elapsedLabel(ticket.reportedAt)}
          />
          <TicketSection
            title={t('desk.view.closed30d')}
            tickets={closed}
            machines={machines}
            time={(ticket) => elapsedLabel(ticket.closedAt ?? ticket.reportedAt)}
          />
        </>
      )}
    </div>
  );
}
