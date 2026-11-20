import { dayValue, numberValue } from '../printed-page/printed.js';
import type { LogFilterId, LogQuery, LogSortKey } from './model.js';

/**
 * The engine's printed log: its header and one row per entry (the eye, Sr No, ticket, date, shift, machine, problem, done by, hours,
 * code). The engine sorts a figure's drill ids, so they do not line up with these rows and carry no meaning here.
 */
export type PrintedLog = { header: string[]; rows: string[][] };

/**
 * One page of the log and the counts around it: the contract of a server that pages the log. Until the server
 * serves it (`needs server: a paged log endpoint`) it is cut from the printed log here, so the screen already asks
 * and receives pages and never holds more than one.
 */
export type LogReply = {
  rows: string[][];
  /** Rows that match the query. */
  matching: number;
  /** The whole log. */
  count: number;
  options: Record<LogFilterId, string[]>;
};

export const PAGE_SIZE = 10;
const COLUMN: Record<LogSortKey, number> = {
  srNo: 1,
  ticket: 2,
  date: 3,
  shift: 4,
  machine: 5,
  problem: 6,
  doneBy: 7,
  hours: 8,
  code: 9,
};
const FILTER_COLUMN: Record<LogFilterId, number> = { date: 3, shift: 4, machine: 5, code: 9 };
const DASH = '—';

const cell = (row: string[], at: number) => row[at] ?? '';

function orderValue(key: LogSortKey, row: string[]): number | string {
  const text = cell(row, COLUMN[key]);
  if (key === 'date') return dayValue(text);
  if (key === 'srNo' || key === 'hours') return text === DASH ? Number.NaN : numberValue(text);
  return text;
}

/** The distinct printed values of a column: dates newest first, the rest alphabetical. */
function optionsOf(rows: string[][], id: LogFilterId): string[] {
  const values = [
    ...new Set(rows.map((row) => cell(row, FILTER_COLUMN[id])).filter((v) => v !== '')),
  ];
  return id === 'date'
    ? values.sort((a, b) => dayValue(b) - dayValue(a))
    : values.sort((a, b) => a.localeCompare(b));
}

function sorted(rows: { row: string[] }[], sort: NonNullable<LogQuery['sort']>) {
  const sign = sort.dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const x = orderValue(sort.key, a.row);
    const y = orderValue(sort.key, b.row);
    // A dash means nothing was recorded: it sorts last whichever way.
    if (typeof x === 'number' && Number.isNaN(x))
      return typeof y === 'number' && Number.isNaN(y) ? 0 : 1;
    if (typeof y === 'number' && Number.isNaN(y)) return -1;
    return (
      sign *
      (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y)))
    );
  });
}

/** Every entry that matches the query, in the order asked. */
function matches(log: PrintedLog, query: LogQuery): { row: string[] }[] {
  const needle = query.query.trim().toLocaleLowerCase();
  const kept = log.rows
    .map((row) => ({ row }))
    .filter(({ row }) =>
      (Object.keys(FILTER_COLUMN) as LogFilterId[]).every(
        (id) => query.filters[id] === '' || cell(row, FILTER_COLUMN[id]) === query.filters[id],
      ),
    )
    .filter(
      ({ row }) => needle === '' || row.slice(1).join(' ').toLocaleLowerCase().includes(needle),
    );
  return query.sort ? sorted(kept, query.sort) : kept;
}

/** The page the query asks for, with the counts and the values each filter may take. */
export function cutPage(log: PrintedLog, query: LogQuery): LogReply {
  const ordered = matches(log, query);
  const pages = Math.max(1, Math.ceil(ordered.length / PAGE_SIZE));
  const start = (Math.min(Math.max(1, query.page), pages) - 1) * PAGE_SIZE;
  const page = ordered.slice(start, start + PAGE_SIZE);
  return {
    rows: page.map((entry) => entry.row),
    matching: ordered.length,
    count: log.rows.length,
    options: {
      date: optionsOf(log.rows, 'date'),
      shift: optionsOf(log.rows, 'shift'),
      machine: optionsOf(log.rows, 'machine'),
      code: optionsOf(log.rows, 'code'),
    },
  };
}

/** Every row that matches the query, for the export: the whole narrowed log, in the order asked. */
export const everyMatch = (log: PrintedLog, query: LogQuery): string[][] =>
  matches(log, query).map((entry) => entry.row);
