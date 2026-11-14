import { figures } from './figures.js';
import type { FigureInput, Figures } from './types.js';

type Minutes = Pick<Figures, 'responseMin' | 'repairMin' | 'waitMin'>;

/** One ticket of the day: closed ones carry the figures stored at the close, unfinished ones the inputs to measure them now. */
export type DayTicket =
  | { status: 'cancelled' }
  | { status: 'closed'; started: boolean; figures: Minutes }
  | { status: 'open' | 'working' | 'waiting'; input: FigureInput };

export interface DayScore {
  /** Tickets counted: everything but the cancelled. */
  tickets: number;
  /** Counted tickets nobody has started work on; they have no response or repair yet. */
  notStarted: number;
  stillOpen: number;
  /** Means over the tickets that have the figure, in whole minutes; null when none does (never 0). */
  responseMin: number | null;
  repairMin: number | null;
  /** The waits inside repair, over the same tickets as `repairMin`. */
  waitingMin: number | null;
}

interface Measured {
  open: boolean;
  started: boolean;
  figures: Minutes;
}

/**
 * An unfinished ticket measured as if it closed at `now`: a pause still running counts to now and repair is the wall
 * clock from the first start to now, waits inside it (the same arithmetic as a close, so nothing is computed twice).
 */
function measure(ticket: Exclude<DayTicket, { status: 'cancelled' }>, now: Date): Measured {
  if (ticket.status === 'closed') {
    return { open: false, started: ticket.started, figures: ticket.figures };
  }
  const { input } = ticket;
  const live = figures({
    ...input,
    now,
    closedAt: now,
    events: [...input.events, { type: 'close', at: now }],
  });
  const started = input.events.some((event) => event.type === 'start' || event.type === 'pickup');
  return { open: true, started, figures: live };
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

/**
 * The live board's "today" tiles: how fast and how long the plant's tickets of the day were handled.
 * Response is first start minus report (null for a self-started or unstarted ticket); repair is the wall clock from the
 * first start to the close, waits inside it (Nimish's Q10 ruling); waiting is shown beside it. The caller decides which
 * tickets belong to the day. `now` is injected, never read from the clock.
 */
export function dayScore(tickets: DayTicket[], now: Date): DayScore {
  const counted = tickets
    .filter((ticket) => ticket.status !== 'cancelled')
    .map((ticket) => measure(ticket as Exclude<DayTicket, { status: 'cancelled' }>, now));
  const started = counted.filter((ticket) => ticket.started);
  return {
    tickets: counted.length,
    notStarted: counted.length - started.length,
    stillOpen: counted.filter((ticket) => ticket.open).length,
    responseMin: mean(
      started.flatMap((ticket) =>
        ticket.figures.responseMin === null ? [] : [ticket.figures.responseMin],
      ),
    ),
    repairMin: mean(started.map((ticket) => ticket.figures.repairMin)),
    waitingMin: mean(started.map((ticket) => ticket.figures.waitMin)),
  };
}
