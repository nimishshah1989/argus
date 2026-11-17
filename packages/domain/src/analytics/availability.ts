import type { MachineRow } from './types.js';

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

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** The days from `from` to `to`, both included; zero when `to` is before `from`. */
export function daysInclusive(from: string, to: string): number {
  return to < from ? 0 : dayNumber(to) - dayNumber(from) + 1;
}

/** The window's share of a year, month by month: a full month is a twelfth, a part-month its days' share. */
export function periodFraction(from: string, to: string): number {
  if (to < from) return 0;
  const [fromYear, fromMonth] = from.split('-').map(Number) as [number, number];
  const [toYear, toMonth] = to.split('-').map(Number) as [number, number];
  let fraction = 0;
  for (let index = fromYear * 12 + fromMonth - 1; index <= toYear * 12 + toMonth - 1; index += 1) {
    const year = Math.floor(index / 12);
    const month = (index % 12) + 1;
    const last = daysInMonth(year, month);
    const monthStart = plantDate(year, month, 1);
    const monthEnd = plantDate(year, month, last);
    const start = from > monthStart ? from : monthStart;
    const end = to < monthEnd ? to : monthEnd;
    fraction += daysInclusive(start, end) / last / 12;
  }
  return fraction;
}

/** One machine's available hours in a window, counted from its purchase date when that is inside the window. */
export function availableHours(
  machine: MachineRow,
  annualHours: number,
  from: string,
  to: string,
): number {
  const start =
    machine.purchasedOn !== null && machine.purchasedOn > from ? machine.purchasedOn : from;
  return start > to ? 0 : annualHours * periodFraction(start, to);
}

export interface AvailabilityWindow {
  /** 1 January of the data year. */
  from: string;
  /** The run date, capped to the data year ("days so far"). */
  to: string;
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
