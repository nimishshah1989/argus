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
