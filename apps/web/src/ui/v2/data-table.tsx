/* eslint-disable i18next/no-literal-string -- icon names and typed unions only; every visible word comes in as a prop or t() */
import { useState, type ReactNode } from 'react';
import { fill } from '../../i18n/fill.js';
import { Icon } from './icons.js';
import { MOTION } from './motion.js';
import {
  ExpandButton,
  FoldRow,
  MeasureCell,
  TableBar,
  TableHead,
  TablePager,
  measureOf,
  type SortState,
} from './table-parts.js';
import { foldAt, missesTarget, tablePage, worstFirst } from './table-model.js';
import { Takeaway, type Meaning, type TakeawayData } from './takeaway.js';
import type { Status } from './status.js';
import type { TableSelect } from './table-filters.js';

export type Column<R> = {
  key: string;
  label: string;
  /** Right-aligned, in the number face, tabular. */
  numeric?: boolean;
  /** Sortable when given: what the column sorts by. */
  sortBy?: (row: R) => number | string;
  cell: (row: R) => ReactNode;
  /**
   * The table's measure (ticket 620, at most one column has it): what its number is and what it means. The table then
   * ranks worst first, marks the worst row, draws the number as a bar and folds the tail.
   */
  meaning?: Meaning & { value: (row: R) => number };
  /** What the cell's figure means (ADR 0036): the cell's `<td>` wears it as `data-status`; absent → no attribute. */
  status?: (row: R) => Status;
};
export type FilterChip<R> = { key: string; label: string; test?: (row: R) => boolean };
export type TableWords = {
  title: string;
  /** One quiet line under the title. */
  sub?: string;
  /** The search box's prompt, e.g. "Search 125 machines". */
  search: string;
  /** `{from}`–`{to}` of `{total}`. */
  showing: string;
  noResults: string;
  /** The row action's name, e.g. "Open". */
  open: string;
};

/** A table with more columns than this scrolls sideways inside its card instead of running past it. */

type TableProps<R> = {
  rows: R[];
  rowKey: (row: R) => string;
  /** What the row's open button is called, when it is not the key (a machine that appears in many rows). */
  rowLabel?: (row: R) => string;
  columns: Column<R>[];
  filters: FilterChip<R>[];
  text: (row: R) => string;
  words: TableWords;
  initialSort?: SortState;
  selected?: string;
  /** Beside the title. */
  aside?: ReactNode;
  /** What a row opens in the drawer; a table whose rows open nothing leaves it out and its rows are not buttons. */
  onOpen?: (row: R) => void;
  /** The line the table opens with, under its title (UX rule 60). */
  takeaway?: TakeawayData;
  /** A row's detail, opened in place under it by the row's expand button (UX rule 64). */
  expand?: (row: R) => ReactNode;
  /**
   * The table's total (ADR 0036 R14), one cell per column in column order: drawn as the footer
   * (`<tfoot><tr class="v2-total">`, one `<td>` per column, the action cell empty), never a row in `<tbody>`, never
   * sorted, ranked or folded. Under 10 rows (`isSmall(rows.length)`, all rows) the table has no search and no pager.
   */
  total?: ReactNode[];
  /**
   * Dropdown filters (ADR 0036 R16): one `SelectField` per select (first option `insight.filter.all` with {label},
   * options `optionsOf(rows, select)`), then a "Reset filters" button (`insight.filter.reset`) that clears them all,
   * shown only when something is chosen. Rows go through `applyFilters` before search and sort.
   */
  selects?: TableSelect<R>[];
};

const rankedBy = <R,>(rows: R[], measure: Column<R>['meaning']) =>
  measure ? worstFirst(rows, measure.value, measure.worse) : rows;

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
  const [unfolded, setUnfolded] = useState(false);
  const measure = measureOf(columns)?.meaning;
  // Worst first until the reader chooses a sort; a chosen sort wins.
  const ranked = rankedBy(rows, measure);
  const view = tablePage(sort ? rows : ranked, {
    query,
    text,
    filter: filters.find((f) => f.key === chip)?.test,
    sortBy: columns.find((c) => c.key === sort?.key)?.sortBy,
    dir: sort?.dir,
    page,
  });
  // The untouched view folds its tail.
  const untouched = !sort && changes === 0 && page === 1 && !unfolded;
  const fold = foldOf(ranked, measure, untouched);
  const ask = {
    query,
    chip,
    sort,
    onQuery: changed(setQuery),
    onChip: changed(setChip),
    onSort: changed(setSort),
    setPage,
  };
  return {
    view,
    changes,
    ask,
    fold,
    unfold: () => setUnfolded(true),
    worst: measure && ranked[0],
  };
}

