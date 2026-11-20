/* eslint-disable i18next/no-literal-string -- icon names and typed unions only; every visible word comes in as a prop or t() */
import type { ReactNode } from 'react';
import { fill } from '../../i18n/fill.js';
import type { Column, FilterChip, TableWords } from './data-table.js';
import { Icon } from './icons.js';
import { TableBar, TableHead, TablePager, type SortState } from './table-parts.js';

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
  onChange: (value: string) => void;
};

type Props<R> = {
  /** The one page the server sent: never more than 10 rows are held, so never more are drawn. */
  rows: R[];
  rowKey: (row: R) => string;
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
  /** 1-based. `total` known: "1–10 of 1,343". Unknown: only whether another page follows (`hasNext`). */
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
};

const SIZE = 10;
const indian = new Intl.NumberFormat('en-IN');

/** The page's rows; each opens the drawer, by a click anywhere on it or by its action button. */
function PageRows<R>({ t }: { t: Props<R> }) {
  return (
    <tbody>
      {t.rows.map((row) => {
        const key = t.rowKey(row);
        return (
          <tr key={key} data-selected={key === t.selected} onClick={() => t.onOpen(row)}>
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

function Selects({ selects }: { selects: SelectFilter[] }) {
  return (
    <div className="v2-table-selects">
      {selects.map((s) => (
        <label key={s.key} className="v2-select-field">
          {s.label}
          <select aria-label={s.label} value={s.value} onChange={(e) => s.onChange(e.target.value)}>
            <option value="">{s.all}</option>
            {s.options.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </label>
      ))}
    </div>
  );
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
      <TablePager showing={showing} page={page} pages={pages} onPage={props.onPage} />
      {props.foot}
    </section>
  );
}
