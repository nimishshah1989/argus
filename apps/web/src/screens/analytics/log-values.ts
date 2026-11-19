import type { MessageKey } from '@uptimo/shared/i18n';
import { dayKey, toCsv } from './machine-values.js';

/**
 * The Breakdown Log's filters and export (packet 40e-1). Pure: the columns are the platform's own order in the
 * figure's table, and every value offered is one the engine printed. Filtering keeps each row's original index so
 * a row still opens its own ticket after the table narrows.
 */

export interface LogFilters {
  date: string;
  shift: string;
  machine: string;
  code: string;
}

export const EMPTY_FILTERS: LogFilters = { date: '', shift: '', machine: '', code: '' };

export interface LogFilter {
  id: keyof LogFilters;
  /** The column in the figure's header, which is data: ['', 'Sr No', 'Ticket No.', 'Date', ...]. */
  column: number;
  labelKey: MessageKey;
}

export const LOG_FILTERS: readonly LogFilter[] = [
  { id: 'date', column: 3, labelKey: 'analytics.log.filter.date' },
  { id: 'shift', column: 4, labelKey: 'analytics.log.filter.shift' },
  { id: 'machine', column: 5, labelKey: 'analytics.log.filter.machine' },
  { id: 'code', column: 9, labelKey: 'analytics.log.filter.code' },
];

export const DATE_COLUMN = 3;

export { dayKey } from './machine-values.js';

/** The distinct values a filter may pick from, dates newest first and the rest alphabetically. */
export function filterOptions(rows: readonly (readonly string[])[], column: number): string[] {
  const values = [...new Set(rows.map((row) => row[column] ?? '').filter((value) => value !== ''))];
  return values.sort((left, right) =>
    column === DATE_COLUMN ? dayKey(right).localeCompare(dayKey(left)) : left.localeCompare(right),
  );
}

/** The rows that match every chosen filter, each with its original index for the ticket drill. */
export function filterRows(
  rows: readonly (readonly string[])[],
  filters: LogFilters,
): Array<{ row: readonly string[]; index: number }> {
  return rows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) =>
      LOG_FILTERS.every(({ id, column }) => filters[id] === '' || row[column] === filters[id]),
    );
}

/** The table as the client-export pattern writes it: the data columns, the eye drill column left out. */
export function logCsv(header: readonly string[], rows: readonly (readonly string[])[]): string {
  return toCsv([header.slice(1), ...rows.map((row) => row.slice(1))]);
}
