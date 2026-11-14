import { z } from 'zod';

const instant = z.string().datetime({ offset: true });
const count = z.number().int().min(0);
const minutes = z.number().int().min(0).nullable();

/**
 * `GET /api/v1/board/today`: how the plant's breakdowns of its calendar day were handled, for the live board's
 * "Response today" and "Repair today" tiles. Only breakdowns count (kind `stopped`, follow-up task rows and general
 * or support requests do not). The day is the plant's own (its time zone), from `from` (inclusive) to `to` (exclusive).
 * A breakdown is in the set when it was reported or closed inside that window, or is still open now whatever its report
 * date, so the tile cannot look good while the worst repair is still running. Cancelled tickets are not counted.
 * Each figure is the mean in whole minutes over the tickets that have it, and null (never 0) when none does.
 * `repairMin` is wall-clock minutes from the first start, the waits inside it; `waitingMin` is the mean waiting minutes over
 * the repaired tickets that have a waiting figure (an import can have repair and no waiting; a hand-set figure can put it
 * above repair). A ticket still being worked is measured to `now`;
 * `notStarted` counts open tickets nobody has started. A ticket's own waiting figure is `figures.waitMin` on the
 * ticket replies.
 * `responseCount` is how many tickets the response mean is over and `responseClosed` how many of those are closed (the
 * others are still being worked, measured to now); `repairCount` and `repairClosed` are the same for repair, so the screen can say "average of 6, 4 closed".
 * Breakdowns on machines the board does not show (a hidden group, or a segment kept off the board in Settings) count in
 * none of it, the same machines the board leaves out of its tiles.
 */
export const boardTodayReplySchema = z
  .object({
    now: instant,
    from: instant,
    to: instant,
    tickets: count,
    notStarted: count,
    stillOpen: count,
    responseMin: minutes,
    repairMin: minutes,
    waitingMin: minutes,
    responseCount: count,
    responseClosed: count,
    repairCount: count,
    repairClosed: count,
  })
  .strict();
export type BoardToday = z.infer<typeof boardTodayReplySchema>;
