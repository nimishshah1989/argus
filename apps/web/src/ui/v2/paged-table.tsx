/* eslint-disable i18next/no-literal-string -- icon names and typed unions only; every visible word comes in as a prop or t() */
import { Fragment, useState, type ReactNode } from 'react';
import { fill } from '../../i18n/fill.js';
import type { Column, FilterChip, TableWords } from './data-table.js';
import { Takeaway, type TakeawayData } from './takeaway.js';
import { Icon } from './icons.js';
import { isSmall } from './table-rules.js';
import {
  ExpandButton,
  MeasureCell,
  TableBar,
  TableHead,
  TablePager,
  measureOf,
  type SortState,
} from './table-parts.js';

export type PagedWords = Omit<TableWords, 'showing'> & {
  /** `{from}`–`{to}` of `{total}` when the server counts the list. */
  showing: string;
  /** `{page}`, for a list the server pages without counting it. */
  page: string;
  /** What the table says while the next page is coming. */
  loading: string;
};

/** A choice among the values the server printed for one column ("All" first), asked of the server, not of the page. */
export type SelectFilter = {
  key: string;
  label: string;
  all: string;
  value: string;
  options: string[];
  /** A filter with long options takes a capped width instead of the widest option's. */
  compact?: boolean;
  /** How an option reads, when its value (what the server filters by) is not how it is said (a printed date). */
  labelOf?: (option: string) => string;
  onChange: (value: string) => void;
};

type Props<R> = {
  /** The one page the server sent: never more than 10 rows are held, so never more are drawn. */
  rows: R[];
  rowKey: (row: R) => string;
  /** What the row's open button is called, when it is not the key (a key that holds ids is never said aloud). */
  rowLabel?: (row: R) => string;
  columns: Column<R>[];
  filters: FilterChip<R>[];
  chip: string;
  onChip: (key: string) => void;
  /** Search and sort are the server's; a table whose server cannot do one leaves it out. */
  query?: string;
  onQuery?: (query: string) => void;
  sort?: SortState;
  onSort?: (sort: SortState) => void;
  selects?: SelectFilter[];
  /** something outside the table (a select beside it) has narrowed the list */
  narrowed?: boolean;
  /**
   * 1-based. `total` known: "1–10 of 1,343". Unknown: only whether another page follows (`hasNext`). A known `total`
   * under 10 (`isSmall`, ADR 0036 R13) draws no pager, unless a filter narrows it (the count then stays).
   */
  page: number;
  total?: number;
  hasNext?: boolean;
  onPage: (page: number) => void;
  loading: boolean;
  words: PagedWords;
  selected?: string;
  onOpen: (row: R) => void;
  /** Beside the title row: an action on the whole list (export). */
  extra?: ReactNode;
  /** A line under the table. */
  foot?: ReactNode;
  /** The line the table opens with, under its title (UX rule 60). The server pages the rows, so no rank and no fold. */
  takeaway?: TakeawayData;
  /** A row's detail, opened in place under it by the row's expand button (UX rule 64). */
  expand?: (row: R) => ReactNode;
};

const SIZE = 10;
const indian = new Intl.NumberFormat('en-IN');

/** The page's rows; each opens the drawer, by a click anywhere on it or by its action button. */
function PageRows<R>({ t }: { t: Props<R> }) {
  const [opened, setOpened] = useState<string[]>([]);
  const m = measureOf(t.columns)?.meaning;
  const largest = m ? Math.max(...t.rows.map(m.value)) : 0;
  const toggle = (key: string) =>
    setOpened((o) => (o.includes(key) ? o.filter((k) => k !== key) : [...o, key]));
  return (
    <tbody>
      {t.rows.map((row) => {
        const key = t.rowKey(row);
        return (
          <Fragment key={key}>
            <tr data-selected={key === t.selected} onClick={() => t.onOpen(row)}>
              {t.columns.map((c) => (
                <td
                  key={c.key}
                  className={c.numeric ? 'v2-num-cell' : undefined}
                  data-status={c.status?.(row)}
                >
                  {c.meaning ? <MeasureCell column={c} row={row} largest={largest} /> : c.cell(row)}
                </td>
              ))}
              <td className="v2-row-action">
                {t.expand ? (
                  <ExpandButton
                    name={t.rowLabel?.(row) ?? key}
                    open={opened.includes(key)}
                    onToggle={() => toggle(key)}
                  />
                ) : null}
                <button
                  type="button"
                  className="v2-icon-btn"
                  aria-label={`${t.words.open} ${t.rowLabel?.(row) ?? key}`}
                  onClick={(e) => (e.stopPropagation(), t.onOpen(row))}
                >
                  <Icon name="chevronRight" />
                </button>
              </td>
            </tr>
            {t.expand && opened.includes(key) ? (
              <tr className="v2-expand-row">
                <td colSpan={t.columns.length + 1}>{t.expand(row)}</td>
              </tr>
            ) : null}
          </Fragment>
        );
      })}
    </tbody>
  );
}

