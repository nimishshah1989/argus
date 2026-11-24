import { machineAge } from './machine-facts.js';
import { dayNumber } from './plant-date.js';
import { effectiveHours, isPm, type SourcedReport } from './rows.js';
import type { MachineRow } from './types.js';

const WEEKS = 12;
const sum = (values: readonly number[]): number => values.reduce((a, b) => a + b, 0);

/**
 * One machine's year so far, for the v2 Compare screen (ticket 584, ADR 0021 §2): what its boxes, key figures, "What is
 * different" and weekly chart print. Read from the same history rows v1's Compare reads; preventive maintenance
 * (`isPm`) is never a breakdown. Hours are `effectiveHours` (a `NO DT` entry counts as a breakdown with 0 hours), summed
 * unrounded: the screen rounds.
 */

/** One maintenance code's breakdowns and hours; `—` for a row with no code (trimmed empty counts as none). */
export type PairCause = { code: string; count: number; hours: number };

export type PairYear = {
  machineId: string;
  code: string;
  category: string | null;
  cell: string | null;
  /** `machineAge(machine, asOf)`. */
  age: number | null;
  /** Breakdowns dated 1 January of `asOf`'s year to `asOf`, both included. */
  count: number;
  hours: number;
  /** Planned production hours in the same window: its days (both ends included) × `perDay`. */
  plannedHours: number;
  /** The window's breakdowns by maintenance code: most hours first, then most breakdowns, then code A→Z. */
  causes: PairCause[];
  /**
   * Breakdown hours in each of the 12 seven-day weeks ending `asOf`, oldest first: `weekly[11]` is `asOf` and the six
   * days before it, `weekly[10]` the seven days before those. Crosses 1 January when `asOf` is early in the year.
   */
  weekly: number[];
  /** The same window one year earlier: 1 January to `asOf`'s day of the year before (29 February → 28 February). */
  last: { count: number; hours: number };
};

/**
 * `rows` are this machine's history rows, breakdowns and PM alike, in any order; rows dated after `asOf` count nowhere.
 * `perDay` is planned production hours a calendar day (`compareFigure`'s `perDay`).
 */
export function pairYear(
  machine: MachineRow,
  rows: readonly SourcedReport[],
  asOf: string,
  perDay: number,
): PairYear {
  const end = dayNumber(asOf) ?? 0;
  const year = Number(asOf.slice(0, 4));
  const start = dayNumber(`${year}-01-01`) ?? end;
  const monthDay = asOf.slice(5) === '02-29' ? '02-28' : asOf.slice(5);
  const lastEnd = dayNumber(`${year - 1}-${monthDay}`) ?? end;
  const lastStart = dayNumber(`${year - 1}-01-01`) ?? lastEnd;
  const breakdowns = rows
    .filter((row) => !isPm(row))
    .map((row) => ({
      day: dayNumber(row.report.date),
      code: (row.report.maintCode ?? '—').trim() || '—',
      hours: effectiveHours(row.report),
    }));
  const within = (from: number, to: number) =>
    breakdowns.filter((row) => row.day !== null && row.day >= from && row.day <= to);
  const total = (list: readonly { hours: number }[]) => sum(list.map((row) => row.hours));
  const mine = within(start, end);
  const byCode = new Map<string, PairCause>();
  for (const row of mine) {
    const cause = byCode.get(row.code) ?? { code: row.code, count: 0, hours: 0 };
    cause.count += 1;
    cause.hours += row.hours;
    byCode.set(row.code, cause);
  }
  const previous = within(lastStart, lastEnd);
  return {
    machineId: machine.id,
    code: machine.code,
    category: machine.category,
    cell: machine.cell,
    age: machineAge(machine, asOf),
    count: mine.length,
    hours: total(mine),
    plannedHours: (end - start + 1) * perDay,
    causes: [...byCode.values()].sort(
      (left, right) =>
        right.hours - left.hours || right.count - left.count || left.code.localeCompare(right.code),
    ),
    weekly: Array.from({ length: WEEKS }, (_, i) => {
      const last = end - 7 * (WEEKS - 1 - i);
      return total(within(last - 6, last));
    }),
    last: { count: previous.length, hours: total(previous) },
  };
}
