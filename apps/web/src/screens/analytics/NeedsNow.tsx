import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getConfig, getState, type Ticket } from '../../api.js';
import { formatMinutes, formatTime } from '../../components/format.js';
import { Card } from '../../ui/card.js';
import { LoadingState, StatusChip } from '../../ui/elements/index.js';
import { typeLine, timeLine, pausedBreakdowns, pendingTasks } from '../desk/openLists.js';

/** A clock that has run out on this ticket: the acknowledgement or the restore target. */
function breachOf(ticket: Ticket): 'ack' | 'restore' | 'both' | null {
  const ack = ticket.sla?.ack?.breached === true;
  const restore = ticket.sla?.restore?.breached === true;
  if (ack && restore) return 'both';
  if (ack) return 'ack';
  if (restore) return 'restore';
  return null;
}

export function clocksBreached(open: readonly Ticket[]): number {
  return open.filter((ticket) => breachOf(ticket) !== null).length;
}

/**
 * What needs a person now, from the existing `/state` only: a breached acknowledgement or restore clock, a
 * paused ticket waiting on someone, or a pending task past its expected date. Ordinary unstarted work is
 * the Open list's job, not this strip's.
 */
export function needsNow(open: readonly Ticket[], now: string): Ticket[] {
  const today = now.slice(0, 10);
  const picked = new Map<string, Ticket>();
  const add = (ticket: Ticket) => picked.set(ticket.id, ticket);
  open.filter((ticket) => breachOf(ticket) !== null).forEach(add);
  pausedBreakdowns([...open], '').forEach(add);
  pendingTasks([...open])
    .filter((ticket) => ticket.taskExpectedOn !== null && ticket.taskExpectedOn < today)
    .forEach(add);
  return [...picked.values()].sort((a, b) => Date.parse(a.reportedAt) - Date.parse(b.reportedAt));
}

const BREACH_KEY = {
  ack: 'analytics.needsNow.ackBreached',
  restore: 'analytics.needsNow.restoreBreached',
  both: 'analytics.needsNow.bothBreached',
} as const;

function NeedRow({ ticket, now, code }: { ticket: Ticket; now: string; code: string }) {
  const { t } = useTranslation();
  const kind = typeLine(ticket);
  const line = timeLine(ticket, now);
  const breach = breachOf(ticket);
  return (
    <li className="flex flex-wrap items-start justify-between gap-3 border-t border-neutral-200 pt-3">
      <span className="flex min-w-0 flex-col gap-1">
        <span className="text-footnote font-semibold text-neutral-900">
          {code} · {ticket.ref}
        </span>
        <span className="text-body text-neutral-900">{ticket.problem}</span>
        <span className="text-footnote text-neutral-600">
          {t(kind.key, { date: kind.date })} ·{' '}
          {t(line.key, {
            time: formatMinutes(line.minutes),
            since: line.since ? formatTime(line.since) : '',
          })}
        </span>
        {breach ? <StatusChip tone="bad">{t(BREACH_KEY[breach])}</StatusChip> : null}
      </span>
      <Link
        to={`/desk/${ticket.id}`}
        className="inline-flex min-h-target-min items-center text-footnote font-semibold text-accent-text"
      >
        {t('analytics.needsNow.openTicket')}
      </Link>
    </li>
  );
}

/**
 * The Today strip: open items and breached clocks, built from the `/state` reply the desk already reads.
 * Money never appears here: `/state` carries no money and no figure is money.
 */
export function NeedsNow() {
  const { t } = useTranslation();
  const state = useQuery({ queryKey: ['state'], queryFn: getState });
  const config = useQuery({ queryKey: ['config'], queryFn: getConfig });
  const loaded = state.data !== undefined;
  const open = state.data?.open ?? [];
  const now = state.data?.now ?? new Date().toISOString();
  const items = needsNow(open, now);
  const clocks = clocksBreached(open);
  const code = (ticket: Ticket) =>
    (ticket.machineId
      ? config.data?.machines.find((machine) => machine.id === ticket.machineId)?.code
      : null) ??
    ticket.location ??
    ticket.ref;
  return (
    <Card title={t('analytics.needsNow.title')}>
      {loaded ? (
        <p className="text-footnote text-neutral-600">
          {t('analytics.needsNow.counts', { items: items.length, clocks })}
        </p>
      ) : null}
      {!loaded ? (
        <LoadingState label={t('common.loading')} tiles={1} />
      ) : items.length === 0 ? (
        <p className="text-body text-neutral-600">{t('analytics.needsNow.empty')}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((ticket) => (
            <NeedRow key={ticket.id} ticket={ticket} now={now} code={code(ticket)} />
          ))}
        </ul>
      )}
    </Card>
  );
}
