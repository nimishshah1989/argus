import { resumeLead } from './state/internal.js';
import type { CrewMember, EventType } from './types.js';

/** The ticket stops being worked, changes hands, or ends: every lock taken off goes with it. */
const CLEARS_ALL: ReadonlySet<EventType> = new Set([
  'pause',
  'transfer',
  'close',
  'cancel',
  'restore',
  'handback_confirm',
  'handback_dispute',
]);

/** The history entries `standingLockoutConfirmations` reads; a store may fetch only these. */
export const LOCKOUT_EVENT_TYPES: readonly EventType[] = [
  'lockout_confirmed',
  'leave',
  ...CLEARS_ALL,
];

/**
 * Who stands confirmed on a flagged ticket, from its history in order, and by which entry: a `lockout_confirmed`
 * by a person stands until the ticket is paused, handed over, closed, cancelled, restored or reopened, or that
 * person leaves it. Each person confirms their own lock; Start, pickup, join and resume need the acting person's.
 * Given the plant's `activeCodes`, a confirmation counts only if it covers every one of them: a step added since
 * makes it stale.
 */
export function standingLockoutConfirmations<
  T extends { type: EventType; actingPersonId?: string | null; stepCodes?: string[] },
>(events: readonly T[], activeCodes?: readonly string[]): Map<string, T> {
  const standing = new Map<string, T>();
  const covers = (event: T) =>
    !activeCodes || activeCodes.every((c) => event.stepCodes?.includes(c));
  for (const event of events) {
    const who = event.actingPersonId;
    if (event.type === 'lockout_confirmed' && who) {
      if (covers(event)) standing.set(who, event);
      else standing.delete(who);
    } else if (CLEARS_ALL.has(event.type)) standing.clear();
    else if (event.type === 'leave' && who) standing.delete(who);
  }
  return standing;
}

/** Everyone who is working once `resumer` resumes: the lead (who it is after the resume) and every crew member still on. */
export function workersAfterResume(
  lead: string | null,
  crew: readonly CrewMember[],
  resumer: string,
): string[] {
  const active = crew.filter((m) => !m.leftAt);
  const leader = resumeLead(lead, active, resumer);
  return [...new Set([leader, ...active.map((m) => m.personId)])];
}
