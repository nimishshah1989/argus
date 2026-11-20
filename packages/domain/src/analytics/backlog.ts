import { businessMinutesBetween, plantDayStart, type BusinessCalendar } from '../business-hours.js';
import { formatInr } from './format.js';
import { plantDay } from './plant-day.js';
import { dayNumber, dmy } from './plant-date.js';
import { shiftCalendar, workingMinutesPerDay } from './working-hours.js';
import type { Computer, EngineData, FigureValue, ShiftRow, TicketRow } from './types.js';

/**
 * The backlog (ticket 48): every breakdown ticket still open at the as-of plant date, counted and aged in the plant's
 * own working hours to the start of the next plant day, then bucketed. The kind is R4's test: a support ticket, a PM
 * job and a general work request are not breakdowns; a closed or cancelled ticket is not open. The plant has no
 * holiday calendar, so Saturday and Sunday are working time, and a ticket reported at 23:59 is one working minute
 * old. An open ticket whose plant has no shift window has no age to print, so the figure dashes it rather than
 * inventing a clock (R3).
 *
 * The age's clock is the plan's own hand arithmetic: a whole open day is the 960 minutes the plant works from 08:00
 * to midnight (08:00-18:29 and 18:29-24:00 on Cosmos's two windows), so a crossing window is clipped at the day
 * boundary it starts on. The overnight tail is the next production date's window and is never counted twice across
 * midnight; the as-of window ends at the start of the next plant day. This is the arithmetic the plan pins (T3 36.0,
 * T1 23.0, T2 15.0 hours at asOf 2026-11-11).
 */

const DASH = '—';
const DAY_MS = 86_400_000;
const OPEN: ReadonlySet<TicketRow['status']> = new Set(['open', 'working', 'waiting']);

/** One open breakdown as the figure counts it, its age in working hours (null when the plant has no window). */
export interface BacklogTicket {
  id: string;
  ref: string;
  machineCode: string | null;
  status: TicketRow['status'];
  reportedAt: string;
  workingHours: number | null;
}

/** The queue, its oldest age and the four buckets the page prints. */
export interface Backlog {
  count: number;
  oldestWorkingHours: number | null;
  under4: number | null;
  to24: number | null;
  to72: number | null;
  over72: number | null;
  tickets: BacklogTicket[];
}

/** The plant date after `date`: the morning the as-of plant day's clock runs out. */
function nextPlantDay(date: string): string {
  const day = dayNumber(date);
  if (day === null) throw new RangeError(`not a plant date: ${date}`);
  return new Date((day + 1) * DAY_MS).toISOString().slice(0, 10);
}

/** Working minutes from the report to the window's end; a report at or after the end is zero, never negative. */
function ageMinutes(reportedAt: string, end: Date, calendar: BusinessCalendar): number {
  const from = new Date(reportedAt);
  return end.getTime() <= from.getTime() ? 0 : businessMinutesBetween(from, end, calendar);
}

/**
 * The clock the backlog ages by: each active window clipped to the calendar day it starts on, so a whole open day is
 * its day shift plus its evening (960 minutes on Cosmos's windows), never the crossing tail it runs into the next
 * morning. The tail is the next production date's working time, and the window already ends at that date's midnight.
 */
function backlogCalendar(shifts: readonly ShiftRow[], timeZone: string): BusinessCalendar {
  const { windows } = shiftCalendar(shifts, timeZone);
  return {
    timeZone,
    windows: windows.map((window) =>
      window.crossesMidnight ? { ...window, endMinute: 1_440, crossesMidnight: false } : window,
    ),
  };
}

/** Half-open bands: [0, 4), [4, 24), [24, 72), [72, ...), the page's own four labels. */
function bucketOf(hours: number): 'under4' | 'to24' | 'to72' | 'over72' {
  if (hours < 4) return 'under4';
  if (hours < 24) return 'to24';
  if (hours < 72) return 'to72';
  return 'over72';
}

