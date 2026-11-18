import { useId, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronUp, ChevronsUpDown } from '../../ui/icon.js';

/**
 * The face's one sortable table (packet 41e-1): a client-side, stable, numeric-aware sort over the engine's own
 * cells. A4's Manpower table and its two month matrices use it, and A10 reuses it. Every header is a real button
 * with `aria-sort` on its cell, so a keyboard user sorts with Enter or Space. Sorting never rewrites a cell: the
 * rows are the engine's strings, and a dash stays a dash.
 */

export type SortDirection = 'ascending' | 'descending';
export interface TableSort {
  column: number;
  direction: SortDirection;
}

const MISSING = new Set(['', '—', '–', '-']);

/** A cell the platform printed as nothing (the matrix dash), never a zero. */
export function isMissing(cell: string): boolean {
  return MISSING.has(cell.trim());
}

/** The number a printed cell carries, or null when it is a word or a dash: grouping commas and % are read. */
export function cellNumber(cell: string): number | null {
  if (isMissing(cell)) return null;
  const cleaned = cell.trim().replaceAll(',', '').replace(/%$/, '').trim();
  if (!/^[-+]?\d+(?:\.\d+)?$/.test(cleaned)) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

/** Numbers compare as numbers, words with localeCompare's numeric collation, and a dash always sorts last. */
export function compareCells(left: string, right: string): number {
  if (isMissing(left) || isMissing(right))
    return isMissing(left) === isMissing(right) ? 0 : isMissing(left) ? 1 : -1;
  const a = cellNumber(left);
  const b = cellNumber(right);
  if (a !== null && b !== null) return a === b ? 0 : a < b ? -1 : 1;
  return left.localeCompare(right, undefined, { numeric: true });
}

/** Ascending then descending on the same column; another column starts ascending. */
export function nextSort(sort: TableSort | null, column: number): TableSort {
  return sort?.column === column
    ? { column, direction: sort.direction === 'ascending' ? 'descending' : 'ascending' }
    : { column, direction: 'ascending' };
}

/** A stable copy of the rows in the sort's order: equal rows keep the engine's order in both directions. */
export function sortRows(
  rows: readonly (readonly string[])[],
  sort: TableSort | null,
): readonly (readonly string[])[] {
  if (sort === null) return rows;
  const sign = sort.direction === 'ascending' ? 1 : -1;
  return [...rows].sort((left, right) => {
    const a = left[sort.column] ?? '';
    const b = right[sort.column] ?? '';
    if (isMissing(a) || isMissing(b))
      return isMissing(a) === isMissing(b) ? 0 : isMissing(a) ? 1 : -1;
    return sign * compareCells(a, b);
  });
}

const ICON = { ascending: ChevronUp, descending: ChevronDown, none: ChevronsUpDown };

/** One header: its word, the sort arrow and the cell's `aria-sort`, with the button that changes it. */
function HeaderCell({
  label,
  direction,
  onSort,
}: {
  label: string;
  direction: SortDirection | undefined;
  onSort: () => void;
}) {
  const state = direction ?? 'none';
  const Icon = ICON[state];
  return (
    <th scope="col" aria-sort={state} className="p-2 font-medium text-neutral-600">
      <button
        type="button"
        onClick={onSort}
        className="-m-1 inline-flex min-h-target-min items-center gap-1 whitespace-nowrap rounded-lg p-1 font-medium"
      >
        {label}
        <Icon aria-hidden size={14} />
      </button>
    </th>
  );
}

/** One sortable table: the engine's title, header and rows, with its sort held here as client state. */
export function SortTable({
  title,
  header,
  rows,
  renderCell,
}: {
  title?: string | null;
  header: readonly string[];
  rows: readonly (readonly string[])[];
  /** A screen's own markup for one cell; it still sorts by the engine's raw cell and keeps its row's index. */
  renderCell?: (cell: string, column: number, rowIndex: number) => ReactNode;
}) {
  const headingId = useId();
  const [sort, setSort] = useState<TableSort | null>(null);
  const shown = sortRows(rows, sort);
  // sortRows keeps the array identities, so a sorted row still finds the index the engine gave it.
  const originalIndex = new Map(rows.map((row, index) => [row, index] as const));
  return (
    <div className="flex flex-col gap-2">
      {title ? (
        <h3 id={headingId} className="text-body font-semibold">
          {title}
        </h3>
      ) : null}
      <div className="overflow-x-auto rounded-2xl bg-surface shadow-card">
        <table
          aria-labelledby={title ? headingId : undefined}
          aria-label={title ? undefined : header.join(' · ')}
          className="w-full text-left text-footnote"
        >
          <thead>
            <tr>
              {header.map((cell, column) => (
                <HeaderCell
                  key={`${cell}-${column}`}
                  label={cell}
                  direction={sort?.column === column ? sort.direction : undefined}
                  onSort={() => setSort(nextSort(sort, column))}
                />
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((row, rowIndex) => {
              const original = originalIndex.get(row) ?? rowIndex;
              return (
                <tr key={`${original}-${rowIndex}`} className="border-t border-neutral-200">
                  {row.map((cell, column) => (
                    <td key={column} className="p-2">
                      {renderCell ? renderCell(cell, column, original) : cell}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
