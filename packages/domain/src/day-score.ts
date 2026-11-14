import { figures } from './figures.js';
import type { FigureInput } from './types.js';

/** A figure is null when the ticket has none (no work start yet, or a past record that gave no times). */
interface Minutes {
  responseMin: number | null;
  repairMin: number | null;
  waitMin: number | null;
}

/** One ticket of the day: closed ones carry the figures stored at the close, unfinished ones the inputs to measure them now. */
export type DayTicket =
  | { status: 'cancelled' }
  | { status: 'closed'; figures: Minutes }
  | { status: 'open' | 'working' | 'waiting'; input: FigureInput };

export interface DayScore {
  /** Tickets counted: everything but the cancelled. */
  tickets: number;
  /** Open tickets nobody has started work on; they have no response or repair yet. */
  notStarted: number;
  stillOpen: number;
  /** Means over the tickets that have the figure, in whole minutes; null when none does (never 0). */
  responseMin: number | null;
  repairMin: number | null;
  /** Mean waiting minutes over the repaired tickets that have a waiting figure (an import can have repair and no waiting); a hand-set figure can put it above repair. */
  waitingMin: number | null;
  /** How many tickets the response mean is over, and how many of them are closed (the rest are still being worked, measured to now). */
  responseCount: number;
  responseClosed: number;
  /** The same for repair (waiting is averaged over its own subset, so it has no count). */
  repairCount: number;
  repairClosed: number;
}

interface Measured {
  open: boolean;
  unstarted: boolean;
  figures: Minutes;
}

const NO_FIGURES: Minutes = { responseMin: null, repairMin: null, waitMin: null };

/**
 * An unfinished ticket measured as if it closed at `now`: a pause still running counts to now and repair is the wall
 * clock from the first start to now, waits inside it (the same arithmetic as a close, so nothing is computed twice).
 * A closed one carries what was stored at its close, so hand-set and imported minutes are kept.
 */
function measure(ticket: Exclude<DayTicket, { status: 'cancelled' }>, now: Date): Measured {
  if (ticket.status === 'closed') {
    return { open: false, unstarted: false, figures: ticket.figures };
  }
  const { input } = ticket;
  const started = input.events.some((event) => event.type === 'start' || event.type === 'pickup');
  if (!started) return { open: true, unstarted: true, figures: NO_FIGURES };
  const live = figures({
    ...input,
    now,
    closedAt: now,
    events: [...input.events, { type: 'close', at: now }],
  });
  return { open: true, unstarted: false, figures: live };
}

function mean(values: Array<number | null>): number | null {
  const present = values.filter((value): value is number => value !== null);
  if (present.length === 0) return null;
  return Math.round(present.reduce((sum, value) => sum + value, 0) / present.length);
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
  const responded = counted.filter((ticket) => ticket.figures.responseMin !== null);
  const repaired = counted.filter((ticket) => ticket.figures.repairMin !== null);
  const shut = (list: Measured[]) => list.filter((ticket) => !ticket.open).length;
  return {
    tickets: counted.length,
    notStarted: counted.filter((ticket) => ticket.unstarted).length,
    stillOpen: counted.filter((ticket) => ticket.open).length,
    responseMin: mean(counted.map((ticket) => ticket.figures.responseMin)),
    repairMin: mean(repaired.map((ticket) => ticket.figures.repairMin)),
    waitingMin: mean(repaired.map((ticket) => ticket.figures.waitMin)),
    responseCount: responded.length,
    responseClosed: shut(responded),
    repairCount: repaired.length,
    repairClosed: shut(repaired),
  };
}
