/* eslint-disable i18next/no-literal-string -- icon names and typed unions only; every visible word comes in as a prop or t() */
// lean-allow: the v2 kit table owns search, filters, sort, paging and the row drawer in one place; splitting it is its own change.
import { useContext, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { fill } from '../../i18n/fill.js';
import { EntityOpenContext } from './entity-chip.js';
import { Icon } from './icons.js';
import { entityOfRow } from './row-entity.js';
import { MOTION } from './motion.js';
import {
  ExpandButton,
  FoldRow,
  LookCell,
  MeasureCell,
  looksOf,
  type Looks,
  TableBar,
  TableHead,
  TablePager,
  measureOf,
  type SortState,
} from './table-parts.js';
import { isSmall } from './table-rules.js';
import { foldAt, missesTarget, tablePage, worstFirst } from './table-model.js';
import { Takeaway, type Meaning, type TakeawayData } from './takeaway.js';
import type { Status } from './status.js';
import { applyFilters, optionsOf, type TableSelect } from './table-filters.js';
import { SelectField } from './select-field.js';
import type { ColumnLook } from './table-look.js';

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
  /**
   * How the column colours itself (ADR 0061): a meaning bars its numbers and marks its top rows, `category` makes its
   * words pills, `plain` leaves an id, a date or a count alone. Absent: plain, or the measure's own meaning.
   */
  look?: ColumnLook;
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
  open?: string;
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
  /** The page above already draws the title as its heading: the table keeps it as its label and draws no second one. */
  headed?: boolean;
  /** Beside the title. */
  aside?: ReactNode;
  /**
   * What a row opens in the drawer. Left out, a row that names a machine, cell, person or decision (`entityOfRow`)
   * opens that in the drawer (UX rule 18, ADR 0060); a table whose rows name nothing has rows that are not buttons.
   */
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
  /** Drawn under the pager only while the reader is on the last page (or the only one): e.g. a "load older" button. */
  more?: ReactNode;
};

const rankedBy = <R,>(rows: R[], measure: Column<R>['meaning']) =>
  measure ? worstFirst(rows, measure.value, measure.worse) : rows;

const filtered = <R,>(t: TableProps<R>, chosen: Record<string, string>) =>
  applyFilters(t.rows, t.selects ?? [], chosen);

/** What the reader has asked of a table (search, chip, sort, page) and the page that answers it. */
function useTable<R>(props: TableProps<R>) {
  const { columns, filters, text, initialSort } = props;
  const [chosen, setChosen] = useState<Record<string, string>>({});
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
  const kept = filtered(props, chosen);
  const ranked = rankedBy(kept, measure);
  const view = tablePage(sort ? kept : ranked, {
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
    chosen,
    onChosen: changed(setChosen),
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

/** The dropdown filters (ADR 0036 R16), and the button that clears them all once any is chosen. */
function Selects<R>({
  selects,
  rows,
  chosen,
  onChosen,
}: {
  selects: TableSelect<R>[];
  rows: R[];
  chosen: Record<string, string>;
  onChosen: (chosen: Record<string, string>) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="v2-table-selects">
      {selects.map((s) => (
        <SelectField
          key={s.key}
          label={s.label}
          all={fill(t('insight.filter.all'), { label: s.label })}
          value={chosen[s.key] ?? ''}
          options={optionsOf(rows, s).map((o) => ({ key: o, label: o }))}
          onChange={(v) => onChosen({ ...chosen, [s.key]: v })}
        />
      ))}
      {Object.values(chosen).some(Boolean) ? (
        <button type="button" className="v2-btn v2-btn-ghost" onClick={() => onChosen({})}>
          {t('insight.filter.reset')}
        </button>
      ) : null}
    </div>
  );
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
  looks,
}: {
  t: TableProps<R>;
  row: R;
  i: number;
  reflow: boolean;
  largest: number;
  pill?: TakeawayData;
  worst: boolean;
  looks: Looks<R>;
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
          <td
            key={c.key}
            className={c.numeric ? 'v2-num-cell' : undefined}
            data-status={c.status?.(row)}
          >
            {c.meaning ? (
              <MeasureCell
                column={c}
                row={row}
                largest={largest}
                pill={worst ? pill : undefined}
                top={looks.ranked === c.key && looks.top.has(row)}
              />
            ) : (
              <LookCell column={c} row={row} looks={looks} />
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
  sorted,
}: {
  t: TableProps<R>;
  rows: R[];
  changes: number;
  worst?: R;
  fold?: Fold;
  onUnfold: () => void;
  /** The column the reader sorted by, which then decides the marked top rows. */
  sorted?: string;
}) {
  const m = measureOf(t.columns)?.meaning;
  const looks = looksOf(t.columns, t.rows, sorted);
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
          looks={looks}
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

/** The table's total: one cell per column, the action cell empty; a footer, so never sorted, ranked or folded. */
function TotalFoot<R>({ columns, cells }: { columns: Column<R>[]; cells: ReactNode[] }) {
  return (
    <tfoot>
      <tr className="v2-total">
        {cells.map((cell, i) => (
          <td
            key={columns[i]?.key ?? i}
            className={columns[i]?.numeric ? 'v2-num-cell' : undefined}
          >
            {cell}
          </td>
        ))}
        <td className="v2-row-action" />
      </tr>
    </tfoot>
  );
}

/**
 * A v2 table: search, filter chips, sort on the columns that matter, ten rows a page, a sticky header, numbers right
 * in tabular figures. A row opens the drawer (click it, or its action from the keyboard); the action shows on hover.
 * When a filter, a sort or a search changes the rows, they re-flow in.
 */
/** The table as drawn: when its screen wired no row action, a row opens the thing it names, in the drawer. */
function useRowOpen<R>(given: TableProps<R>): TableProps<R> {
  const open = useContext(EntityOpenContext);
  const { t } = useTranslation();
  if (given.onOpen || !given.rows.some((row) => entityOfRow(row))) return given;
  return {
    ...given,
    words: { ...given.words, open: given.words.open ?? t('v2m.open') },
    onOpen: (row) => {
      const ref = entityOfRow(row);
      if (ref) open(ref);
    },
  };
}

export function DataTable<R>(given: TableProps<R>) {
  const props = useRowOpen(given);
  const { words, columns, filters } = props;
  const { view, changes, ask, fold, unfold, worst } = useTable(props);
  const small = isSmall(props.rows.length);
  return (
    <section className="v2-card v2-table-card" aria-label={words.title}>
      <TableBar
        title={props.headed ? '' : words.title}
        sub={words.sub}
        aside={props.aside}
        search={words.search}
        query={ask.query}
        onQuery={ask.onQuery}
        chips={filters}
        chip={ask.chip}
        onChip={ask.onChip}
        hideSearch={small}
      />
      {props.selects?.length ? (
        <Selects
          selects={props.selects}
          rows={props.rows}
          chosen={ask.chosen}
          onChosen={ask.onChosen}
        />
      ) : null}
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
            sorted={ask.sort?.key}
          />
          {props.total ? <TotalFoot columns={columns} cells={props.total} /> : null}
        </table>
        <div role="status">
          {view.total === 0 ? <p className="v2-no-results">{words.noResults}</p> : null}
        </div>
      </div>
      {small ? null : (
        <TablePager
          showing={fill(words.showing, { from: view.from, to: view.to, total: view.total })}
          page={view.page}
          pages={view.pages}
          onPage={ask.setPage}
        />
      )}
      {small || view.page >= view.pages ? props.more : null}
    </section>
  );
}
