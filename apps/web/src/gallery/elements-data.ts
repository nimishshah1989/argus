import { formatFigure, type Measure } from '../ui/meaning/index.js';
import type { Column, TableLabels } from '../ui/elements/index.js';

/** Worst case for the break-ui check: 40 Gujarati letters and a 7-digit number. */
export const LONG_LABEL = 'ક'.repeat(40);

export const DOWN_IS_GOOD: Measure = { unit: 'hours', better: 'down' };
export const UP_IS_GOOD: Measure = { unit: 'percent', better: 'up' };

export const PERIODS = [
  { id: 'today', label: 'Today' },
  { id: 'd7', label: '7 days' },
  { id: 'd30', label: '30 days' },
  { id: 'year', label: 'Year' },
];

export const CAUSES = ['Wear', 'Heat', 'Oil', 'Dust', 'Belt'];

export const NAV_GROUPS = [
  {
    id: 'plant',
    heading: 'Plant',
    items: [
      { to: '/gallery', label: 'Today' },
      { to: '/gallery?x=1', label: 'This month' },
    ],
  },
  { id: 'machines', heading: 'Machines', items: [{ to: '/gallery?x=2', label: 'Breakdowns' }] },
];

export interface LogRow {
  id: number;
  machine: string;
  hours: number;
}

/** The Breakdown Log's size today: 1,343 rows. */
export const LOG_ROWS: LogRow[] = Array.from({ length: 1343 }, (_, id) => ({
  id,
  machine: `Machine ${id + 1}`,
  hours: ((id * 37) % 90) / 10,
}));

export const LOG_COLUMNS: Column<LogRow>[] = [
  { id: 'machine', header: 'Machine', cell: (r) => r.machine, sortValue: (r) => r.machine },
  {
    id: 'hours',
    header: 'Hours',
    cell: (r) => r.hours.toFixed(1),
    sortValue: (r) => r.hours,
    numeric: true,
  },
];

export const logText = (row: LogRow): string => row.machine;

export const TABLE_LABELS: TableLabels = {
  caption: 'Breakdown log',
  filter: 'Filter machines',
  previous: 'Previous',
  next: 'Next',
  page: (page, pages) => `Page ${page} of ${pages}`,
  range: (from, to, total) => `${from} to ${to} of ${total.toLocaleString('en-IN')}`,
  empty: 'No rows match',
};

const HOURS: Measure = { unit: 'hours', better: 'down' };
const PERCENT: Measure = { unit: 'percent', better: 'up' };
const MONEY: Measure = { unit: 'money', better: 'neither' };
export const hours = (n: number): string => formatFigure(HOURS, n);
export const percent = (n: number): string => formatFigure(PERCENT, n);
export const money = (n: number): string => formatFigure(MONEY, n);
