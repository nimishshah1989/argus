import type { Ticket } from '../../../api.js';
import { pausedBreakdowns, pendingTasks } from '../../desk/openLists.js';

/** A clock that has run out on this ticket: the acknowledgement or the restore target. */
export function breachOf(ticket: Ticket): 'ack' | 'restore' | 'both' | null {
  const ack = ticket.sla?.ack?.breached === true;
  const restore = ticket.sla?.restore?.breached === true;
  if (ack && restore) return 'both';
  if (ack) return 'ack';
  if (restore) return 'restore';
  return null;
}

/** How many open tickets have a clock that has run out, once per ticket whatever the clock. */
export function clocksBreached(open: readonly Ticket[]): number {
  return open.filter((ticket) => breachOf(ticket) !== null).length;
}

/**
 * What needs a person now, from the desk's `/state` only: a breached acknowledgement or restore clock, a paused
 * ticket waiting on someone, or a pending task past its expected date. Ordinary unstarted work is the Open list's
 * job, not this one. Oldest first, each ticket once.
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
