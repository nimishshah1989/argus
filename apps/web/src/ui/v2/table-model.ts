import type { Meaning } from './takeaway.js';

/** What a v2 table shows: search, one filter chip, one sort, one page of at most 10 rows (UX-RULES.md §4). */
export type SortDir = 'asc' | 'desc';
export type TableQuery<R> = {
  query: string;
  text: (row: R) => string;
  filter?: (row: R) => boolean;
  sortBy?: (row: R) => number | string;
  dir?: SortDir;
  page: number;
  size?: number;
};
export type TablePage<R> = {
  rows: R[];
  total: number;
  from: number;
  to: number;
  pages: number;
  page: number;
};

export const PAGE_SIZE = 10;

/** The rows that match, in order, cut to the asked page (clamped to the last page there is). */
export function tablePage<R>(all: R[], q: TableQuery<R>): TablePage<R> {
  const size = q.size ?? PAGE_SIZE;
  const needle = q.query.trim().toLocaleLowerCase();
  let rows = all.filter(
    (r) =>
      (!q.filter || q.filter(r)) && (!needle || q.text(r).toLocaleLowerCase().includes(needle)),
  );
  if (q.sortBy) {
    const by = q.sortBy;
    const sign = q.dir === 'asc' ? 1 : -1;
    rows = [...rows].sort((a, b) => {
      const x = by(a);
      const y = by(b);
      return (
        sign *
        (typeof x === 'number' && typeof y === 'number'
          ? x - y
          : String(x).localeCompare(String(y)))
      );
    });
  }
  const total = rows.length;
  const pages = Math.max(1, Math.ceil(total / size));
  const page = Math.min(Math.max(1, q.page), pages);
  const start = (page - 1) * size;
  const shown = rows.slice(start, start + size);
  return { rows: shown, total, pages, page, from: total ? start + 1 : 0, to: start + shown.length };
}

/**
 * The rows worst first by `value` (ticket 620, UX rule 63): largest first when high is worse, smallest first when low
 * is worse. Rows with equal values keep their order; a value that is not finite goes last. Never changes `rows`.
 */
export function worstFirst<R>(rows: R[], value: (row: R) => number, worse: Meaning['worse']): R[] {
  const rank = (r: R) => {
    const v = value(r);
    return Number.isFinite(v) ? (worse === 'high' ? -v : v) : Infinity;
  };
  // Array.sort is stable, so equal values keep their order; Infinity (not finite) sorts last.
  return [...rows].sort((a, b) => {
    const x = rank(a);
    const y = rank(b);
    return x === y ? 0 : x < y ? -1 : 1;
  });
}

/**
 * A measure cell's bar length, 0 to 1: `value` over the scale, the scale being the larger of the column's `largest`
 * value and the `target` when there is one. 0 when the scale is not above 0, or the value is not finite or below 0.
 * Never above 1.
 */
export function barOf(value: number, largest: number, target?: number): number {
  const scale = Math.max(largest, target ?? 0);
  if (!(scale > 0) || !Number.isFinite(value) || value < 0) return 0;
  return Math.min(1, value / scale);
}

/** The value is on the bad side of the meaning's target (equal meets it). No target: false. */
export function missesTarget(value: number, meaning: Meaning): boolean {
  const target = meaning.target?.value;
  if (target === undefined) return false;
  return meaning.worse === 'high' ? value > target : value < target;
}

/**
 * How many worst-first rows a table shows before its tail folds (UX rule 63). With a target: the number of values that
 * miss it, clamped to 3–5; without one: 5. When folding would hide one row or none, every row shows: the result is
 * then `values.length`.
 */
export function foldAt(values: number[], meaning: Meaning): number {
  const n = meaning.target
    ? Math.min(5, Math.max(3, values.filter((v) => missesTarget(v, meaning)).length))
    : 5;
  return values.length - n <= 1 ? values.length : n;
}
