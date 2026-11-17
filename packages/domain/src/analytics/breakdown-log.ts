import { dmy } from './plant-date.js';
import {
  effectiveHours,
  isHistory,
  isNoDowntime,
  sourcedReports,
  type SourcedReport,
} from './rows.js';
import type { Computer, EngineData, FigureValue } from './types.js';

/**
 * The Breakdown Log (ticket 40, packet 40a): the plant's whole history log, PM rows included, newest first by the
 * platform's stable Sr No, each row printed as the platform printed it with an eye that drills to its ticket. The
 * analyses leave PM out; the log is the record itself, and a NO-DT entry prints a dash where they count zero hours.
 */

/** The key's own header: the eye, the log number, the ticket, the entry, the hours and the code. */
const HEADER = [
  '',
  'Sr No',
  'Ticket No.',
  'Date',
  'Shift',
  'Machine',
  'Problem',
  'Done By',
  'Downtime (Hrs)',
  'Code',
];

/** The platform's eye: the log's one drill column. */
const EYE = '👁';

/** A dash where the platform printed nothing: an empty Done By or code, and a NO-DT row's hours. */
const DASH = '—';

/**
 * The stable log number of each row: the workbook's own number where it has one (the platform's permanent Sr No,
 * gaps and all), else the row's place in date order, which is how the platform numbers a log it did not import.
 */
function logNumbers(rows: readonly SourcedReport[]): number[] {
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

/** The log's entries, newest first: every history row, PM included, the highest Sr No at the head. */
function logEntries(data: EngineData): Array<{ srNo: number; row: SourcedReport }> {
  const history = sourcedReports(data).filter(isHistory);
  const numbers = logNumbers(history);
  return history
    .map((row, index) => ({ srNo: numbers[index]!, row }))
    .sort((left, right) => right.srNo - left.srNo);
}

/** Done By as the plant printed it: the coded names behind the report, in the row's own order. */
function doneByText(row: SourcedReport, names: ReadonlyMap<string, string>): string {
  if (row.report.doneBy.length === 0) return DASH;
  return row.report.doneBy.map((code) => names.get(code) ?? code).join(', ');
}

/** The platform's own hours: the recorded number as the workbook wrote it (1.83, 4), a dash for a NO-DT entry. */
function hoursText(row: SourcedReport): string {
  return isNoDowntime(row) ? DASH : String(effectiveHours(row.report));
}

/** One display row, in the key's column order. */
function rowTexts(
  entry: { srNo: number; row: SourcedReport },
  names: ReadonlyMap<string, string>,
): string[] {
  const { report, ticket } = entry.row;
  const code =
    report.maintCode === null || report.maintCode.trim() === '' ? DASH : report.maintCode;
  return [
    EYE,
    String(entry.srNo),
    ticket.ref,
    dmy(report.date),
    report.shift,
    report.machineId,
    report.problem,
    doneByText(entry.row, names),
    hoursText(entry.row),
    code,
  ];
}

export const breakdownLogFigure: Computer = ({ data, asOf }) => {
  const entries = logEntries(data);
  if (entries.length === 0) return { value: null, drillIds: [] };
  const names = new Map(data.people.map((person) => [person.code, person.displayName]));
  const rows = entries.map((entry) => rowTexts(entry, names));
  const value = {
    screen: 'breakdown-log',
    asOf,
    pages: [
      {
        page: 'breakdowns',
        title: 'Breakdown Log',
        kpis: [],
        tables: [
          {
            title: '',
            header: HEADER,
            rows,
            // The count is the rows built, never a constant: the screen truncates what it shows, the figure does not.
            rowCount: rows.length,
            truncated: true,
          },
        ],
        charts: [],
      },
    ],
  };
  return {
    value: value as unknown as FigureValue,
    drillIds: entries.map((entry) => entry.row.ticket.id),
  };
};
