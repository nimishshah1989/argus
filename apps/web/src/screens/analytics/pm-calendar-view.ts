import { isPlannedChannel, plantDayOf, type PmCalendarItem } from '@uptimo/shared';
import type { Ticket } from '@uptimo/shared/replies';

/**
 * The PM calendar's pure mapping (ticket 50c): the API's occurrences to all-day events, the day's load, the two
 * compliance tiles and the machine page's task split. The page, the machine block and their tests share these, so
 * the screen only paints what this module read; a malformed value is nothing to show, never a guessed number.
 */

/** One event the calendar draws: an occurrence's plan/ticket ids, its day and the words its chip carries. */
export interface PmEvent {
  id: string;
  title: string;
  start: string;
  allDay: true;
  /** A started job is not draggable: the server would refuse it and the chip would snap back. */
  startEditable: boolean;
  durationEditable: false;
  extendedProps: {
    planId: string | null;
    machineId: string;
    machineCode: string;
    ticketId: string | null;
    dueOn: string;
    status: PmCalendarItem['status'];
    movable: boolean;
    crowded: boolean;
    suggestedOn: string | null;
    /** How many PMs the plant has on that day (R5's load); 1 is a calm day, 2 is crowded. */
    load: number;
  };
}

/** The occurrence's stable id: its ticket when it has one, else its plan. */
const idOf = (item: PmCalendarItem): string => item.ticketId ?? item.planId ?? item.machineId;

/** The count of PMs on each scheduled day; every occurrence counts, not only the asked range's. */
export function loadOf(items: readonly PmCalendarItem[]): Map<string, number> {
  const load = new Map<string, number>();
  for (const item of items) load.set(item.scheduledOn, (load.get(item.scheduledOn) ?? 0) + 1);
  return load;
}

/** The calendar's events: one all-day event per occurrence, titled with the machine code (R2). */
export function eventsOf(items: readonly PmCalendarItem[]): PmEvent[] {
  const load = loadOf(items);
  return items.map((item) => ({
    id: idOf(item),
    title: item.machineCode,
    start: item.scheduledOn,
    allDay: true,
    startEditable: item.movable,
    durationEditable: false,
    extendedProps: {
      planId: item.planId,
      machineId: item.machineId,
      machineCode: item.machineCode,
      ticketId: item.ticketId,
      dueOn: item.dueOn,
      status: item.status,
      movable: item.movable,
      crowded: item.crowded,
      suggestedOn: item.suggestedOn,
      load: load.get(item.scheduledOn) ?? 1,
    },
  }));
}

/**
 * The idempotency key a move carries. One attempt holds one key, so a double tap or a retry of the same move is the
 * server's one write; `settled` (the server answered) lets the next attempt take a fresh key.
 */
export function moveKeys(newKey: () => string) {
  let held: { signature: string; key: string } | null = null;
  return {
    keyFor(body: object): string {
      const signature = JSON.stringify(body);
      if (held?.signature !== signature) held = { signature, key: newKey() };
      return held.key;
    },
    settled(): void {
      held = null;
    },
  };
}

/** The month's own range, before FullCalendar reports its six-week grid (`datesSet`). */
export function monthRange(day: string): { from: string; to: string } {
  const first = `${day.slice(0, 7)}-01`;
  const next = new Date(Date.parse(`${first}T00:00:00Z`));
  next.setUTCMonth(next.getUTCMonth() + 1);
  const last = new Date(next.getTime() - 86_400_000).toISOString().slice(0, 10);
  return { from: first, to: last };
}

/** The month the grid shows (YYYY-MM): day 21 of a six-week grid is always inside it, the edge days belong to its neighbours. */
export function shownMonth(range: { from: string }): string {
  return new Date(Date.parse(`${range.from}T00:00:00Z`) + 20 * 86_400_000)
    .toISOString()
    .slice(0, 7);
}

/** The grid's inclusive range: FullCalendar's `end` is exclusive, the API's `to` is inclusive. */
export function gridRange(start: string, endExclusive: string): { from: string; to: string } {
  const end = new Date(Date.parse(`${endExclusive.slice(0, 10)}T00:00:00Z`) - 86_400_000);
  return { from: start.slice(0, 10), to: end.toISOString().slice(0, 10) };
}

