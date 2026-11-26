/* eslint-disable i18next/no-literal-string -- icon names and typed unions only; every visible word comes in as a prop or t() */
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { fill } from '../../i18n/fill.js';
import type { Column } from './data-table.js';
import { Icon } from './icons.js';
import { KeyPill } from './key-pill.js';
import { barOf, type SortDir } from './table-model.js';
import {
  BAR_COLUMNS,
  catOf,
  marks,
  scaled,
  tidyCell,
  topIndexes,
  type ColumnLook,
} from './table-look.js';
import type { TakeawayData } from './takeaway.js';

export type SortState = { key: string; dir: SortDir };
type HeadColumn = { key: string; label: string; numeric?: boolean; sortBy?: unknown };

/** The sticky header: a sortable column is a button that says its order; numbers head right. */
export function TableHead({
  columns,
  sort,
  onSort,
}: {
  columns: HeadColumn[];
  sort?: SortState;
  onSort: (sort: SortState) => void;
}) {
  return (
    <thead>
      <tr>
        {columns.map((c) => {
          const on = sort?.key === c.key;
          const aria = on ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined;
          return (
            <th
              key={c.key}
              scope="col"
              aria-sort={aria}
              className={c.numeric ? 'v2-num-head' : undefined}
            >
              {c.sortBy ? (
                <button
                  type="button"
                  className="v2-sort"
                  data-on={on}
                  onClick={() =>
                    onSort({ key: c.key, dir: on && sort.dir === 'desc' ? 'asc' : 'desc' })
                  }
                >
                  {c.label}
                  <Icon name="sort" size={12} />
                </button>
              ) : (
                c.label
              )}
            </th>
          );
        })}
        <th scope="col" className="v2-row-action" />
      </tr>
    </thead>
  );
}

/** "1–10 of 125" and the two steps between pages. */
export function TablePager({
  showing,
  page,
  pages,
  onPage,
}: {
  showing: string;
  page: number;
  pages: number;
  onPage: (page: number) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="v2-pager">
      <span className="v2-num">{showing}</span>
      <div className="v2-row v2-gap-6">
        <button
          type="button"
          className="v2-btn v2-btn-ghost v2-btn-small"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
        >
          {t('analytics.table.previous')}
        </button>
        <button
          type="button"
          className="v2-btn v2-btn-ghost v2-btn-small"
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
        >
          {t('analytics.table.next')}
        </button>
      </div>
    </div>
  );
}

/** The table's title, with its one quiet line when it has one. */
function TableTitle({ title, sub }: { title: string; sub?: string }) {
  return sub ? (
    <div>
      <h2 className="v2-h2">{title}</h2>
      <p className="v2-sub">{sub}</p>
    </div>
  ) : (
    <h2 className="v2-h2">{title}</h2>
  );
}

