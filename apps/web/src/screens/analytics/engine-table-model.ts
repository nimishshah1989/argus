/**
 * The pure part of a table of the engine's printed cells (ticket 87): which columns are numbers, what a cell sorts
 * by, and the rows of one page. A cell is never rewritten here: sorting reads a number out of it, painting prints it.
 */
/** A row of printed cells and where it stood in the engine's table, so a link on it still names its own ticket. */
export interface EngineRow {
  row: readonly string[];
  index: number;
}

/** A printed number: grouping commas, an optional point and a trailing percent sign. A dash is "no value". */
const NUMBER = /^-?\d[\d,]*(\.\d+)?%?$/;
const NO_VALUE = new Set(['', '—', '-']);

const isNumber = (cell: string): boolean => NUMBER.test(cell.trim());
const isMissing = (cell: string): boolean => NO_VALUE.has(cell.trim());

/** Columns whose every printed cell is a number or a dash: right-aligned and sorted as numbers. */
export function numericColumns(rows: readonly EngineRow[], width: number): ReadonlySet<number> {
  const found = new Set<number>();
  for (let column = 0; column < width; column += 1) {
    let seen = false;
    let all = true;
    for (const { row } of rows) {
      const cell = row[column] ?? '';
      if (isMissing(cell)) continue;
      seen = true;
      if (!isNumber(cell)) {
        all = false;
        break;
      }
    }
    if (seen && all) found.add(column);
  }
  return found;
}

/** What a number column sorts by: the number the cell prints, NaN (last in both directions) for a dash. */
export function numberOf(cell: string): number {
  return isMissing(cell) ? Number.NaN : Number(cell.replace(/[,%\s]/g, ''));
}
