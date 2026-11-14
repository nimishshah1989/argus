import { z } from 'zod';

const instant = z.string().datetime({ offset: true });
const count = z.number().int().min(0);
const minutes = z.number().int().min(0).nullable();

/**
 * `GET /api/v1/board/today`: how the plant's tickets of its calendar day were handled, for the live board's
 * "Response today" and "Repair today" tiles. The day is the plant's own (its time zone), from `from` (inclusive) to
 * `to` (exclusive); a ticket is in it when it was reported or closed inside that window. Cancelled tickets are not
 * counted. Each figure is the mean in whole minutes over the tickets that have it, and null (never 0) when none does.
 * `repairMin` is wall-clock minutes from the first start, the waits inside it; `waitingMin` is those waits.
 * A ticket still being worked is measured to `now`. A ticket's own waiting figure is `figures.waitMin` on the
 * ticket replies.
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
  })
  .strict();
export type BoardToday = z.infer<typeof boardTodayReplySchema>;
