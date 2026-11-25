/* eslint-disable @typescript-eslint/no-unused-vars -- skeleton: the builder fills the bodies and deletes this line */

/** A heat cell that holds nothing: `null` or `undefined` (a 0 is a value, not empty). `HeatMatrix` maps a dash cell (`level: null`) to `null`. */
export type MaybeCell<T> = T | null | undefined;

/**
 * ADR 0036 R22: drop every column whose cell is empty in every row, from `columns` and from each row, keeping the
 * order of what stays. All columns empty → no columns and rows of no cells.
 */
export function dropEmptyColumns<T>(
  columns: readonly string[],
  rows: readonly (readonly MaybeCell<T>[])[],
): { columns: string[]; rows: MaybeCell<T>[][] } {
  throw new Error('not implemented');
}

/**
 * ADR 0036 R22: true when more than half of all cells are empty (exactly half is not); false when there are no cells.
 * `HeatMatrix` then draws `RankedBars` of each row's total (the sum of its non-empty cells) instead of the grid.
 */
export function mostlyEmpty(rows: readonly (readonly unknown[])[]): boolean {
  throw new Error('not implemented');
}
