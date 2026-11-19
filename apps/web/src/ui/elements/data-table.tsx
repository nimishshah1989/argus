/* eslint-disable i18next/no-literal-string -- prop values only; every visible string comes in through `labels` */
import { ArrowDown, ArrowUp, ChevronsUpDown } from '../icon.js';
import { Button } from '../button.js';
import { Input } from '../input.js';
import { pageSizeOf, type Column, type Sort } from './table-model.js';
import { WRAP } from './tone.js';

export interface TableLabels {
  caption: string;
  filter: string;
  previous: string;
  next: string;
  /** "Page 2 of 9". */
  page: (page: number, pages: number) => string;
  /** "51 to 100 of 1,343". */
  range: (from: number, to: number, total: number) => string;
  empty: string;
}

const SORT_STATE = { asc: 'ascending', desc: 'descending' } as const;

export interface DataTableProps<R> {
  columns: Column<R>[];
  /** The rows of the current page. */
  rows: R[];
  rowKey: (row: R) => string;
  total: number;
  /** 0-based. */
  page: number;
  pageSize: number;
  sort?: Sort;
  filter?: string;
  labels: TableLabels;
  onSort: (column: string) => void;
  onFilter?: (text: string) => void;
  onPage: (page: number) => void;
}

/**
 * A table of one page of rows. It never paints more than `MAX_PAGE_ROWS`: it is told the page, the total and the
 * sort, and asks the caller to change them (`useClientTable` for a list in memory, a server query above 200 rows).
 * Press a header to sort; type to filter; the numbers say which rows are shown.
 */
export function DataTable<R>({
  columns,
  rows,
  rowKey,
  total,
  page,
  pageSize,
  sort,
  filter,
  labels,
  onSort,
  onFilter,
  onPage,
}: DataTableProps<R>) {
  const size = pageSizeOf(pageSize);
  const shown = rows.slice(0, size);
  const pages = Math.max(1, Math.ceil(total / size));
  const from = total === 0 ? 0 : page * size + 1;
  return (
    <div className="flex min-w-0 flex-col gap-3">
      {onFilter ? (
        <FilterBox label={labels.filter} value={filter ?? ''} onChange={onFilter} />
      ) : null}
      <div
        role="region"
        aria-label={labels.caption}
        tabIndex={0}
        className="overflow-x-auto rounded-card bg-surface shadow-card"
      >
        <table className="w-full text-left text-footnote">
          <caption className="sr-only">{labels.caption}</caption>
          <thead>
            <tr className="border-b border-neutral-200">
              {columns.map((column) => (
                <HeaderCell key={column.id} column={column} sort={sort} onSort={onSort} />
              ))}
            </tr>
          </thead>
          <tbody key={`${filter ?? ''}|${sort?.column}|${sort?.dir}|${page}`} className="el-fade">
            <Rows columns={columns} rows={shown} rowKey={rowKey} />
          </tbody>
        </table>
        {shown.length === 0 ? (
          <p className="p-6 text-center text-body text-neutral-600">{labels.empty}</p>
        ) : null}
      </div>
      <Pager
        labels={labels}
        page={page}
        pages={pages}
        from={from}
        shown={shown.length}
        total={total}
        onPage={onPage}
      />
    </div>
  );
}

function FilterBox({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (text: string) => void;
}) {
  return (
    <Input
      type="search"
      aria-label={label}
      placeholder={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

function Rows<R>({
  columns,
  rows,
  rowKey,
}: {
  columns: Column<R>[];
  rows: R[];
  rowKey: (row: R) => string;
}) {
  return rows.map((row) => (
    <tr key={rowKey(row)} className="border-b border-neutral-200 last:border-b-0">
      {columns.map((column) => (
        <td
          key={column.id}
          className={`min-h-target-min p-3 align-top ${WRAP} ${column.numeric ? 'text-right tabular-nums' : ''}`}
        >
          {column.cell(row)}
        </td>
      ))}
    </tr>
  ));
}

function Pager({
  labels,
  page,
  pages,
  from,
  shown,
  total,
  onPage,
}: {
  labels: TableLabels;
  page: number;
  pages: number;
  from: number;
  shown: number;
  total: number;
  onPage: (page: number) => void;
}) {
  return (
    <nav
      aria-label={labels.caption}
      className="flex flex-wrap items-center justify-between gap-2 text-footnote"
    >
      <span aria-live="polite">{labels.range(from, from + shown - (total ? 1 : 0), total)}</span>
      <span className="flex items-center gap-2">
        <Button variant="quiet" disabled={page <= 0} onClick={() => onPage(page - 1)}>
          {labels.previous}
        </Button>
        <span className="tabular-nums">{labels.page(page + 1, pages)}</span>
        <Button variant="quiet" disabled={page >= pages - 1} onClick={() => onPage(page + 1)}>
          {labels.next}
        </Button>
      </span>
    </nav>
  );
}

function HeaderCell<R>({
  column,
  sort,
  onSort,
}: {
  column: Column<R>;
  sort?: Sort;
  onSort: (column: string) => void;
}) {
  const active = sort?.column === column.id ? sort : undefined;
  const Icon = !active ? ChevronsUpDown : active.dir === 'asc' ? ArrowUp : ArrowDown;
  return (
    <th
      scope="col"
      aria-sort={column.sortValue ? (active ? SORT_STATE[active.dir] : 'none') : undefined}
      className={`p-0 font-semibold ${column.numeric ? 'text-right' : ''}`}
    >
      {column.sortValue ? (
        <button
          type="button"
          onClick={() => onSort(column.id)}
          className={`inline-flex min-h-target-min min-w-target-min items-center gap-1 px-3 font-semibold ${column.numeric ? 'flex-row-reverse' : ''}`}
        >
          <span className={WRAP}>{column.header}</span>
          <Icon aria-hidden size={14} className="shrink-0" />
        </button>
      ) : (
        <span className="block p-3">{column.header}</span>
      )}
    </th>
  );
}
