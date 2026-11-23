import { dayValue, numberValue } from '../printed-page/printed.js';
import type { LogFilterId, LogQuery, LogSortKey } from './model.js';

/** What a row carries beside its printed cells: who supported the job and its type (E, M, E/M), as the engine sent them. */
export type LogDetail = { supportedBy: string; type: string; severity: 'long' | 'watch' | '' };
export const NO_DETAIL: LogDetail = { supportedBy: '', type: '', severity: '' };

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
  /** One per row, in row order; empty when the reply carries none (a saved copy from before the engine sent them). */
  detail: LogDetail[];
  /** The plant's maintenance codes with their descriptions, as the engine sent them. */
  codes: { code: string; label: string }[];
};

/** One printed entry with the id of its own ticket (null when the figure named none) and its detail. */
export type LogEntry = { cells: string[]; ticketId: string | null; detail: LogDetail };

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
  options: Record<LogFilterId, string[]>;
  /** The plant's maintenance codes with their descriptions, for the badge's tooltip and the Code filter. */
  codes: { code: string; label: string }[];
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
const FILTER_COLUMN = { date: 3, shift: 4, machine: 5, code: 9 } as const;
type ColumnFilter = keyof typeof FILTER_COLUMN;
const COLUMN_FILTERS = Object.keys(FILTER_COLUMN) as ColumnFilter[];
const DASH = '—';

/** `07-01-2026` or `2026-01-07` as `2026-01`: the month a printed date falls in, with its year; '' when it is not a date. */
export function monthOf(printed: string): string {
  const day = String(dayValue(printed));
  return day === '0' ? '' : `${day.slice(0, 4)}-${day.slice(4, 6)}`;
}

/** The names a printed Done By or Supported By lists, trimmed; a dash names nobody. */
export function namesIn(printed: string): string[] {
  return printed
    .split(',')
    .map((name) => name.trim())
    .filter((name) => name !== '' && name !== DASH && name !== '-');
}

/** A person a row names as Done By or as Supported By: whole names only, as Bhavin's 11 Nov filter matches them. */
const involves = (entry: LogEntry, person: string): boolean =>
  namesIn(cell(entry.cells, COLUMN.doneBy)).includes(person) ||
  namesIn(entry.detail.supportedBy).includes(person);

const cell = (row: string[], at: number) => row[at] ?? '';

function orderValue(key: LogSortKey, row: string[]): number | string {
  const text = cell(row, COLUMN[key]);
  if (key === 'date') return dayValue(text);
  if (key === 'srNo' || key === 'hours') return text === DASH ? Number.NaN : numberValue(text);
  return text;
}

/** The distinct printed values of a column: dates newest first, the rest alphabetical. */
function optionsOf(rows: string[][], id: ColumnFilter): string[] {
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
  const { filters } = query;
  const kept = log.rows
    .map((cells, at): LogEntry => ({
      cells,
      ticketId: log.ticketIds[at] ?? null,
      detail: log.detail[at] ?? NO_DETAIL,
    }))
    .filter(
      (entry) =>
        COLUMN_FILTERS.every(
          (id) => filters[id] === '' || cell(entry.cells, FILTER_COLUMN[id]) === filters[id],
        ) &&
        (filters.month === '' ||
          monthOf(cell(entry.cells, FILTER_COLUMN.date)) === filters.month) &&
        (filters.person === '' || involves(entry, filters.person)),
    )
    .filter(
      ({ cells, detail }) =>
        needle === '' ||
        [...cells.slice(1), detail.supportedBy].join(' ').toLocaleLowerCase().includes(needle),
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
    options: {
      date: optionsOf(log.rows, 'date'),
      month: [
        ...new Set(
          optionsOf(log.rows, 'date')
            .map(monthOf)
            .filter((m) => m !== ''),
        ),
      ],
      shift: optionsOf(log.rows, 'shift'),
      machine: optionsOf(log.rows, 'machine'),
      code: optionsOf(log.rows, 'code'),
      person: peopleOf(log),
    },
    codes: log.codes,
  };
}

/** Everyone the log names as doing or supporting a job, alphabetical: the Team member filter's choices. */
function peopleOf(log: PrintedLog): string[] {
  const names = new Set([
    ...log.rows.flatMap((row) => namesIn(cell(row, COLUMN.doneBy))),
    ...log.detail.flatMap((d) => namesIn(d.supportedBy)),
  ]);
  return [...names].sort((a, b) => a.localeCompare(b));
}

/**
 * Every row that matches the query, for the export: the whole narrowed log, in the order asked. Supported By is the
 * last column, so a row listed because of the person chosen in the Team member filter shows why.
 */
export const everyMatch = (log: PrintedLog, query: LogQuery): string[][] =>
  matches(log, query).map((entry) => [...entry.cells, entry.detail.supportedBy]);
