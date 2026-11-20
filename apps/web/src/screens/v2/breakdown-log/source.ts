import i18n from 'i18next';
import input from '../../../../../../fixtures/answer-key/input.json' with { type: 'json' };
import { keyReply } from '../printed-page/key-reply.js';
import type { FiguresPart } from '../printed-page/printed.js';
import { logFromFigures } from './live.js';
import type { LogQuery } from './model.js';

/** One row of the 11 November workbook, as `fixtures/answer-key/input.json` keeps it (the fields the log prints). */
type WorkbookRow = {
  id: string;
  machineId: string;
  date: string;
  shift: string;
  problem: string;
  doneBy?: string;
  downMin?: number;
  downHrs?: number;
  maintCode?: string;
  ticketId?: string;
  ticketRef?: string;
  srNo?: number;
};

const EYE = '\u{1F441}';
const DASH = '—';

/** A row as the platform prints it in the log: the engine's own columns, in its own order. */
export function printedEntry(row: WorkbookRow, srNo: number): string[] {
  const noDowntime = row.maintCode === 'NO DT';
  const hours = row.downHrs ?? (row.downMin ?? 0) / 60;
  return [
    EYE,
    String(srNo),
    row.ticketRef ?? row.id,
    row.date,
    row.shift,
    row.machineId,
    row.problem,
    row.doneBy?.trim() ? row.doneBy : DASH,
    noDowntime ? DASH : String(hours),
    row.maintCode?.trim() ? row.maintCode : DASH,
  ];
}

/**
 * The log the engine prints for the 11 November workbook, newest first by the platform's Sr No: the gallery's stand-in
 * for `GET /analytics/figures`, so the screen runs on a real plant's thirteen hundred rows. A test holds it equal to the
 * engine's own output.
 */
export function workbookFigures(rows: readonly WorkbookRow[]): FiguresPart {
  const entries = rows
    .filter((row) => row.srNo !== undefined)
    .map((row) => ({ row, srNo: row.srNo as number }))
    .sort((a, b) => b.srNo - a.srNo);
  const value = {
    screen: 'breakdown-log',
    asOf: '2026-11-11',
    pages: [
      {
        page: 'breakdowns',
        title: 'Breakdown Log',
        kpis: [],
        tables: [
          {
            title: '',
            header: [
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
            ],
            rows: entries.map((e) => printedEntry(e.row, e.srNo)),
            rowCount: entries.length,
            truncated: true,
          },
        ],
        charts: [],
      },
    ],
  };
  const reply = keyReply('breakdown-log', 40, value);
  const [figure] = reply.figures;
  return {
    ...reply,
    figures: figure
      ? [
          {
            ...figure,
            drill: {
              type: 'ticket',
              ids: [...new Set(entries.map((e) => e.row.ticketId ?? e.row.id))].sort(),
            },
          },
        ]
      : [],
  };
}

const figures = workbookFigures(input.breakdowns as WorkbookRow[]);

/** The gallery's Breakdown Log for one query: the live adapter over the workbook's log. */
export const logFromWorkbook = (query: LogQuery) =>
  Promise.resolve(logFromFigures(figures, query, i18n.t.bind(i18n)));

/** Every row that matches the query, as the engine printed it (for the export). */
export { everyMatchOf } from './live.js';
export { figures as workbookLog };
