import type { ClassifiedRow } from '../apps/server/src/seed/legacy-classify.js';
import type { Cell } from '../apps/server/src/seed/legacy-sheets.js';

/**
 * Ticket 625 (G3.1, history lane): `Jul-23.xlsx` is not an entry register but a machine x day grid of one month's
 * breakdown time. It is a cross-check only: the grid never loads a row, never reaches an export file or the tray.
 *
 * Layout: each `UNIT-n` sheet repeats a weekly block (a title row, a header row whose first cell is `Machine` and
 * whose day cells are Excel date serials, one row per machine, then `Total`, `Total Weekly Break-Down`, a `NOTE:-`
 * row). Day cells are durations in Excel days: minutes = round(value x 1440), per cell; a blank cell is 0. Other
 * sheets (`Total MB`) are ignored.
 */

/**
 * Per machine, the grid's minutes summed over every `UNIT-n` sheet and every weekly block. A label that folds
 * (`foldMachine`) to a machine in `known` is keyed by that code; any other label is keyed `unknown <label>` (the
 * label as written, trimmed), never guessed. A `Total…` or `NOTE…` row is not a machine.
 */
export function readMonthGrid(
  grids: Record<string, Cell[][]>,
  known: ReadonlySet<string>,
): Map<string, number> {
  void grids;
  void known;
  throw new Error('not implemented');
}

/**
 * One line per machine, comparing the grid with the register's breakdown minutes for `month` (`YYYY-MM`): rows of
 * that month's own workbook year, class `ticket`, not PM (`isPm`), dated in that month, summed by `c.machine`.
 * Known machines first, sorted by code, each either `<code> equal <minutes>` or
 * `<code> grid <g> register <r> gap <g - r>`; a machine with register minutes but no grid row shows `grid 0`.
 * Then every `unknown <label>` key of the grid, sorted, as `unknown <label> <minutes>`.
 */
export function compareGrid(
  grid: Map<string, number>,
  rows: readonly ClassifiedRow[],
  month: string,
): string[] {
  void grid;
  void rows;
  void month;
  throw new Error('not implemented');
}
