import type { Column, TableWords } from './data-table.js';
import type { TableModel } from './domain/engine-table.js';

/** Ten machines' breakdown hours against a 20 h target (high is worse): three miss it. Shared by the ticket 620 tests. */
export type Hours = { name: string; hours: number };
export const HOURS: Hours[] = [5, 40, 12, 30, 8, 3, 25, 1, 2, 4].map((hours, at) => ({
  name: `M-${String(at + 1).padStart(2, '0')}`,
  hours,
}));

export const WORDS: TableWords = {
  title: 'Breakdown hours',
  search: 'Search machines',
  showing: '{from}–{to} of {total}',
  noResults: 'No machines',
  open: 'Open',
};

export const nameColumn: Column<Hours> = {
  key: 'name',
  label: 'Machine',
  sortBy: (r) => r.name,
  cell: (r) => r.name,
};

export const hoursColumn = (meaning: boolean): Column<Hours> => ({
  key: 'hours',
  label: 'Hours',
  numeric: true,
  sortBy: (r) => r.hours,
  cell: (r) => `${r.hours.toFixed(1)} h`,
  ...(meaning
    ? {
        meaning: {
          worse: 'high',
          target: { value: 20, shown: '20.0 h' },
          value: (r: Hours) => r.hours,
        },
      }
    : {}),
});

export const engineModel = (rows: Hours[] = HOURS): TableModel => ({
  id: 'hours',
  title: 'Breakdown hours',
  header: [
    { label: 'Machine', numeric: false },
    { label: 'Hours', numeric: true },
  ],
  rows: rows.map((r) => [
    { text: r.name, sort: r.name },
    { text: `${r.hours.toFixed(1)} h`, sort: r.hours },
  ]),
  chips: [],
  words: { ...WORDS, all: 'All' },
  meaning: { column: 1, worse: 'high', target: { value: 20, shown: '20.0 h' } },
});
