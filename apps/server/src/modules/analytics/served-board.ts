import type { ActionCenterBoard } from '@uptimo/domain';
import type { PoolClient } from 'pg';

/**
 * Ticket 628 (ADR 0029 addendum): the Action Center board a read answers, built once per data stamp and held in this
 * process.
 *
 * `GET /analytics/action-center` loaded the whole plant and ran `actionCenterBoard` on every read: 30 readers on five
 * years queued to a p95 of 1,073 ms (one reader alone: 52 ms). The board is a pure function of the stamped tables
 * (the acks and the profile are `setting` rows), the plant date and the build, all of which `dataStamp` covers. So:
 *
 * - `heldBoard` reads `dataStamp(tx, tenantId)`. When this process holds a board for (`tenantId`, `asOf`) built at
 *   that stamp, it answers that board and does not call `build`.
 * - Otherwise it calls `build` once, holds the result with the stamp (replacing the one held for that plant date)
 *   and adds 1 to `boardsBuilt()` and to `engineRunsInRead()` (`served.ts`): a board build is the engine running
 *   inside a read. After a write (an ack, a snooze, a new ticket) the next read builds again, so a write always shows
 *   on the next read, never a stale board.
 * - Readers that ask for the same plant date and stamp at the same time share one build. A build that fails is not
 *   held: the error reaches the caller as before, and the next read builds again.
 * - At most `SERVED_BOARD_LIMIT` plant dates are held; adding one more drops the least recently used.
 * - Only the GET uses it. The PUT, DELETE and accept routes keep calling `boardOf` inside their write transaction.
 */

type Db = Pick<PoolClient, 'query'>;

/** Plant dates one process holds a board for, at most. */
export const SERVED_BOARD_LIMIT = 32;

/** The board for a plant date: held when built at the current data stamp, else built by `build` and held. */
export async function heldBoard(
  _tx: Db,
  _input: { tenantId: string; asOf: string; build: () => Promise<ActionCenterBoard> },
): Promise<ActionCenterBoard> {
  throw new Error('not built: ticket 628');
}

/** How many boards this process built (each one ran the engine inside a read). Test helper. */
export function boardsBuilt(): number {
  throw new Error('not built: ticket 628');
}

/** Test helper: empties the held boards and sets `boardsBuilt()` back to 0. */
export function resetServedBoards(): void {
  throw new Error('not built: ticket 628');
}
