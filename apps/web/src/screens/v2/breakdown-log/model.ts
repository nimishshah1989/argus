import type { PagedWords } from '../../../ui/v2/paged-table.js';
import type { EntityChipProps } from '../../../ui/v2/entity-chip.js';
import type { VerdictData } from '../../../ui/v2/verdict.js';

export type LogFilterId = 'date' | 'shift' | 'machine' | 'code';
export type LogSortKey =
  'srNo' | 'ticket' | 'date' | 'shift' | 'machine' | 'problem' | 'doneBy' | 'hours' | 'code';

/** What the reader has asked of the log: one page, a search, a sort and four exact filters. The server answers all of it. */
export type LogQuery = {
  page: number;
  query: string;
  sort: { key: LogSortKey; dir: 'asc' | 'desc' } | null;
  filters: Record<LogFilterId, string>;
};

export const EMPTY_QUERY: LogQuery = {
  page: 1,
  query: '',
  sort: null,
  filters: { date: '', shift: '', machine: '', code: '' },
};

/** One entry of the log, as the engine printed it. */
export type LogRow = {
  id: string;
  /** The row's own ticket, as the engine printed it beside the row; null when the figure named none. */
  ticketId: string | null;
  srNo: string;
  /** The ticket number; a number the platform never gave a ticket is not printed. */
  ticket: string;
  date: string;
  shift: string;
  machine: EntityChipProps;
  problem: string;
  doneBy: EntityChipProps[];
  /** The platform's own hours: a dash for a NO DT entry, which sorts last whichever way. */
  hours: string;
  code: string;
};

export type LogWords = {
  /** The aria label of a row's ticket link, with `{srNo}`. */
  openTicket: string;
  why: string;
  /** `{count}` entries, newest `{date}`. */
  headline: string;
  /** `{count}`: the whole log, said under the table when a filter narrows it. */
  whole: string;
  intro: string;
  /** `{date}`: the line under the page. */
  source: string;
  table: PagedWords;
  columns: Record<LogSortKey, string>;
  filters: Record<LogFilterId, string>;
  all: string;
  export: string;
  exportError: string;
  nobody: string;
};

/** One page of the log and what it needs to draw its table; never more than 10 rows. */
export type LogModel = {
  verdict: VerdictData;
  rows: LogRow[];
  query: LogQuery;
  /** Rows that match the filters; the pager counts these. */
  matching: number;
  /** The whole log, as the engine counted it. */
  count: number;
  /** The same, in Indian grouping, ready to print. */
  countShown: string;
  options: Record<LogFilterId, string[]>;
  source: string;
  words: LogWords;
};
