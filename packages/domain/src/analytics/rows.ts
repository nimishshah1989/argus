import type { EngineData, ReportRow, TicketRow } from './types.js';

/**
 * A breakdown report with the ticket that says which log it came from: a report carries no source of its own
 * (R13). This is the one seam every figure uses to tell the old log from the live app's tickets.
 */
export interface SourcedReport {
  report: ReportRow;
  ticket: TicketRow;
}

/** Every report whose ticket is in the snapshot, so its source resolves; an unlinked report has no source. */
export function sourcedReports(data: EngineData): SourcedReport[] {
  const tickets = new Map([...data.tickets, ...data.tasks].map((ticket) => [ticket.id, ticket]));
  return data.reports.flatMap((report) => {
    const ticket = report.ticketId === null ? undefined : tickets.get(report.ticketId);
    return ticket ? [{ report, ticket }] : [];
  });
}

/** Preventive maintenance is never a breakdown, whichever figure asks. */
export const isPm = (row: SourcedReport): boolean => row.report.maintCode === 'PM';

/** An entry attended outside production hours or during lunch: a breakdown with no downtime hours. */
export const isNoDowntime = (row: SourcedReport): boolean => row.report.maintCode === 'NO DT';

export const isHistory = (row: SourcedReport): boolean => row.ticket.source === 'history';

/** The machines the plant leaves out of breakdown hours; they stay in the fleet totals. */
export function excludedMachineIds(data: EngineData): ReadonlySet<string> {
  return new Set(data.settings?.excludedMachineIds ?? []);
}

/**
 * The platform's own hours for one row: recorded hours where the workbook has the column, minutes otherwise, and
 * zero for a NO-DT entry (the key's sub-label says its recorded time shows separately, not in downtime totals).
 */
export function effectiveHours(report: ReportRow): number {
  if (report.maintCode === 'NO DT') return 0;
  return report.recordedHours ?? report.downtimeMin / 60;
}

/**
 * The stable log number of each row: the workbook's own number where it has one (the platform's permanent Sr No,
 * gaps and all), else the row's place in date order, which is how the platform numbers a log it did not import.
 */
export function logNumbers(rows: readonly SourcedReport[]): number[] {
  const order = rows.map((row, index) => ({ row, index }));
  order.sort((left, right) =>
    left.row.report.date === right.row.report.date
      ? left.index - right.index
      : left.row.report.date < right.row.report.date
        ? -1
        : 1,
  );
  const numbers = new Array<number>(rows.length);
  order.forEach(({ index }, position) => {
    numbers[index] = position + 1;
  });
  rows.forEach((row, index) => {
    const recorded = row.report.srNo;
    if (recorded !== null && recorded !== undefined) numbers[index] = recorded;
  });
  return numbers;
}
