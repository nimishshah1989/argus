import type { PrintedCell, PrintedTable } from '../../../ui/v2/domain/printed-table.js';

/** The column each section is ranked by, most first. */
const WORST: Record<string, string> = {
  machine: 'Hours',
  cell: 'Hours',
  category: 'Hours',
  code: 'Hours',
  longest: 'Hours',
  team: 'Avg repair (hrs)',
  added: 'Added this period',
};

/**
 * Each section's default columns as the wireframe draws them (design/wireframes/S23-monthly-report.html): the engine's
 * own column labels, in the wireframe's order. 'Change' prints under the heading the View passes ("Against September").
 * Every other column opens in place; all of them sit under "Show the numbers".
 */
export const DEFAULT_COLUMNS: Record<string, string[]> = {
  machine: ['Machine', 'Hours', 'Change', 'Breakdowns'],
  cell: ['Cell', 'Hours', 'Change', 'Breakdowns'],
  category: ['Category', 'Hours', 'Change', 'Breakdowns'],
  code: ['Code', 'Hours', 'Change', 'Breakdowns'],
  longest: ['Date', 'Machine', 'Problem', 'Hours'],
  team: ['Name', 'Breakdowns attended', 'Hours', 'Avg repair (hrs)'],
  added: ['Category', 'Fleet at start', 'Added this period', 'Change', 'Fleet at end'],
};

/**
 * One section's table as it opens (ticket 763 follow-up): only its `DEFAULT_COLUMNS` (the first column of that label
 * when two share it), 'Change' headed `against`, and every row kept but worst first. Worst is the most Hours for the
 * rankings and the longest breakdowns, the slowest "Avg repair (hrs)" for the team, the most "Added this period" for
 * the machines added; ties keep the engine's order and the engine's "Total …" row stays last. A section with no list
 * (the blank commentary form) comes back unchanged.
 */
export function defaultTable(id: string, table: PrintedTable, against: string): PrintedTable {
  const wanted = DEFAULT_COLUMNS[id];
  if (!wanted) return table;
  const at = wanted.map((label) => table.header.findIndex((h) => h.label === label));
  if (at.includes(-1)) return table;
  const worst = table.header.findIndex((h) => h.label === WORST[id]);
  const total = (row: PrintedCell[]) => (row[0]?.text ?? '').startsWith('Total');
  const value = (row: PrintedCell[]) => Number(row[worst]?.sort) || 0;
  const body = table.rows.filter((row) => !total(row)).sort((a, b) => value(b) - value(a));
  return {
    ...table,
    header: at.map((i) => {
      const head = table.header[i]!;
      return head.label === 'Change' ? { ...head, label: against } : head;
    }),
    rows: [...body, ...table.rows.filter(total)].map((row) => at.map((i) => row[i]!)),
    // Chip filters and the measure point at the engine's column order, which no longer holds.
    chips: [],
    meaning: undefined,
  };
}
