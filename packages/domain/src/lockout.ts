import type { EventType } from './types.js';

/** Work starting or the ticket leaving and re-entering the queue uses up a lockout confirmation. */
const USES_UP: ReadonlySet<EventType> = new Set(['start', 'pickup', 'cancel', 'restore']);

/**
 * The lockout confirmation that still counts, from the ticket's history in order: the last `lockout_confirmed`
 * that no later Start, pickup, cancel or restore has used up. A pause and resume never touch it, so a lockout is
 * confirmed once per start; a handed-over ticket and a restored one ask again.
 */
export function standingLockoutConfirmation<T extends { type: EventType }>(
  events: readonly T[],
): T | null {
  let standing: T | null = null;
  for (const event of events) {
    if (event.type === 'lockout_confirmed') standing = event;
    else if (USES_UP.has(event.type)) standing = null;
  }
  return standing;
}