/* ── The two compliance tiles (R6/R7/R16) ──────────────────────────────────────────────────────── */

export interface PmComplianceTile {
  pct: number | null;
  counts: Record<string, number>;
}

export interface PmComplianceView {
  from: string;
  to: string;
  pm: PmComplianceTile;
  schedule: PmComplianceTile;
  /** True when neither figure has a denominator: the page says so in words, never 0 % (R16). */
  empty: boolean;
}

type Bag = Record<string, unknown>;

const bag = (value: unknown): Bag | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Bag) : null;

const countOf = (value: Bag, key: string): number => {
  const count = value[key];
  return typeof count === 'number' && Number.isFinite(count) ? count : 0;
};

const pctOf = (value: Bag): number | null => {
  const pct = value.pct;
  return typeof pct === 'number' && Number.isFinite(pct) ? pct : null;
};

const tileOf = (raw: unknown, keys: readonly string[]): PmComplianceTile => {
  const value = bag(raw);
  if (value === null) return { pct: null, counts: {} };
  return {
    pct: pctOf(value),
    counts: Object.fromEntries(keys.map((key) => [key, countOf(value, key)])),
  };
};

/** The `pm-compliance` figure's value as the page's tiles read it; null when it is not the figure's shape. */
export function readPmCompliance(value: unknown): PmComplianceView | null {
  const figure = bag(value);
  if (figure === null || typeof figure.from !== 'string' || typeof figure.to !== 'string')
    return null;
  const pm = tileOf(figure.pm, [
    'eligible',
    'onTime',
    'early',
    'late',
    'overdue',
    'cancelled',
    'pending',
  ]);
  const schedule = tileOf(figure.schedule, ['eligible', 'done', 'missed', 'pending']);
  return {
    from: figure.from,
    to: figure.to,
    pm,
    schedule,
    empty: (pm.counts.eligible ?? 0) === 0 && (schedule.counts.eligible ?? 0) === 0,
  };
}

const oneDecimal = new Intl.NumberFormat('en-GB', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** A rate as the page prints it: one decimal and a `%`, or a dash when there is no denominator (R16). */
export function rateText(pct: number | null): string {
  return pct === null ? '—' : `${oneDecimal.format(pct)} %`;
}

/* ── The machine page's task block (R9) ─────────────────────────────────────────────────────────── */

export interface MachineTaskRow {
  id: string;
  ref: string;
  problem: string;
  status: Ticket['status'];
  /** The PM row's scheduled day, `task_expected_on` else the plant day it was reported; null on open tasks. */
  scheduledOn: string | null;
  /** A PM row still open after its scheduled day; every other row is never overdue. */
  overdue: boolean;
}

export interface MachineTasksView {
  open: MachineTaskRow[];
  pm: MachineTaskRow[];
}

/** The ticket fields the machine block reads; a full `Ticket` satisfies it, a test can carry only these. */
export interface TaskTicket {
  id: string;
  ref: string;
  problem: string;
  status: Ticket['status'];
  raisedChannel: string;
  taskExpectedOn: string | null;
  reportedAt: string;
}

/** Split one machine's open tickets with the shared planned predicate; PM rows carry their schedule (R9). */
export function readMachineTasks(
  tickets: readonly TaskTicket[],
  options: { today: string; timeZone?: string },
): MachineTasksView {
  const pairs = tickets.map((ticket) => {
    const planned = isPlannedChannel(ticket.raisedChannel);
    const scheduledOn = planned
      ? (ticket.taskExpectedOn ?? plantDayOf(ticket.reportedAt, options.timeZone))
      : null;
    const row: MachineTaskRow = {
      id: ticket.id,
      ref: ticket.ref,
      problem: ticket.problem,
      status: ticket.status,
      scheduledOn,
      overdue:
        planned &&
        ticket.status !== 'closed' &&
        ticket.status !== 'cancelled' &&
        scheduledOn !== null &&
        scheduledOn < options.today,
    };
    return { planned, row };
  });
  return {
    open: pairs.filter((pair) => !pair.planned).map((pair) => pair.row),
    pm: pairs
      .filter((pair) => pair.planned)
      .map((pair) => pair.row)
      .sort((a, b) => (a.scheduledOn ?? '').localeCompare(b.scheduledOn ?? '')),
  };
}
