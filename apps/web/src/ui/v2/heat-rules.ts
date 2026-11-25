/** A heat cell that holds nothing: `null` or `undefined` (a 0 is a value, not empty). `HeatMatrix` maps a dash cell (`level: null`) to `null`. */
export type MaybeCell<T> = T | null | undefined;

const empty = (cell: unknown): boolean => cell === null || cell === undefined;

/**
 * ADR 0036 R22: drop every column whose cell is empty in every row, from `columns` and from each row, keeping the
 * order of what stays. All columns empty → no columns and rows of no cells.
 */
export function dropEmptyColumns<T>(
  columns: readonly string[],
  rows: readonly (readonly MaybeCell<T>[])[],
): { columns: string[]; rows: MaybeCell<T>[][] } {
  const keep = columns.flatMap((_, at) => (rows.every((row) => empty(row[at])) ? [] : [at]));
  return {
    columns: keep.map((at) => columns[at] as string),
    rows: rows.map((row) => keep.map((at) => row[at])),
  };
}

/**
 * ADR 0036 R22: true when more than half of all cells are empty (exactly half is not); false when there are no cells.
 * `HeatMatrix` then draws `RankedBars` of each row's total (the sum of its non-empty cells) instead of the grid.
 */
export function mostlyEmpty(rows: readonly (readonly unknown[])[]): boolean {
  const all = rows.reduce((n, row) => n + row.length, 0);
  const blank = rows.reduce((n, row) => n + row.filter(empty).length, 0);
  return blank * 2 > all;
}
