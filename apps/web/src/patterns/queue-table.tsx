import { useState, type ReactNode } from 'react';
import { ChevronDown, ChevronUp, ChevronsUpDown } from '../ui/icon.js';

export interface QueueColumn<Row> {
  /** Translated. */
  label: string;
  cell: (row: Row) => ReactNode;
  /** Makes the column sortable; sorts the rows loaded so far. */
  sortKey?: (row: Row) => SortValue;
}

export type SortValue = string | number | Date;
type Direction = 'ascending' | 'descending';
export interface Sort {
  column: number;
  direction: Direction;
}

function compare(x: SortValue, y: SortValue): number {
  if (typeof x === 'string' || typeof y === 'string')
    return String(x).localeCompare(String(y), undefined, { numeric: true });
  const [a, b] = [Number(x), Number(y)];
  return Number(a > b) - Number(a < b);
}

/** Sorts a copy; equal rows keep their order in both directions. */
export function sorted<Row>(rows: Row[], columns: QueueColumn<Row>[], sort: Sort | null): Row[] {
  const key = sort ? columns[sort.column]?.sortKey : undefined;
  if (!sort || !key) return rows;
  const sign = sort.direction === 'ascending' ? 1 : -1;
  return [...rows].sort((a, b) => sign * compare(key(a), key(b)));
}

const SORT_ICON = { ascending: ChevronUp, descending: ChevronDown, none: ChevronsUpDown };

function HeaderCell<Row>(p: {
  column: QueueColumn<Row>;
  direction: Direction | undefined;
  onSort: () => void;
}) {
  const { column, direction } = p;
  const Icon = SORT_ICON[direction ?? 'none'];
  return (
    <th
      scope="col"
      aria-sort={column.sortKey ? (direction ?? 'none') : undefined}
      className="border-b border-neutral-200 p-3 text-caption font-semibold text-neutral-600"
    >
      {column.sortKey ? (
        <button
          type="button"
          onClick={p.onSort}
          className="-m-1 inline-flex items-center gap-1 rounded-lg p-1 font-semibold"
        >
          {column.label}
          <Icon aria-hidden size={14} />
        </button>
      ) : (
        column.label
      )}
    </th>
  );
}

/** The desktop queue: one table, sortable where a column gives a `sortKey`; the first column is the row header. */
export function QueueTable<Row>({
  title,
  rows,
  columns,
  rowKey,
}: {
  /** Translated; names the table for screen readers. */
  title: string;
  rows: Row[];
  columns: QueueColumn<Row>[];
  rowKey: (row: Row) => string;
}) {
  const [sort, setSort] = useState<Sort | null>(null);
  const click = (column: number) =>
    setSort({
      column,
      direction:
        sort?.column === column && sort.direction === 'ascending' ? 'descending' : 'ascending',
    });
  return (
    <div className="overflow-x-auto rounded-2xl bg-surface shadow-card">
      <table aria-label={title} className="w-full text-left text-footnote">
        <thead>
          <tr>
            {columns.map((column, index) => (
              <HeaderCell
                key={index}
                column={column}
                direction={sort?.column === index ? sort.direction : undefined}
                onSort={() => click(index)}
              />
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted(rows, columns, sort).map((row) => (
            <tr key={rowKey(row)} className="h-13 border-b border-neutral-200 last:border-b-0">
              {columns.map((column, index) =>
                index === 0 ? (
                  <th key={index} scope="row" className="px-3 py-2 font-medium">
                    {column.cell(row)}
                  </th>
                ) : (
                  <td key={index} className="px-3 py-2">
                    {column.cell(row)}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
