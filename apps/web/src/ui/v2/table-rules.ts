/** A table with fewer rows than this has no search box and no pager (ADR 0036 R13). */
export const SMALL_TABLE = 10;

/** True when a table of `n` rows (all of them, never the filtered ones) is small: `n < SMALL_TABLE`. */
export function isSmall(n: number): boolean {
  return n < SMALL_TABLE;
}
