import type { Ticket } from '@uptimo/shared/replies';
import { formatMinutes, formatTime } from '../../../components/format.js';
import { pausedBreakdowns, pendingTasks, timeLine, typeLine } from '../../desk/openLists.js';
import { machineChip, type Translate } from '../figures/read.js';
import type { NeedItem, NeedsNowModel } from './model.js';

/** A clock that has run out on this ticket: the acknowledgement or the restore target. */
function breachOf(ticket: Ticket): 'ack' | 'restore' | 'both' | null {
  const ack = ticket.sla?.ack?.breached === true;
  const restore = ticket.sla?.restore?.breached === true;
  if (ack && restore) return 'both';
  return ack ? 'ack' : restore ? 'restore' : null;
}

export function clocksBreached(open: readonly Ticket[]): number {
  return open.filter((ticket) => breachOf(ticket) !== null).length;
}

/**
 * What needs a person now, from the desk's own `/state` only: a breached acknowledgement or restore clock, a paused
 * ticket waiting on someone, or a pending task past its expected date, oldest first. Ordinary unstarted work is the
 * Open list's job, not this strip's.
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

const BREACH = {
  ack: 'analytics.needsNow.ackBreached',
  restore: 'analytics.needsNow.restoreBreached',
  both: 'analytics.needsNow.bothBreached',
} as const;

/** The strip as the model prints it: the count line, each ticket with its way to the desk, or the all-clear. */
export function needsNowModel(
  state: { open: readonly Ticket[]; now: string },
  machines: readonly { id: string; code: string; category: string | null }[],
  t: Translate,
): NeedsNowModel {
  const items = needsNow(state.open, state.now);
  const itemOf = (ticket: Ticket): NeedItem => {
    const machine = machines.find((candidate) => candidate.id === ticket.machineId);
    const kind = typeLine(ticket);
    const line = timeLine(ticket, state.now);
    const breach = breachOf(ticket);
    return {
      id: ticket.id,
      ref: ticket.ref,
      where: machine
        ? { text: machine.code, chip: machineChip(machine.code, machine.category ?? undefined) }
        : { text: ticket.location ?? ticket.ref },
      problem: ticket.problem,
      line: `${t(kind.key, { date: kind.date ?? '' })} · ${t(line.key, {
        time: formatMinutes(line.minutes),
        since: line.since ? formatTime(line.since) : '',
      })}`,
      breach: breach === null ? null : t(BREACH[breach]),
      href: `/desk/${ticket.id}`,
    };
  };
  return {
    title: t('analytics.needsNow.title'),
    counts: t('analytics.needsNow.counts', {
      items: items.length,
      clocks: clocksBreached(state.open),
    }),
    empty: t('analytics.needsNow.empty'),
    open: t('analytics.needsNow.openTicket'),
    items: items.map(itemOf),
  };
}
