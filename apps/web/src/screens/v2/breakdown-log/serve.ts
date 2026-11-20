import { dayValue, numberValue } from '../printed-page/printed.js';
import type { LogFilterId, LogQuery, LogSortKey } from './model.js';

/**
 * The engine's printed log: its header and one row per entry (the eye, Sr No, ticket, date, shift, machine, problem, done by, hours,
 * code), and `ticketIds`, the ticket behind each row in row order. The engine sorts a figure's drill ids, so those do not
 * line up with these rows and carry no meaning here; a row's ticket is the one the table printed beside it.
 */
export type PrintedLog = {
  header: string[];
  rows: string[][];
  ticketIds: string[];
  /** The entries the engine counted in the log; more than `rows` when it printed only the newest. */
  rowCount: number;
};

/** One printed entry with the id of its own ticket (null when the figure named none). */
export type LogEntry = { cells: string[]; ticketId: string | null };

/**
 * One page of the log and the counts around it: the contract of a server that pages the log. Until the server
 * serves it (`needs server: a paged log endpoint`) it is cut from the printed log here, so the screen already asks
 * and receives pages and never holds more than one.
 */
export type LogReply = {
  rows: LogEntry[];
  /** Rows that match the query. */
  matching: number;
  /** The whole log, as the engine counted it. */
  count: number;
  /** The entries the engine printed: fewer than `count` when it printed only the newest. */
  held: number;
  /** The date of the log's newest entry (its first printed row), whatever the page is sorted or filtered by. */
  newest: string | null;
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

function sorted(rows: LogEntry[], sort: NonNullable<LogQuery['sort']>) {
  const sign = sort.dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const x = orderValue(sort.key, a.cells);
    const y = orderValue(sort.key, b.cells);
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
function matches(log: PrintedLog, query: LogQuery): LogEntry[] {
  const needle = query.query.trim().toLocaleLowerCase();
  const kept = log.rows
    .map((cells, at): LogEntry => ({ cells, ticketId: log.ticketIds[at] ?? null }))
    .filter(({ cells }) =>
      (Object.keys(FILTER_COLUMN) as LogFilterId[]).every(
        (id) => query.filters[id] === '' || cell(cells, FILTER_COLUMN[id]) === query.filters[id],
      ),
    )
    .filter(
      ({ cells }) => needle === '' || cells.slice(1).join(' ').toLocaleLowerCase().includes(needle),
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
    rows: page,
    matching: ordered.length,
    count: Math.max(log.rowCount, log.rows.length),
    held: log.rows.length,
    newest: log.rows[0]?.[3] ?? null,
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
  matches(log, query).map((entry) => entry.cells);
