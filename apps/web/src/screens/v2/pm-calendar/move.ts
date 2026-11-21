import type { PmRescheduleBody, PmRescheduleReply } from '@uptimo/shared';
import { fill } from '../../../i18n/fill.js';
import { ApiError, idempotencyKey } from '../../../data/index.js';
import { moveKeys } from '../../analytics/pm-calendar-view.js';
import { shortDate } from '../printed-page/printed.js';
import type { PmCalendarWords, PmMoveRequest } from './model.js';

/** A move that did not land, in words the reader can act on. `retry` says the same move may be pressed again. */
export class MoveFailed extends Error {
  readonly retry: boolean;
  constructor(message: string, retry: boolean) {
    super(message);
    this.retry = retry;
  }
}

/** What writes the move: the app's `POST /pm/reschedule`, or the gallery's stand-in for it. */
export type SendMove = (body: PmRescheduleBody, key: string) => Promise<PmRescheduleReply>;

/**
 * The one write a drag and a keyboard move share. One attempt holds one idempotency key, so a double press or a retry
 * after a dropped connection is the server's one write; the server's own answer (a refusal) ends the attempt, so the
 * next try is a new one. Resolves with the line that says where the job landed.
 */
export function createMover(send: SendMove, words: PmCalendarWords['move']) {
  const keys = moveKeys(idempotencyKey);
  const attempt = async (request: PmMoveRequest): Promise<string> => {
    // The machine's code is the status line's; the strict reschedule body carries only the ids and the day.
    const body: PmRescheduleBody = {
      machineId: request.machineId,
      planId: request.planId,
      ticketId: request.ticketId,
      scheduledOn: request.scheduledOn,
    };
    try {
      const reply = await send(body, keys.keyFor(body));
      keys.settled();
      return fill(words.moved, {
        machine: request.machineCode,
        date: shortDate(reply.scheduledOn),
      });
    } catch (error) {
      if (error instanceof ApiError) {
        keys.settled();
        throw new MoveFailed(error.message || words.refused, false);
      }
      throw new MoveFailed(words.offline, true);
    }
  };
  // One attempt at a time: a second move waits for the first, so the held key is always the key of the move in flight.
  let queue: Promise<unknown> = Promise.resolve();
  return (request: PmMoveRequest): Promise<string> => {
    const next = queue.then(() => attempt(request));
    queue = next.catch(() => undefined);
    return next;
  };
}
