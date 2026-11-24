/* eslint-disable @typescript-eslint/no-unused-vars -- skeleton: the builder fills the bodies and deletes this line */

/** One dropdown filter on a table (ADR 0036 R16): cell, category, age band, shift, … `value` is the row's value for it. */
export type TableSelect<R> = { key: string; label: string; value: (row: R) => string };

/**
 * The rows every chosen filter keeps (AND). A key in `chosen` with an empty value, or one no select has, keeps every
 * row; otherwise a row stays when `select.value(row) === chosen[select.key]`. Order is kept: filters run before search
 * and sort, and the default order (worst first / `initialSort`) stays the screen's.
 */
export function applyFilters<R>(
  rows: R[],
  selects: TableSelect<R>[],
  chosen: Record<string, string>,
): R[] {
  throw new Error('not implemented');
}

/**
 * A select's options: the distinct non-empty values over `rows`, in natural order
 * (`a.localeCompare(b, undefined, { numeric: true })`, so "Cell 2" before "Cell 10", "5-10" before "10-15").
 */
export function optionsOf<R>(rows: R[], select: TableSelect<R>): string[] {
  throw new Error('not implemented');
}
