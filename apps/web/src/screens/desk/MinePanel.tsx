/* eslint-disable i18next/no-literal-string -- prop values, ids and routes only; every visible string goes through t() */
import { useState, type MouseEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { ActorContext } from '@uptimo/domain';
import { getMe, getToken, type CommandAction, type Machine, type Ticket } from '../../api.js';
import { quickSpec } from '../../components/actionSpecs.js';
import { elapsedLabel, errorMessage, machineLabel } from '../../components/format.js';
import { TicketCard } from '../../components/TicketCard.js';
import { Banner } from '../../ui/banner.js';
import { LoadingState } from '../../ui/elements/states.js';
import { Empty, Section, TicketRow, rowClass } from './parts.js';
import { useTicketWindow } from './useTicketWindow.js';
import { CLOSED_WINDOW_MS, closedLast30Days, dayReportHref, todayDate } from './views.js';

export interface CardContext {
  now: string;
  machines: Machine[];
  names: Record<string, string>;
  actor: ActorContext | null;
  pending: boolean;
  onQuick: (ticket: Ticket, action: CommandAction) => void;
}

/** Ticket cards under a hint line, or what to say when there are none. */
export function CardList({
  tickets,
  empty,
  ctx,
}: {
  tickets: Ticket[];
  empty: string;
  ctx: CardContext;
}) {
  if (tickets.length === 0) return <p className="text-body text-neutral-600">{empty}</p>;
  return (
    <ul className="flex flex-col gap-3">
      {tickets.map((ticket) => (
        <li key={ticket.id}>
          <TicketCard
            ticket={ticket}
            now={ctx.now}
            machineCode={machineLabel(ticket, ctx.machines)}
            names={ctx.names}
            quick={ctx.actor ? quickSpec(ticket, ctx.actor) : null}
            pending={ctx.pending}
            onQuick={ctx.onQuick}
          />
        </li>
      ))}
    </ul>
  );
}

interface ListProps {
  title: string;
  tickets: Ticket[];
  machines: Machine[];
  time: (ticket: Ticket) => string;
}

function TicketSection({ title, tickets, machines, time }: ListProps) {
  return (
    <Section title={title}>
      {tickets.length === 0 ? (
        <Empty />
      ) : (
        <ul className="flex flex-col gap-2">
          {tickets.map((ticket) => (
            <TicketRow
              key={ticket.id}
              ticket={ticket}
              machines={machines}
              detail={machineLabel(ticket, machines)}
              time={time(ticket)}
            />
          ))}
        </ul>
      )}
    </Section>
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
        className={`${rowClass} text-body font-semibold`}
      >
        {t('desk.mine.dayReport')}
      </a>
      {failed && <Banner tone="error" title={t('desk.mine.dayReportError')} />}
    </section>
  );
}

/** The Mine tab: my jobs in progress and waiting as cards, my closed 30 days, and the day report. */
export function MinePanel({ ctx }: { ctx: CardContext }) {
  const { t } = useTranslation();
  const me = useQuery({ queryKey: ['me'], queryFn: getMe });
  const personId = me.data?.user.actingPersonId;
  const shared = me.data?.user.shared ?? false;
  const since = Date.now() - CLOSED_WINDOW_MS;
  const mine = useTicketWindow(
    {
      ...(shared ? {} : { personId: personId ?? undefined }),
      status: ['working', 'waiting', 'closed'],
    },
    since,
  );
  const tickets = mine.items;
  const working = tickets.filter((ticket) => ticket.status === 'working');
  const waiting = tickets.filter((ticket) => ticket.status === 'waiting');
  const closed = closedLast30Days(tickets);
  if (mine.loading && tickets.length === 0)
    return <LoadingState label={t('common.loading')} tiles={1} />;
  if (mine.error) return <Banner tone="error" title={errorMessage(mine.error)} />;
  return (
    <>
      <Section title={t('status.working')}>
        <CardList tickets={working} empty={t('desk.view.none')} ctx={ctx} />
      </Section>
      <Section title={t('status.waiting')}>
        <CardList tickets={waiting} empty={t('desk.view.none')} ctx={ctx} />
      </Section>
      <TicketSection
        title={t('desk.view.closed30d')}
        tickets={closed}
        machines={ctx.machines}
        time={(ticket) => elapsedLabel(ticket.closedAt ?? ticket.reportedAt)}
      />
      <DayReport />
    </>
  );
}
