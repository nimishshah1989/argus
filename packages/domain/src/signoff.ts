import type { Ticket } from './ticket.js';
import type { TicketEvent } from './types.js';

const MINUTE_MS = 60_000;

export interface Signoff<E extends TicketEvent = TicketEvent> {
  /** The close that asked production to sign the fix off. */
  request: E;
  /** The first confirm or dispute after it, if production has answered. */
  answer: E | null;
}

/**
 * Production is asked at a close of a ticket that has a machine and was raised by someone else. Maintenance's own
 * work request (self-started) and general work have nobody to ask.
 */
export function asksSignoff(ticket: Pick<Ticket, 'kind' | 'selfStarted'>): boolean {
  return ticket.kind !== 'general' && !ticket.selfStarted;
}

/** The latest sign-off the log holds: the last close that asked, and its answer. Null when nobody was asked. */
export function currentSignoff<E extends TicketEvent>(
  events: readonly E[],
  now?: Date,
): Signoff<E> | null {
  const seen = now ? events.filter((event) => event.at <= now) : events;
  let index = -1;
  seen.forEach((event, at) => {
    if (event.type === 'close' && event.handbackRequested) index = at;
  });
  if (index < 0) return null;
  const answer = seen
    .slice(index + 1)
    .find((event) => event.type === 'handback_confirm' || event.type === 'handback_dispute');
  return { request: seen[index] as E, answer: answer ?? null };
}

/** Whole minutes production kept the machine from maintenance: waits whose reason does not stop the SLA clock. */
function productionWaitMin(events: readonly TicketEvent[], until: Date): number {
  let total = 0;
  let from: Date | null = null;
  for (const event of events) {
    if (event.at > until) break;
    if (event.type === 'pause' && event.pausesSla === false && !from) from = event.at;
    else if (from && ['resume', 'close', 'cancel'].includes(event.type)) {
      total += event.at.getTime() - from.getTime();
      from = null;
    }
  }
  return Math.round(total / MINUTE_MS);
}

/**
 * Turnaround both ways (the scope brief): maintenance's minutes from the report to the close, less the time
 * production kept the machine; production's minutes are that wait plus the time to answer the sign-off (to `now`
 * while unanswered). Null when nobody was asked.
 */
export function signoffTurnaround(
  events: readonly TicketEvent[],
  reportedAt: Date,
  now: Date,
): { maintenanceMin: number; productionMin: number } | null {
  const signoff = currentSignoff(events, now);
  if (!signoff) return null;
  const asked = signoff.request.at;
  const wait = productionWaitMin(events, asked);
  const toClose = Math.round((asked.getTime() - reportedAt.getTime()) / MINUTE_MS);
  const toAnswer = Math.round(
    ((signoff.answer?.at ?? now).getTime() - asked.getTime()) / MINUTE_MS,
  );
  return {
    maintenanceMin: Math.max(0, toClose - wait),
    productionMin: wait + Math.max(0, toAnswer),
  };
}
