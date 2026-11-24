import { isPm, type ClassifiedRow } from '../apps/server/src/seed/legacy-classify.js';
import { foldMachine, type Cell } from '../apps/server/src/seed/legacy-sheets.js';

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
  const out = new Map<string, number>();
  for (const [sheet, grid] of Object.entries(grids)) {
    if (!/^UNIT-\d+$/i.test(sheet.trim())) continue;
    for (const [label, ...days] of grid) {
      const text = typeof label === 'string' ? label.trim() : '';
      if (!text || /^(total|note|machine)/i.test(text)) continue;
      const minutes = days.reduce<number>(
        (sum, v) => sum + (typeof v === 'number' ? Math.round(v * 1440) : 0),
        0,
      );
      const folded = foldMachine(text, known);
      const key = known.has(folded) ? folded : `unknown ${text}`;
      out.set(key, (out.get(key) ?? 0) + minutes);
    }
  }
  return out;
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
  const register = new Map<string, number>();
  for (const { row, cls, machine } of rows) {
    if (row.year !== Number(month.slice(0, 4)) || cls !== 'ticket' || isPm(row)) continue;
    if (!row.date?.startsWith(month)) continue;
    register.set(machine, (register.get(machine) ?? 0) + row.minutes);
  }
  const isUnknown = (k: string): boolean => k.startsWith('unknown ');
  const codes = [...new Set([...grid.keys(), ...register.keys()])].filter((k) => !isUnknown(k));
  const lines = codes.sort().map((code) => {
    const g = grid.get(code) ?? 0;
    const r = register.get(code) ?? 0;
    return g === r ? `${code} equal ${g}` : `${code} grid ${g} register ${r} gap ${g - r}`;
  });
  for (const k of [...grid.keys()].filter(isUnknown).sort()) lines.push(`${k} ${grid.get(k)}`);
  return lines;
}
