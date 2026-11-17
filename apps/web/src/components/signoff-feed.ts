import type { SignoffFeed } from '@uptimo/shared/signoff';
import { formatMinutes } from './format.js';

export type FeedItem = SignoffFeed['items'][number];

/** The row's words, from `t()`: the screen keeps every string in the catalogue, the reading stays testable. */
export interface FeedWords {
  /** "Waiting for production's OK": the heading while nothing waits. */
  heading: string;
  /** "Waiting for production's OK ({{count}})": the heading when something does. */
  headingCount: string;
  /** "Work request": a ticket that is not on a machine. */
  workRequest: string;
  /** "Waiting {{time}}": how long production has had to answer. */
  waiting: string;
}

export interface FeedRow {
  ticketId: string;
  ref: string;
  /** The machine code, or the work-request words when the ticket has no machine. */
  machine: string;
  cell: string;
  /** "Waiting 1 h 10 min". */
  waited: string;
  minutes: number;
}

export interface Feed {
  /** The heading line: the catalogue heading, counted when something waits. */
  heading: string;
  rows: FeedRow[];
}

/** Fills a catalogue string's `{{placeholders}}` without pulling i18next into a pure helper. */
function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (whole, name: string) => values[name] ?? whole);
}

/** How long production has had to answer: from the ask (which is the close) to the plant's `now`, whole minutes. */
export function waitedMinutes(now: string, item: FeedItem): number {
  return Math.max(0, Math.floor((Date.parse(now) - Date.parse(item.requestedAt)) / 60_000));
}

/** The longest wait first, as the server sends it; the ticket id keeps two closes in the same instant stable. */
const oldestFirst = (a: FeedItem, b: FeedItem): number =>
  Date.parse(a.closedAt) - Date.parse(b.closedAt) || a.ticketId.localeCompare(b.ticketId);

function toRow(item: FeedItem, now: string, names: FeedWords): FeedRow {
  const minutes = waitedMinutes(now, item);
  return {
    ticketId: item.ticketId,
    ref: item.ref,
    machine: item.machine ? (item.machine.code ?? '') : names.workRequest,
    cell: item.cell ?? '',
    waited: fill(names.waiting, { time: formatMinutes(minutes) }),
    minutes,
  };
}

/**
 * The desk's waiting feed: one row per closed ticket still waiting for production, oldest close first (the oldest
 * wait at the top), and the heading line that counts them.
 */
export function feedRows(items: readonly FeedItem[], now: string, names: FeedWords): Feed {
  const rows = [...items].sort(oldestFirst).map((item) => toRow(item, now, names));
  const heading =
    rows.length === 0 ? names.heading : fill(names.headingCount, { count: String(rows.length) });
  return { heading, rows };
}
