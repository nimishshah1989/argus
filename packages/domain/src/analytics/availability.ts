import { plantDay } from './plant-day.js';
import type { EngineData, MachineRow } from './types.js';

/**
 * The platform's available hours, ported from its own Guide: the profile's production hours a day times its
 * working days a year, spread evenly over the months ("a full month is annual ÷ 12, a part-month its own days'
 * share"), counted from 1 January of the data year to the run date, and for each machine from its purchase date.
 * A machine with no purchase date counts from the window's start.
 */

const DAY_MS = 86_400_000;

/** A plant date (`YYYY-MM-DD`) as a UTC day number, so the host time zone can never move a day. */
function dayNumber(plantDate: string): number {
  const [year, month, day] = plantDate.split('-').map(Number) as [number, number, number];
  return Date.UTC(year, month - 1, day) / DAY_MS;
}

/** A plant date from its parts. */
function plantDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** A month's key (`YYYY-MM`), the form a gap month is named in. */
function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** The days from `from` to `to`, both included; zero when `to` is before `from`. */
export function daysInclusive(from: string, to: string): number {
  return to < from ? 0 : dayNumber(to) - dayNumber(from) + 1;
}

/** The window's share of a year, month by month: a full month is a twelfth, a part-month its days' share. */
export function periodFraction(
  from: string,
  to: string,
  noRecords: readonly string[] = [],
): number {
  if (to < from) return 0;
  const [fromYear, fromMonth] = from.split('-').map(Number) as [number, number];
  const [toYear, toMonth] = to.split('-').map(Number) as [number, number];
  let fraction = 0;
  for (let year = fromYear; year <= toYear; year += 1) {
    // Each year is summed on its own, so two whole years are exactly two and not two less a rounding.
    let inYear = 0;
    const lastMonth = year === toYear ? toMonth : 12;
    for (let month = year === fromYear ? fromMonth : 1; month <= lastMonth; month += 1) {
      if (noRecords.includes(monthKey(year, month))) continue;
      const last = daysInMonth(year, month);
      const monthStart = plantDate(year, month, 1);
      const monthEnd = plantDate(year, month, last);
      const start = from > monthStart ? from : monthStart;
      const end = to < monthEnd ? to : monthEnd;
      inYear += daysInclusive(start, end) / last / 12;
    }
    fraction += inYear;
  }
  return fraction;
}

/** One machine's available hours in a period: from its purchase date when that is inside it, no gap month counted. */
export function hoursIn(machine: MachineRow, annualHours: number, period: Period): number {
  const start =
    machine.purchasedOn !== null && machine.purchasedOn > period.from
      ? machine.purchasedOn
      : period.from;
  return start > period.to ? 0 : annualHours * periodFraction(start, period.to, period.noRecords);
}

/** One machine's available hours in a window, counted from its purchase date when that is inside the window. */
export function availableHours(
  machine: MachineRow,
  annualHours: number,
  from: string,
  to: string,
): number {
  return hoursIn(machine, annualHours, { from, to });
}

/** A span of plant dates and the months inside it the plant never recorded. */
export interface Period {
  from: string;
  to: string;
  /** `YYYY-MM` months inside `[from, to]` with no report and no ticket at all; absent unless a span was named. */
  noRecords?: readonly string[];
}

/** What a month prints when the plant recorded nothing in it: never a 0. */
export const NO_RECORDS = 'no records';

/** 1 January of the data year to the run date, capped to the data year ("days so far"). */
export type AvailabilityWindow = Period;

/** The year's first day to `asOf`, with no gap month: the days-so-far window every figure used before periods. */
export function yearToDate(asOf: string): Period {
  return { from: plantDate(Number(asOf.slice(0, 4)), 1, 1), to: asOf };
}

/** A month's position on a line of months, the year times twelve plus the month. */
function monthIndex(key: string): number {
  return Number(key.slice(0, 4)) * 12 + Number(key.slice(5, 7)) - 1;
}

/** The months holding a report, ticket or task up to `asOf`; a ticket or task belongs to its plant day. */
function recordedMonths(data: EngineData, asOf: string): Set<string> {
  const seen = new Set<string>();
  for (const { date } of data.reports) if (date <= asOf) seen.add(date.slice(0, 7));
  for (const { reportedAt } of [...data.tickets, ...data.tasks]) {
    const day = plantDay(reportedAt, data.timeZone);
    if (day <= asOf) seen.add(day.slice(0, 7));
  }
  return seen;
}

