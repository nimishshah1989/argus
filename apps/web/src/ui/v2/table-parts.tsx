/* eslint-disable i18next/no-literal-string -- icon names and typed unions only; every visible word comes in as a prop or t() */
import { useTranslation } from 'react-i18next';
import { Icon } from './icons.js';
import type { SortDir } from './table-model.js';

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

/** The table's title, its search and its filter chips (one chosen at a time). */
export function TableBar({
  title,
  search,
  query,
  onQuery,
  chips,
  chip,
  onChip,
}: {
  title: string;
  search: string;
  query: string;
  onQuery: (query: string) => void;
  chips: { key: string; label: string }[];
  chip: string;
  onChip: (key: string) => void;
}) {
  return (
    <div className="v2-table-bar">
      <h2 className="v2-h2">{title}</h2>
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
