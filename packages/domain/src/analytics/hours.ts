import {
  hoursIn,
  observedDayCount,
  periodFraction,
  type Period,
  type PeriodMonth,
} from './availability.js';
import { dayNumber } from './plant-date.js';
import type { MachineRow, MoveRow } from './types.js';

/**
 * The breakdown figures' shared seam (ticket 40): the recorded hours, the days-so-far available hours, the cell a
 * machine was in on a date and the share of a window it spent there. Every rule is the platform's own, ported from
 * its JavaScript and proven against the 11 November answer key; no figure re-implements one.
 */

/** A span of plant dates, both ends included, with the months inside it the plant never recorded. */
export type DateWindow = Period;

/** A span plus the profile's annual hours per machine (`prodHrsPerDay × workDaysPerYear`). */
export interface HoursWindow extends DateWindow {
  annualHours: number;
}

/** The platform's "No cell": a blank cell prints as a dash and is its own bucket. */
export const NO_CELL = '—';

/** The cell a row groups under: blank is the "No cell" bucket, a cell is its trimmed self. */
export function cellKey(cell: string | null | undefined): string {
  const value = String(cell ?? '').trim();
  return value === '' ? NO_CELL : value;
}

/** The platform's own hours for a row: recorded hours where the workbook has them, and zero for a NO-DT entry. */
export { effectiveHours } from './rows.js';

function plantDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * One calendar month's window, 1 January being month 1, cut at the run date: the month's own days up to `asOf`,
 * and an inverted window for a month the run date has not reached (its available hours are zero).
 */
export function monthlyWindow(asOf: string, month: number): DateWindow {
  const year = Number(asOf.slice(0, 4));
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const end = plantDate(year, month, last);
  return { from: plantDate(year, month, 1), to: end < asOf ? end : asOf };
}

/** One calendar month of a period as a window: its own days cut to the period, inverted when it lies outside. */
export function periodMonthWindow(month: PeriodMonth, period: Period): DateWindow {
  return {
    from: month.from > period.from ? month.from : period.from,
    to: month.to < period.to ? month.to : period.to,
    noRecords: period.noRecords,
  };
}

/** One machine's available hours in a window, counted from its purchase date when that is later. */
export function availableHoursFor(machine: MachineRow, window: HoursWindow): number {
  return hoursIn(machine, window.annualHours, window);
}

/** A machine's moves, oldest first: the order the cell log applies them in. */
function movesFor(machineId: string, moves: readonly MoveRow[]): MoveRow[] {
  return moves
    .filter((move) => move.machineId === machineId)
    .sort((left, right) => left.effectiveFrom.localeCompare(right.effectiveFrom));
}

/**
 * The cell a machine was in on `day`: from its earliest recorded move's `fromCell`, applying every move that had
 * taken effect by that date. A machine with no moves is in its own cell column; the log wins where the two differ.
 */
export function cellAt(machine: MachineRow, moves: readonly MoveRow[], day: string): string {
  const own = movesFor(machine.id, moves);
  if (own.length === 0) return cellKey(machine.cell);
  let cell = cellKey(own[0]!.fromCell);
  for (const move of own) {
    if (move.effectiveFrom > day) break;
    cell = cellKey(move.toCell);
  }
  return cell;
}

/** The days of `[from, to]` a machine in `current` counts for `cell`, no gap month's days: zero when the cells differ. */
function daysInCell(
  current: string,
  cell: string,
  range: readonly [number, number],
  noRecords?: readonly string[],
): number {
  return current === cell ? observedDayCount(range[0], range[1], noRecords) : 0;
}

/**
 * The share of a window's observed days a machine was in `cell`, both ends included: the platform's own walk of the
 * move log, so a machine that moved mid-window counts in each cell for the days it was there. A no-records month's
 * days count in neither the cell's days nor the window's.
 */
export function cellFrac(
  machine: MachineRow,
  moves: readonly MoveRow[],
  window: DateWindow,
  cell: string,
): number {
  const start = dayNumber(window.from);
  const end = dayNumber(window.to);
  if (start === null || end === null || end < start) return 0;
  const own = movesFor(machine.id, moves);
  let current = cellKey(own.length > 0 ? own[0]!.fromCell : machine.cell);
  let cursor = start;
  let inCell = 0;
  for (const move of own) {
    const change = dayNumber(move.effectiveFrom);
    if (change === null) continue;
    if (change > cursor) {
      inCell += daysInCell(current, cell, [cursor, Math.min(change - 1, end)], window.noRecords);
      cursor = Math.max(cursor, change);
      if (cursor > end) break;
    }
    current = cellKey(move.toCell);
  }
  if (cursor <= end) inCell += daysInCell(current, cell, [cursor, end], window.noRecords);
  const observed = observedDayCount(start, end, window.noRecords);
  return observed > 0 ? inCell / observed : 0;
}

/**
 * A cell's available hours in a window, time-weighted: each machine counts from its purchase date and only for
 * the share of the window it was in that cell, so a machine that moved stops counting where it left.
 */
export function availableByCell(
  machines: readonly MachineRow[],
  moves: readonly MoveRow[],
  window: HoursWindow,
  cell: string,
): number {
  return machines.reduce((total, machine) => {
    const purchased = machine.purchasedOn;
    const from = purchased !== null && purchased > window.from ? purchased : window.from;
    if (from > window.to) return total;
    const share = cellFrac(
      machine,
      moves,
      { from, to: window.to, noRecords: window.noRecords },
      cell,
    );
    return total + window.annualHours * periodFraction(from, window.to, window.noRecords) * share;
  }, 0);
}

/**
 * A quarter's value: the average of its months' unrounded values, skipping a month the key prints as a dash and
 * never averaging the printed cells (the platform's `quarterAvg`). Null when the whole quarter has no entries.
 */
export function quarterAverage(months: readonly (number | null | undefined)[]): number | null {
  const present = months.filter((value): value is number => value !== null && value !== undefined);
  if (present.length === 0) return null;
  return present.reduce((sum, value) => sum + value, 0) / present.length;
}
