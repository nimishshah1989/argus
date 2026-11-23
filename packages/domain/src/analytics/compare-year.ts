import type { SourcedReport } from './rows.js';
import type { MachineRow } from './types.js';

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
  void machine;
  void rows;
  void asOf;
  void perDay;
  throw new Error('not built');
}
