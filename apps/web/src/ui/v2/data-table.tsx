/* eslint-disable i18next/no-literal-string -- icon names and typed unions only; every visible word comes in as a prop or t() */
import { useState, type ReactNode } from 'react';
import { fill } from '../../i18n/fill.js';
import { Icon } from './icons.js';
import { MOTION } from './motion.js';
import { TableBar, TableHead, TablePager, type SortState } from './table-parts.js';
import { tablePage } from './table-model.js';

export type Column<R> = {
  key: string;
  label: string;
  /** Right-aligned, in the number face, tabular. */
  numeric?: boolean;
  /** Sortable when given: what the column sorts by. */
  sortBy?: (row: R) => number | string;
  cell: (row: R) => ReactNode;
};
export type FilterChip<R> = { key: string; label: string; test?: (row: R) => boolean };
export type TableWords = {
  title: string;
  /** The search box's prompt, e.g. "Search 125 machines". */
  search: string;
  /** `{from}`–`{to}` of `{total}`. */
  showing: string;
  noResults: string;
  /** The row action's name, e.g. "Open". */
  open: string;
};

type TableProps<R> = {
  rows: R[];
  rowKey: (row: R) => string;
  columns: Column<R>[];
  filters: FilterChip<R>[];
  text: (row: R) => string;
  words: TableWords;
  initialSort?: SortState;
  selected?: string;
  onOpen: (row: R) => void;
};

/** What the reader has asked of a table (search, chip, sort, page) and the page that answers it. */
function useTable<R>({ rows, columns, filters, text, initialSort }: TableProps<R>) {
  const [query, setQuery] = useState('');
  const [chip, setChip] = useState(filters[0]?.key ?? '');
  const [sort, setSort] = useState<SortState | undefined>(initialSort);
  const [page, setPage] = useState(1);
  const [changes, setChanges] = useState(0);
  /** A new search, chip or sort goes back to page 1, and the rows re-flow in. */
  const changed =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      set(v);
      setPage(1);
      setChanges((n) => n + 1);
    };
  const view = tablePage(rows, {
    query,
    text,
    filter: filters.find((f) => f.key === chip)?.test,
    sortBy: columns.find((c) => c.key === sort?.key)?.sortBy,
    dir: sort?.dir,
    page,
  });
  const ask = {
    query,
    chip,
    sort,
    onQuery: changed(setQuery),
    onChip: changed(setChip),
    onSort: changed(setSort),
    setPage,
  };
  return { view, changes, ask };
}

/** One page of rows; each opens the drawer, by a click anywhere on it or by its action button. */
function TableRows<R>({ t, rows, changes }: { t: TableProps<R>; rows: R[]; changes: number }) {
  return (
    <tbody key={changes}>
      {rows.map((row, i) => {
        const key = t.rowKey(row);
        return (
          <tr
            key={key}
            className={changes ? MOTION.reflow : undefined}
            style={{ ['--v2-i' as string]: i }}
            data-selected={key === t.selected}
            onClick={() => t.onOpen(row)}
          >
            {t.columns.map((c) => (
              <td key={c.key} className={c.numeric ? 'v2-num-cell' : undefined}>
                {c.cell(row)}
              </td>
            ))}
            <td className="v2-row-action">
              <button
                type="button"
                className="v2-icon-btn"
                aria-label={`${t.words.open} ${key}`}
                onClick={(e) => (e.stopPropagation(), t.onOpen(row))}
              >
                <Icon name="chevronRight" />
              </button>
            </td>
          </tr>
        );
      })}
    </tbody>
  );
}

/**
 * A v2 table: search, filter chips, sort on the columns that matter, ten rows a page, a sticky header, numbers right
 * in tabular figures. A row opens the drawer (click it, or its action from the keyboard); the action shows on hover.
 * When a filter, a sort or a search changes the rows, they re-flow in.
 */
export function DataTable<R>(props: TableProps<R>) {
  const { words, columns, filters } = props;
  const { view, changes, ask } = useTable(props);
  return (
    <section className="v2-card v2-table-card" aria-label={words.title}>
      <TableBar
        title={words.title}
        search={words.search}
        query={ask.query}
        onQuery={ask.onQuery}
        chips={filters}
        chip={ask.chip}
        onChip={ask.onChip}
      />
      <div className="v2-table-scroll">
        <table className="v2-table">
          <TableHead columns={columns} sort={ask.sort} onSort={ask.onSort} />
          <TableRows t={props} rows={view.rows} changes={changes} />
        </table>
        <div role="status">
          {view.total === 0 ? <p className="v2-no-results">{words.noResults}</p> : null}
        </div>
      </div>
      <TablePager
        showing={fill(words.showing, { from: view.from, to: view.to, total: view.total })}
        page={view.page}
        pages={view.pages}
        onPage={ask.setPage}
      />
    </section>
  );
}