/** The open breakdowns, oldest first: the age is working time to the end of the as-of plant day. */
export function backlogOf(data: EngineData, asOf: string): Backlog {
  const shifts = data.shifts ?? [];
  const hasWindow = workingMinutesPerDay(shifts).total > 0;
  const calendar = hasWindow ? backlogCalendar(shifts, data.timeZone) : null;
  const end = plantDayStart(nextPlantDay(asOf), data.timeZone);
  const codes = new Map(data.machines.map((machine) => [machine.id, machine.code]));
  const tickets = data.tickets
    .filter(
      (ticket) =>
        ticket.kind === 'stopped' &&
        OPEN.has(ticket.status) &&
        plantDay(ticket.reportedAt, data.timeZone) <= asOf,
    )
    .map((ticket): BacklogTicket => {
      const minutes = calendar === null ? null : ageMinutes(ticket.reportedAt, end, calendar);
      return {
        id: ticket.id,
        ref: ticket.ref,
        machineCode: ticket.machineId === null ? null : (codes.get(ticket.machineId) ?? null),
        status: ticket.status,
        reportedAt: ticket.reportedAt,
        workingHours: minutes === null ? null : minutes / 60,
      };
    })
    .sort(
      (left, right) =>
        (right.workingHours ?? -1) - (left.workingHours ?? -1) ||
        left.reportedAt.localeCompare(right.reportedAt) ||
        left.ref.localeCompare(right.ref),
    );

  const buckets = { under4: 0, to24: 0, to72: 0, over72: 0 };
  if (calendar !== null) {
    for (const ticket of tickets) buckets[bucketOf(ticket.workingHours!)] += 1;
  }
  const aged = calendar !== null;
  return {
    count: tickets.length,
    oldestWorkingHours: tickets[0]?.workingHours ?? null,
    under4: aged ? buckets.under4 : null,
    to24: aged ? buckets.to24 : null,
    to72: aged ? buckets.to72 : null,
    over72: aged ? buckets.over72 : null,
    tickets,
  };
}

/** A number the page prints, or a dash where the plant has no working-hour clock to age by. */
const shown = (value: number | null, decimals: number): string =>
  value === null ? DASH : formatInr(value, decimals);

/** The page's one table: the open breakdowns, oldest first, with their age in working hours. */
function backlogTable(data: EngineData, tickets: readonly BacklogTicket[]) {
  return {
    title: 'The backlog, oldest first',
    header: ['Ticket', 'Machine', 'Status', 'Reported', 'Age (working hours)'],
    rows: tickets.map((ticket) => [
      ticket.ref,
      ticket.machineCode ?? DASH,
      ticket.status,
      dmy(plantDay(ticket.reportedAt, data.timeZone)),
      shown(ticket.workingHours, 1),
    ]),
    rowCount: tickets.length,
  };
}

/**
 * The backlog figure: the open breakdowns, oldest first. It keeps the house's rule for a queue with nothing in it —
 * a figure with no rows to name prints nothing rather than a page of zeroes — and with no shift window it dashes the
 * ages and says why, while still naming every open ticket in its drill.
 */
export const shiftKpisBacklogFigure: Computer = ({ data, asOf }) => {
  const backlog = backlogOf(data, asOf);
  if (backlog.count === 0) return { value: null, drillIds: [] };
  const noWindows = workingMinutesPerDay(data.shifts ?? []).total === 0;
  const kpis = [
    {
      label: 'Open Breakdowns',
      value: formatInr(backlog.count, 0),
      sub: `still open on ${dmy(asOf)}`,
    },
    { label: 'Oldest', value: shown(backlog.oldestWorkingHours, 1), sub: 'working hours' },
    ...(noWindows
      ? [
          {
            label: 'No shift windows in Settings',
            value: DASH,
            sub: 'the ages cannot be read without a calendar',
          },
        ]
      : [
          { label: 'Under 4 h', value: shown(backlog.under4, 0), sub: 'tickets' },
          { label: '4 to 24 h', value: shown(backlog.to24, 0), sub: 'tickets' },
          { label: '24 to 72 h', value: shown(backlog.to72, 0), sub: 'tickets' },
          { label: 'Over 72 h', value: shown(backlog.over72, 0), sub: 'tickets' },
        ]),
  ];
  const value = {
    screen: 'shift-kpis',
    asOf,
    backlog,
    pages: [
      {
        page: 'shift-kpis',
        title: 'Breakdown backlog',
        kpis,
        tables: [backlogTable(data, backlog.tickets)],
        charts: [],
      },
    ],
  };
  return {
    value: value as unknown as FigureValue,
    drillIds: backlog.tickets.map((ticket) => ticket.id),
  };
};
