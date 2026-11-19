import { useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import {
  DataTable,
  tableView,
  type Column,
  type Sort,
  type TableLabels,
} from '../../ui/elements/index.js';
import { numberOf, numericColumns, type EngineRow } from './engine-table-model.js';
import './register-parts.css';

const whole = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

/** The next sort when a header is pressed: ascending, then descending, then back to the engine's own order. */
const nextSort = (current: Sort | undefined, column: string): Sort | undefined =>
  current?.column !== column
    ? { column, dir: 'asc' }
    : current.dir === 'asc'
      ? { column, dir: 'desc' }
      : undefined;

export interface EngineTableProps {
  /** Names the table for a screen reader and its pager. */
  caption: string;
  /** A visible heading over the table; absent when the screen's own heading already names it. */
  title?: string | null;
  header: readonly string[];
  rows: readonly EngineRow[];
  /** At most 50: a table never paints more rows than this at once. */
  pageSize?: number;
  /** Prints a cell another way (a link); the cell's own text is the engine's. */
  renderCell?: (cell: string, index: number, column: number) => ReactNode;
  /** What a column sorts by, for one that is not a plain number or text (a date). */
  sortKey?: (column: number, cell: string) => number | string | undefined;
  /** Columns a header press does not sort (a column of links). */
  unsortable?: ReadonlySet<number>;
  /** Pages return to the first when this changes (a filter above the table). */
  resetKey?: string;
  /** A search box over the whole table, for a long one. */
  searchable?: boolean;
}

/** The columns of a table of printed cells: right-aligned and sorted as numbers when every cell is a number. */
function columnsOf(props: EngineTableProps, numeric: ReadonlySet<number>): Column<EngineRow>[] {
  const { header, renderCell, sortKey, unsortable } = props;
  return header.map((label, column) => ({
    id: `c${column}`,
    header: label,
    numeric: numeric.has(column),
    sortValue: unsortable?.has(column)
      ? undefined
      : (item) => {
          const cell = item.row[column] ?? '';
          return sortKey?.(column, cell) ?? (numeric.has(column) ? numberOf(cell) : cell);
        },
    cell: (item) => {
      const cell = item.row[column] ?? '';
      return renderCell ? renderCell(cell, item.index, column) : cell;
    },
  }));
}

/** The pager's and the search box's words, from the catalogue; numbers print with Indian grouping. */
function labelsOf(caption: string, t: TFunction): TableLabels {
  return {
    caption,
    filter: t('analytics.table.filter'),
    previous: t('analytics.table.previous'),
    next: t('analytics.table.next'),
    page: (current, pages) =>
      t('analytics.table.page', { page: whole.format(current), pages: whole.format(pages) }),
    range: (from, to, total) =>
      t('analytics.table.range', {
        from: whole.format(from),
        to: whole.format(to),
        total: whole.format(total),
      }),
    empty: t('analytics.table.empty'),
  };
}

/**
 * The engine's printed table, one page at a time: the page, the sort and the search are held here and only the page's
 * rows are painted (`DataTable` paints at most 50). Used for the Breakdown Log, the registers and the machine's lists.
 */
export function EngineTable(props: EngineTableProps) {
  const { t } = useTranslation();
  const { rows, header, caption, title, pageSize = 25, resetKey = '' } = props;
  const [sort, setSort] = useState<Sort>();
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(0);
  const [seen, setSeen] = useState(resetKey);
  if (seen !== resetKey) {
    setSeen(resetKey);
    setPage(0);
  }
  const numeric = useMemo(() => numericColumns(rows, header.length), [rows, header.length]);
  const columns = columnsOf(props, numeric);
  const view = tableView(rows as EngineRow[], columns, { sort, filter, page, pageSize }, (item) =>
    item.row.join(' '),
  );
  const table = (
    <DataTable
      columns={columns}
      rows={view.rows}
      rowKey={(item) => String(item.index)}
      total={view.total}
      page={view.page}
      pageSize={pageSize}
      sort={sort}
      filter={filter}
      onSort={(column) => {
        setSort(nextSort(sort, column));
        setPage(0);
      }}
      onFilter={
        props.searchable
          ? (text) => {
              setFilter(text);
              setPage(0);
            }
          : undefined
      }
      onPage={setPage}
      labels={labelsOf(caption, t)}
    />
  );
  if (!title) return table;
  return (
    <div>
      <h3 className="rg-title">{title}</h3>
      {table}
    </div>
  );
}