type Fold = { at: number; hidden: number; within: boolean };

/** Where the worst-first rows fold, and what the folded tail holds; counted over all rows, not the page. */
function foldOf<R>(
  ranked: R[],
  measure: Column<R>['meaning'],
  untouched: boolean,
): Fold | undefined {
  if (!measure || !untouched) return undefined;
  const at = foldAt(ranked.map(measure.value), measure);
  if (at >= ranked.length) return undefined;
  const hidden = ranked.slice(at);
  const within = !!measure.target && !hidden.some((r) => missesTarget(measure.value(r), measure));
  return { at, hidden: hidden.length, within };
}

/** A row's action cell: its expand button and the button that opens it in the drawer. */
function RowActions<R>({
  t,
  row,
  open,
  onToggle,
}: {
  t: TableProps<R>;
  row: R;
  open: boolean;
  onToggle: () => void;
}) {
  const name = t.rowLabel?.(row) ?? t.rowKey(row);
  return (
    <td className="v2-row-action">
      {t.expand ? <ExpandButton name={name} open={open} onToggle={onToggle} /> : null}
      {t.onOpen ? (
        <button
          type="button"
          className="v2-icon-btn"
          aria-label={`${t.words.open} ${name}`}
          onClick={(e) => (e.stopPropagation(), t.onOpen?.(row))}
        >
          <Icon name="chevronRight" />
        </button>
      ) : null}
    </td>
  );
}

/** One row, and under it its detail when the reader has opened it. */
function DataRow<R>({
  t,
  row,
  i,
  reflow,
  largest,
  pill,
  worst,
}: {
  t: TableProps<R>;
  row: R;
  i: number;
  reflow: boolean;
  largest: number;
  pill?: TakeawayData;
  worst: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <tr
        className={reflow ? MOTION.reflow : undefined}
        style={{ ['--v2-i' as string]: i }}
        data-selected={t.rowKey(row) === t.selected}
        data-worst={worst || undefined}
        onClick={t.onOpen && (() => t.onOpen?.(row))}
      >
        {t.columns.map((c) => (
          <td key={c.key} className={c.numeric ? 'v2-num-cell' : undefined}>
            {c.meaning ? (
              <MeasureCell column={c} row={row} largest={largest} pill={worst ? pill : undefined} />
            ) : (
              c.cell(row)
            )}
          </td>
        ))}
        <RowActions t={t} row={row} open={open} onToggle={() => setOpen((o) => !o)} />
      </tr>
      {t.expand && open ? (
        <tr className="v2-expand-row">
          <td colSpan={t.columns.length + 1}>{t.expand(row)}</td>
        </tr>
      ) : null}
    </>
  );
}

/** One page of rows; each opens the drawer, by a click anywhere on it or by its action button. */
function TableRows<R>({
  t,
  rows,
  changes,
  worst,
  fold,
  onUnfold,
}: {
  t: TableProps<R>;
  rows: R[];
  changes: number;
  worst?: R;
  fold?: Fold;
  onUnfold: () => void;
}) {
  const m = measureOf(t.columns)?.meaning;
  const largest = m ? Math.max(...t.rows.map(m.value)) : 0;
  const pill = t.takeaway?.tone === 'loss' || t.takeaway?.tone === 'risk' ? t.takeaway : undefined;
  return (
    <tbody key={changes}>
      {(fold ? rows.slice(0, fold.at) : rows).map((row, i) => (
        <DataRow
          key={t.rowKey(row)}
          t={t}
          row={row}
          i={i}
          reflow={changes > 0}
          largest={largest}
          pill={pill}
          worst={worst !== undefined && row === worst}
        />
      ))}
      {fold ? (
        <FoldRow
          columns={t.columns.length}
          hidden={fold.hidden}
          within={fold.within}
          onShow={onUnfold}
        />
      ) : null}
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
  const { view, changes, ask, fold, unfold, worst } = useTable(props);
  return (
    <section className="v2-card v2-table-card" aria-label={words.title}>
      <TableBar
        title={words.title}
        sub={words.sub}
        aside={props.aside}
        search={words.search}
        query={ask.query}
        onQuery={ask.onQuery}
        chips={filters}
        chip={ask.chip}
        onChip={ask.onChip}
      />
      {props.takeaway ? <Takeaway data={props.takeaway} /> : null}
      <div className="v2-table-scroll">
        <table className="v2-table">
          <TableHead columns={columns} sort={ask.sort} onSort={ask.onSort} />
          <TableRows
            t={props}
            rows={view.rows}
            changes={changes}
            worst={worst}
            fold={fold}
            onUnfold={unfold}
          />
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
