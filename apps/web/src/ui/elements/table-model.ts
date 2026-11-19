import { useMemo, useState, type ReactNode } from 'react';

/** No list paints more than this many rows at once (ticket 83); more rows mean more pages. */
export const MAX_PAGE_ROWS = 50;
/** Above this many rows a list pages on the server: the caller sorts, filters and slices there. */
export const CLIENT_LIMIT = 200;

export interface Column<R> {
  id: string;
  header: string;
  cell: (row: R) => ReactNode;
  /** Present makes the column sortable; the value the rows are ordered by. */
  sortValue?: (row: R) => number | string;
  numeric?: boolean;
}

export interface Sort {
  column: string;
  dir: 'asc' | 'desc';
}

export interface TableQuery {
  sort?: Sort;
  filter: string;
  page: number;
  pageSize: number;
}

export interface TableView<R> {
  rows: R[];
  /** Rows that match the filter, across all pages. */
  total: number;
  pages: number;
  /** The page shown, 0-based, kept inside the range. */
  page: number;
}

export const pageSizeOf = (size: number): number =>
  Math.min(MAX_PAGE_ROWS, Math.max(1, Math.floor(size) || 1));

/** Filter by text, order by the sort column, cut one page. Numbers order as numbers, words in the reader's order. */
export function tableView<R>(
  rows: R[],
  columns: Column<R>[],
  query: TableQuery,
  filterText: (row: R) => string,
): TableView<R> {
  const needle = query.filter.trim().toLowerCase();
  let shown = needle ? rows.filter((row) => filterText(row).toLowerCase().includes(needle)) : rows;
  const by = columns.find((c) => c.id === query.sort?.column)?.sortValue;
  if (by && query.sort) {
    const sign = query.sort.dir === 'asc' ? 1 : -1;
    shown = [...shown].sort((a, b) => {
      const [x, y] = [by(a), by(b)];
      const nanX = typeof x === 'number' && Number.isNaN(x);
      const nanY = typeof y === 'number' && Number.isNaN(y);
      // NaN has no order: it sorts last in both directions, like a missing cell.
      if (nanX || nanY) return nanX === nanY ? 0 : nanX ? 1 : -1;
      return (
        sign *
        (typeof x === 'number' && typeof y === 'number'
          ? x - y
          : String(x).localeCompare(String(y), undefined, { numeric: true }))
      );
    });
  }
  const size = pageSizeOf(query.pageSize);
  const pages = Math.max(1, Math.ceil(shown.length / size));
  const page = Math.min(Math.max(0, query.page), pages - 1);
  return { rows: shown.slice(page * size, (page + 1) * size), total: shown.length, pages, page };
}

/** The next sort when a header is pressed: ascending, then descending, then back to the given order. */
export function nextSort(current: Sort | undefined, column: string): Sort | undefined {
  if (current?.column !== column) return { column, dir: 'asc' };
  return current.dir === 'asc' ? { column, dir: 'desc' } : undefined;
}

/** A list held in memory (at most `CLIENT_LIMIT` rows): the state and the view for a `DataTable`. */
export function useClientTable<R>(
  rows: R[],
  columns: Column<R>[],
  filterText: (row: R) => string,
  pageSize = 25,
) {
  if (rows.length > CLIENT_LIMIT)
    throw new Error(`a list of ${rows.length} rows pages on the server (limit ${CLIENT_LIMIT})`);
  const [sort, setSort] = useState<Sort>();
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(0);
  const view = useMemo(
    () => tableView(rows, columns, { sort, filter, page, pageSize }, filterText),
    [rows, columns, sort, filter, page, pageSize, filterText],
  );
  return {
    ...view,
    sort,
    filter,
    pageSize: pageSizeOf(pageSize),
    onSort: (column: string) => {
      setSort(nextSort(sort, column));
      setPage(0);
    },
    onFilter: (text: string) => {
      setFilter(text);
      setPage(0);
    },
    onPage: setPage,
  };
}
