/**
 * Replay the offline outbox (SPEC 1.9), in order and one at a time, through the real command
 * endpoint with each entry's stored Idempotency-Key.
 *
 * - 2xx: the command landed; drop it.
 * - 409: the ticket changed while the phone was offline; keep it as a draft for the person.
 * - network error or other failure: stop and keep the rest queued for the next attempt.
 * - made by another login or person on this phone (or before anyone said who is using it): held,
 *   never sent as the current person, never deleted; the banner names who queued it.
 */
import { ApiError, isOffline, sendCommand } from '../api.js';
import { currentWho, isMine } from '../data/index.js';
import { addDraft, listQueued, removeQueued, type QueueEntry } from './outbox.js';

export interface ReplaySummary {
  attempted: number;
  replayed: number;
  drafted: number;
  kept: number;
  held: number;
}

/** The command body to send: a close keeps the time the person chose, so figures stay honest. */
function bodyFor(entry: QueueEntry): object {
  const body = entry.body as Record<string, unknown>;
  if (entry.action !== 'close') return body;
  return { ...body, at: body.at ?? entry.at };
}

export async function replayOutbox(): Promise<ReplaySummary> {
  const summary: ReplaySummary = { attempted: 0, replayed: 0, drafted: 0, kept: 0, held: 0 };
  if (isOffline()) return summary;

  const now = currentWho();
  const all = await listQueued();
  const queued = all.filter((entry) => isMine(entry.who, now));
  summary.held = all.length - queued.length;
  for (const entry of queued) {
    summary.attempted += 1;
    try {
      await sendCommand(entry.ticketId, entry.action, bodyFor(entry), entry.idempotencyKey);
    } catch (error) {
      if (error instanceof ApiError && error.code === 'conflict') {
        await addDraft(entry, error.message);
        await removeQueued(entry.id);
        summary.drafted += 1;
        continue;
      }
      break;
    }
    await removeQueued(entry.id);
    summary.replayed += 1;
  }
  summary.kept = queued.length - summary.replayed - summary.drafted;
  return summary;
}