/** 1 January of the first record's year to `asOf`: the window a figure that learns from all history reads. */
export function historyOf(data: EngineData, asOf: string): Period {
  const first = [...recordedMonths(data, asOf)].sort()[0];
  return first === undefined ? yearToDate(asOf) : { from: `${first.slice(0, 4)}-01-01`, to: asOf };
}

/** One calendar month of a period; `outside` is wholly before `from` or after `to`. `from` and `to` are its own days. */
export interface PeriodMonth {
  key: string;
  year: number;
  month: number;
  from: string;
  to: string;
  state: 'recorded' | 'no-records' | 'outside';
}

/** Every month from January of the period's first year to December of its last, each keyed `YYYY-MM`. */
export function calendarMonths(period: Period): PeriodMonth[] {
  const months: PeriodMonth[] = [];
  const lastYear = Number(period.to.slice(0, 4));
  for (let year = Number(period.from.slice(0, 4)); year <= lastYear; year += 1) {
    for (let month = 1; month <= 12; month += 1) {
      const from = plantDate(year, month, 1);
      const to = plantDate(year, month, daysInMonth(year, month));
      const key = monthKey(year, month);
      const state =
        to < period.from || from > period.to
          ? 'outside'
          : period.noRecords?.includes(key)
            ? 'no-records'
            : 'recorded';
      months.push({ key, year, month, from, to, state });
    }
  }
  return months;
}

const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

const inOneYear = (period: Period): boolean => period.from.slice(0, 4) === period.to.slice(0, 4);

/** `Jan` inside one year, `Jan 25` across years: a month never loses its year. */
export function monthLabel(month: PeriodMonth, period: Period): string {
  const name = MONTH_NAMES[month.month - 1] as string;
  return inOneYear(period) ? name : `${name} ${String(month.year % 100).padStart(2, '0')}`;
}

/** `2026` for one year, `2025–2026` across years. */
export function yearLabel(period: Period): string {
  const first = period.from.slice(0, 4);
  return inOneYear(period) ? first : `${first}–${period.to.slice(0, 4)}`;
}

/** The days from `from` to `to` (from `purchasedOn` when later) less the days of every no-records month in them. */
export function observedDays(
  from: string,
  to: string,
  period: Period,
  purchasedOn?: string | null,
): number {
  const start = purchasedOn != null && purchasedOn > from ? purchasedOn : from;
  let days = daysInclusive(start, to);
  for (const key of period.noRecords ?? []) {
    const [year, month] = key.split('-').map(Number) as [number, number];
    const monthStart = plantDate(year, month, 1);
    const monthEnd = plantDate(year, month, daysInMonth(year, month));
    days -= daysInclusive(start > monthStart ? start : monthStart, to < monthEnd ? to : monthEnd);
  }
  return days;
}

/**
 * The months, first record to `asOf`, in which the plant has no report, ticket or task: a gap in the log, not a month
 * without a failure. A ticket or task belongs to its plant day; a row after `asOf` is not read.
 */
export function gapMonths(data: EngineData, asOf: string): string[] {
  const seen = recordedMonths(data, asOf);
  const first = [...seen].sort()[0];
  if (first === undefined) return [];
  const gaps: string[] = [];
  for (let index = monthIndex(first); index <= monthIndex(asOf); index += 1) {
    const key = monthKey(Math.floor(index / 12), (index % 12) + 1);
    if (!seen.has(key)) gaps.push(key);
  }
  return gaps;
}

/**
 * The window the Guide calls "days so far": 1 January of the data year to the run date (`asOf`, the platform's
 * today), or to the year's end when the run is later. The latest breakdown only names the year: the snapshot is
 * already cut at `asOf`, so no breakdown date is later than it.
 */
export function availabilityWindow(
  asOf: string,
  latestBreakdown: string | null,
): AvailabilityWindow {
  const year = Number((latestBreakdown ?? asOf).slice(0, 4));
  const from = plantDate(year, 1, 1);
  const last = plantDate(year, 12, 31);
  return { from, to: asOf < from ? from : asOf > last ? last : asOf };
}
