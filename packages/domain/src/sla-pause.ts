import { remainingSlaMinutes, slaBreached } from './sla.js';
import type { SlaProjectionInput, SlaStopReason, SlaTimerProjection } from './sla.js';
import type { TicketEvent } from './types.js';

const MINUTE_MS = 60_000;

type PauseEnd = Extract<SlaStopReason, 'resumed' | 'closed' | 'cancelled'>;

interface Episode {
  start: Date;
  end: { at: Date; reason: PauseEnd } | null;
}

const ENDS: Partial<Record<TicketEvent['type'], PauseEnd>> = {
  resume: 'resumed',
  close: 'closed',
  cancel: 'cancelled',
};

function step(current: Episode | null, event: TicketEvent): Episode | null {
  const open = current !== null && current.end === null;
  if (event.type === 'pause') return open ? current : { start: event.at, end: null };
  const reason = ENDS[event.type];
  if (reason) return open ? { start: current.start, end: { at: event.at, reason } } : current;
  // A cancelled ticket that was paused comes back paused; the time it was cancelled does not count.
  if (event.type === 'restore' && current?.end?.reason === 'cancelled') {
    return { start: event.at, end: null };
  }
  return current;
}

/** The latest stretch of time the ticket sat in a waiting state, or null if it never did. */
function lastPause(events: readonly TicketEvent[], now: Date): Episode | null {
  let current: Episode | null = null;
  for (const event of events) if (event.at <= now) current = step(current, event);
  return current;
}

/**
 * The pause clock: how long a ticket may stay waiting. Runs from the start of the pause, is due after the
 * policy's maximum and stops when work resumes, the ticket closes or it is cancelled. Wall-clock minutes,
 * whatever the policy says about business hours. No clock without a maximum or without a pause.
 */
export function projectPauseTimer(input: SlaProjectionInput): SlaTimerProjection | null {
  const maxMinutes = input.policy.pauseMaxMinutes;
  if (maxMinutes == null) return null;
  const pause = lastPause(input.events, input.now);
  if (!pause) return null;
  const dueAt = new Date(pause.start.getTime() + maxMinutes * MINUTE_MS);
  const end = pause.end;
  return {
    id: `${input.ticket.id}:pause`,
    state: end ? 'stopped' : 'running',
    breached: end ? dueAt < end.at : slaBreached(dueAt, input.now),
    dueAt,
    pausedAt: null,
    stoppedAt: end?.at ?? null,
    remainingMinutes: remainingSlaMinutes(dueAt, end?.at ?? input.now),
    stopReason: end?.reason ?? null,
  };
}
