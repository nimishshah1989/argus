import type { ClassifiedRow } from './legacy-classify.js';

/**
 * Legacy workbooks: the review tray (ticket 623). Every row the converter holds back for a person at Cosmos to
 * look at, as a pointer into the workbook (year, machine sheet, Excel row) and the reason. No cell content ever:
 * the tray sits beside the export files, outside git, and is handed to Bhavin.
 */
export type TrayReason = 'bad_date' | 'stray_year';

export interface TrayRow {
  /** The workbook's year (where the row is found), not the year of its date. */
  year: number;
  machine: string;
  excelRow: number;
  reason: TrayReason;
}

export const TRAY_HEADER = 'year,machine,excel_row,reason';

/** The held rows (`bad_date`, `stray_year`), sorted by year, machine, Excel row. */
export function trayOf(rows: readonly ClassifiedRow[]): TrayRow[] {
  return rows
    .flatMap(({ row, machine, cls }) =>
      cls === 'bad_date' || cls === 'stray_year'
        ? [{ year: row.year, machine, excelRow: row.excelRow, reason: cls }]
        : [],
    )
    .sort((a, b) => a.year - b.year || a.machine.localeCompare(b.machine) || a.excelRow - b.excelRow);
}

/** `TRAY_HEADER`, then one line per row; every line ends with a newline. */
export function trayCsv(rows: readonly TrayRow[]): string {
  return [TRAY_HEADER, ...rows.map((t) => `${t.year},${t.machine},${t.excelRow},${t.reason}`)]
    .map((line) => `${line}\n`)
    .join('');
}
