import { dmy } from './plant-date.js';
import {
  effectiveHours,
  isHistory,
  isNoDowntime,
  logNumbers,
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

/**
 * Bhavin's bands for a stop's length (11 Nov platform, `renderBreakdownTable`: `dt>4 ? red : dt>1 ? amber : green`):
 * over 4 hours a long stop, over 1 hour one to watch. Strict, so exactly 4 is "watch" and exactly 1 is neither.
 */
export const LONG_STOP_HOURS = 4;
export const WATCH_STOP_HOURS = 1;
export type StopSeverity = 'long' | 'watch' | '';
export function severityOf(hours: number): StopSeverity {
  if (!Number.isFinite(hours)) return '';
  return hours > LONG_STOP_HOURS ? 'long' : hours > WATCH_STOP_HOURS ? 'watch' : '';
}

/** The coded names a row lists as people, in its own order; empty when it names nobody. */
function peopleText(codes: readonly string[], names: ReadonlyMap<string, string>): string {
  return codes.map((code) => names.get(code) ?? code).join(', ');
}

/** One display row, in the key's column order. */
function rowTexts(
  entry: { srNo: number; row: SourcedReport },
  names: ReadonlyMap<string, string>,
  machines: ReadonlyMap<string, string>,
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
    machines.get(report.machineId) ?? report.machineId,
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
  const codes = new Map(data.machines.map((machine) => [machine.id, machine.code]));
  const rows = entries.map((entry) => rowTexts(entry, names, codes));
  const described = (data.lists.maint_code ?? []).filter(({ label }) => label.trim() !== '');
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
            // The eye's own ticket, row for row: the engine sorts the drill ids, so a screen must not pair by position.
            rowTicketIds: entries.map((entry) => entry.row.ticket.id),
            // The count is the rows built, never a constant: the screen truncates what it shows, the figure does not.
            rowCount: rows.length,
            truncated: true,
          },
        ],
        charts: [],
      },
    ],
    // What the log shows in a row's detail and a code's tooltip, beside the key's own page (which stays as printed):
    // `rows` pairs with the table's rows one for one (supporters, type, how long a stop it was), `codes` is the
    // plant's maintenance-code list with descriptions.
    extra: {
      rows: entries.map((entry) => ({
        supportedBy: peopleText(entry.row.report.supportedBy, names),
        type: entry.row.report.category?.trim() ?? '',
        severity: severityOf(effectiveHours(entry.row.report)),
      })),
      codes: described.map(({ code, label }) => ({ code, label })),
    },
  };
  return {
    value: value as unknown as FigureValue,
    drillIds: entries.map((entry) => entry.row.ticket.id),
  };
};