function Selects({ selects }: { selects: SelectFilter[] }) {
  return (
    <div className="v2-table-selects">
      {selects.map((s) => (
        <label key={s.key} className="v2-select-field">
          {s.label}
          <select
            aria-label={s.label}
            data-compact={s.compact || undefined}
            value={s.value}
            onChange={(e) => s.onChange(e.target.value)}
          >
            <option value="">{s.all}</option>
            {s.options.map((o) => (
              <option key={o} value={o}>
                {s.labelOf ? s.labelOf(o) : o}
              </option>
            ))}
          </select>
        </label>
      ))}
    </div>
  );
}

/** A search, a chip, a select or an outside narrowing has cut the list: small is then judged on the filtered count, not kept. */
function filteredOf<R>({ query, chip, selects, narrowed }: Props<R>): boolean {
  return (
    (query ?? '').trim() !== '' ||
    (chip !== '' && chip !== 'all') ||
    (selects ?? []).some((s) => s.value !== '') ||
    narrowed === true
  );
}

/** A known total under 10 draws no pager, but only while nothing filters it: unfiltered, that total is the whole list. */
function pagerShown<R>(p: Props<R>): boolean {
  return !(p.total !== undefined && isSmall(p.total) && !filteredOf(p));
}

/** What the pager says and how many pages it has: counted when the server counts the list, else only whether one follows. */
function pagerOf<R>({ rows, page, total, hasNext, words }: Props<R>): {
  pages: number;
  showing: string;
} {
  if (total === undefined)
    return { pages: hasNext ? page + 1 : page, showing: fill(words.page, { page }) };
  const from = rows.length === 0 ? 0 : (page - 1) * SIZE + 1;
  return {
    pages: Math.max(1, Math.ceil(total / SIZE)),
    showing: fill(words.showing, {
      from: indian.format(from),
      to: indian.format(Math.max(0, from + rows.length - 1)),
      total: indian.format(total),
    }),
  };
}

/**
 * A v2 table whose rows live on the server: search, filter chips and selects that ask it, sort that asks it, ten rows
 * a page. The table never holds more than the page it shows. A row opens the drawer.
 */
export function PagedTable<R>(props: Props<R>) {
  const { words, columns, rows, loading, page } = props;
  const { pages, showing } = pagerOf(props);
  return (
    <section className="v2-card v2-table-card" aria-label={words.title} aria-busy={loading}>
      <TableBar
        title={words.title}
        search={words.search}
        query={props.query ?? ''}
        onQuery={props.onQuery ?? (() => {})}
        chips={props.filters}
        chip={props.chip}
        onChip={props.onChip}
        hideSearch={props.onQuery === undefined}
      />
      {props.takeaway ? <Takeaway data={props.takeaway} /> : null}
      {props.selects?.length ? <Selects selects={props.selects} /> : null}
      {props.extra}
      <div className="v2-table-scroll">
        <table className="v2-table">
          <TableHead columns={columns} sort={props.sort} onSort={props.onSort ?? (() => {})} />
          <PageRows t={props} />
        </table>
        <div role="status">
          {loading ? <p className="v2-no-results">{words.loading}</p> : null}
          {!loading && rows.length === 0 ? (
            <p className="v2-no-results">{words.noResults}</p>
          ) : null}
        </div>
      </div>
      {pagerShown(props) ? (
        <TablePager showing={showing} page={page} pages={pages} onPage={props.onPage} />
      ) : null}
      {props.foot}
    </section>
  );
}