/** The table's title, its search and its filter chips (one chosen at a time). */
export function TableBar({
  title,
  sub,
  aside,
  search,
  query,
  onQuery,
  chips,
  chip,
  onChip,
  hideSearch = false,
}: {
  /** Empty when the page above already heads the table. */
  title: string;
  /** One quiet line under the title (a count, a total). */
  sub?: string;
  /** Something beside the title: the control that opens the rows behind the table's figure. */
  aside?: ReactNode;
  search: string;
  query: string;
  onQuery: (query: string) => void;
  chips: { key: string; label: string }[];
  chip: string;
  onChip: (key: string) => void;
  /** A list the server cannot search yet has no search box, rather than one that does nothing. */
  hideSearch?: boolean;
}) {
  return (
    <div className="v2-table-bar">
      {title ? <TableTitle title={title} sub={sub} /> : null}
      {aside}
      {hideSearch ? null : (
        <label className="v2-table-search">
          <Icon name="search" />
          <input
            type="search"
            aria-label={search}
            placeholder={search}
            value={query}
            onChange={(e) => onQuery(e.target.value)}
          />
        </label>
      )}
      <div className="v2-chips">
        {chips.map((f) => (
          <button
            key={f.key}
            type="button"
            className="v2-chip"
            aria-pressed={f.key === chip}
            onClick={() => onChip(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** The table's measure column, when a screen declared one (ticket 620). */
export const measureOf = <R,>(columns: Column<R>[]) => columns.find((c) => c.meaning);

/** A column's look: the declared one, else the measure's (worse when high: a loss; when low: a gain). */
export const lookOf = <R,>(c: Column<R>): ColumnLook | undefined =>
  c.look ?? (c.meaning ? (c.meaning.worse === 'high' ? 'loss' : 'gain') : undefined);

const numberOf = <R,>(c: Column<R>, row: R): number => {
  const v = c.meaning ? c.meaning.value(row) : c.sortBy?.(row);
  return typeof v === 'number' && Number.isFinite(v) ? v : Number.NaN;
};

/** What a table needs to colour its cells (ADR 0060): each scaled column's largest value, the ranked column and its top rows, and bars or tints. */
export type Looks<R> = {
  largest: Record<string, number>;
  ranked?: string;
  top: Set<R>;
  tint: boolean;
};

/**
 * The looks of a table over `rows` (all of them for `DataTable`, the page for `PagedTable`). The ranked column is the
 * chosen sort's, else the measure's, else the first coloured column the rows already run down, else the first coloured
 * one; its top rows are marked only when that column has a coloured meaning.
 */
export function looksOf<R>(columns: Column<R>[], rows: R[], sorted?: string): Looks<R> {
  const toned = columns.filter((c) => c.numeric && scaled(lookOf(c)));
  const largest = Object.fromEntries(
    toned.map((c) => [
      c.key,
      Math.max(0, ...rows.map((r) => numberOf(c, r)).filter(Number.isFinite)),
    ]),
  );
  const coloured = toned.filter((c) => marks(lookOf(c)));
  // Untouched, a table is ranked by the coloured column its rows already run down (the engine's order).
  const downward = (c: Column<R>) =>
    rows.every((r, i) => i === 0 || !(numberOf(c, r) > numberOf(c, rows[i - 1] as R)));
  const key =
    sorted ?? columns.find((c) => c.meaning)?.key ?? (coloured.find(downward) ?? coloured[0])?.key;
  const by = columns.find((c) => c.key === key);
  const ranked = by && by.numeric && marks(lookOf(by)) ? by : undefined;
  const top = ranked
    ? new Set([...topIndexes(rows.map((r) => numberOf(ranked, r)))].map((at) => rows[at] as R))
    : new Set<R>();
  return { largest, ranked: ranked?.key, top, tint: toned.length > BAR_COLUMNS };
}

/**
 * Any cell but a measure's, coloured by its column's look: a category word as a pill in its fixed colour; a number
 * with a meaning on a bar (or a tint, in a wide table) scaled to its column, its colour strong on the ranked column's
 * top rows. A cell that holds an element (a chip, a button) is left as it is. No raw float prints (`tidyCell`).
 */
export function LookCell<R>({
  column,
  row,
  looks,
}: {
  column: Column<R>;
  row: R;
  looks: Looks<R>;
}) {
  const look = lookOf(column);
  const content = tidyCell(column.cell(row));
  if (look === 'category' && typeof content === 'string' && /\p{L}/u.test(content))
    return <KeyPill text={content} tone="neutral" cat={catOf(content)} />;
  const bare = typeof content === 'string' || typeof content === 'number';
  if (!column.numeric || !scaled(look) || !bare) return content;
  const top = looks.ranked === column.key && looks.top.has(row) ? '' : undefined;
  const share = barOf(numberOf(column, row), looks.largest[column.key] ?? 0);
  if (looks.tint)
    return (
      <span
        className="v2-celltint"
        data-tone={look}
        data-top={top}
        style={{ ['--v2-share' as string]: share.toFixed(2) }}
      >
        {content}
      </span>
    );
  return (
    <span className="v2-cellbar" data-tone={look} data-top={top}>
      {content}
      <span className="v2-cellbar-track" aria-hidden="true">
        <span style={{ width: `${(share * 100).toFixed(1)}%` }} />
      </span>
    </span>
  );
}

/** A measure cell: the number, a bar as long as its share of the largest (or the target), and the worst row's tag. */
export function MeasureCell<R>({
  column,
  row,
  largest,
  pill,
  top,
}: {
  column: Column<R>;
  row: R;
  largest: number;
  pill?: TakeawayData;
  /** One of the ranked column's top rows (ADR 0060): its number and bar take the meaning's colour. */
  top?: boolean;
}) {
  const m = column.meaning;
  if (!m) return tidyCell(column.cell(row));
  const share = barOf(m.value(row), largest, m.target?.value);
  return (
    <>
      <span className="v2-cellbar" data-tone={lookOf(column)} data-top={top ? '' : undefined}>
        {tidyCell(column.cell(row))}
        <span className="v2-cellbar-track" aria-hidden="true">
          <span style={{ width: `${(share * 100).toFixed(1)}%` }} />
        </span>
      </span>
      {pill ? <KeyPill text={pill.tag} tone={pill.tone} /> : null}
    </>
  );
}

/** A row's expand button: says whether the row is open; never opens the drawer. */
export function ExpandButton({
  name,
  open,
  onToggle,
}: {
  name: string;
  open: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      className="v2-icon-btn"
      aria-expanded={open}
      aria-label={fill(t('insight.expand'), { name })}
      onClick={(e) => (e.stopPropagation(), onToggle())}
    >
      <Icon name="chevronDown" />
    </button>
  );
}

/** The folded tail of a table: one line that shows the rest. */
export function FoldRow({
  columns,
  hidden,
  within,
  onShow,
}: {
  columns: number;
  hidden: number;
  within: boolean;
  onShow: () => void;
}) {
  const { t } = useTranslation();
  return (
    <tr>
      <td colSpan={columns + 1}>
        <button type="button" className="v2-fold" onClick={onShow}>
          {fill(t(within ? 'insight.fold.within' : 'insight.fold.more'), { n: hidden })}
        </button>
      </td>
    </tr>
  );
}
