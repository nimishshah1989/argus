import type { SignoffFeed, SignoffOutcome } from '@uptimo/shared/signoff';
import { formatMinutes, formatTime } from './format.js';
import { formatLimit } from './signoff.js';

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

/** One answered or timed-out sign-off as the desk prints it: the outcome, its line, and the pill tone. */
export interface OutcomeRow {
  ticketId: string;
  ref: string;
  machine: string;
  cell: string;
  status: SignoffOutcome['status'];
  /** "Confirmed fixed", "Disputed, reopened" or "Not answered". */
  title: string;
  /** Who and when: "Operator A at 14:32 · 22 min after the close", the dispute's reason, or the time limit. */
  detail: string;
  tone: 'gain' | 'loss' | 'risk';
}

const OUTCOME = {
  confirmed: { title: 'signoff.deskConfirmed', detail: 'signoff.deskConfirmedSub', tone: 'gain' },
  disputed: { title: 'signoff.deskDisputed', detail: 'signoff.deskDisputedSub', tone: 'loss' },
  timed_out: { title: 'signoff.deskTimedOut', detail: 'signoff.deskTimedOutSub', tone: 'risk' },
} as const;

const minutesBetween = (from: string, to: string): number =>
  Math.max(0, Math.round((Date.parse(to) - Date.parse(from)) / 60_000));

/**
 * The desk's sign-off outcomes of the last day (S28), newest first: who answered and when, how long after the
 * close, a dispute's reason, or the limit a timeout ran out at. `say` is `t()`; `names` maps person ids to names.
 */
export function outcomeRows(
  outcomes: readonly SignoffOutcome[],
  ctx: {
    say: (key: string, values?: Record<string, string>) => string;
    names: Record<string, string>;
    timeZone?: string;
  },
): OutcomeRow[] {
  const { say, names, timeZone } = ctx;
  return [...outcomes]
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at) || a.ticketId.localeCompare(b.ticketId))
    .map((outcome) => {
      const words = OUTCOME[outcome.status];
      const gap = minutesBetween(outcome.requestedAt, outcome.at);
      return {
        ticketId: outcome.ticketId,
        ref: outcome.ref,
        machine: outcome.machine ? (outcome.machine.code ?? '') : say('signoff.workRequest'),
        cell: outcome.cell ?? '',
        status: outcome.status,
        title: say(words.title),
        detail: say(words.detail, {
          who: (outcome.byPersonId && names[outcome.byPersonId]) || say('common.teamMember'),
          time: formatTime(outcome.at, timeZone),
          after: formatMinutes(gap),
          reason: outcome.reason ?? '',
          limit: formatLimit(gap),
        }),
        tone: words.tone,
      };
    });
}
