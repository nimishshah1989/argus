import type { PagedWords } from '../../../ui/v2/paged-table.js';
import type { EntityChipProps } from '../../../ui/v2/entity-chip.js';
import type { VerdictData } from '../../../ui/v2/verdict.js';
import type { Takeaways } from '../../../ui/v2/takeaway.js';

export type LogFilterId = 'date' | 'month' | 'shift' | 'machine' | 'code' | 'person';
export type LogSortKey =
  'srNo' | 'ticket' | 'date' | 'shift' | 'machine' | 'problem' | 'doneBy' | 'hours' | 'code';

/** What the reader has asked of the log: one page, a search, a sort and six exact filters. The server answers all of it. */
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
  filters: { date: '', month: '', shift: '', machine: '', code: '', person: '' },
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
  /** Only the exceptions are tagged: over 4 hours the entry is a long stop, over 1 hour a stop to watch. */
  severity: 'long' | 'watch' | null;
  code: string;
  /** What the plant's code list says the code means; null when it lists none (a dash, an unlisted code). */
  codeLabel: string | null;
  /** E, M or E/M, when the engine sent the row's type and it adds to the code. */
  type: string;
  /** Who supported the job (Bhavin's 11 Nov detail view), one chip each; empty when nobody did. */
  supportedBy: EntityChipProps[];
};

export type LogWords = {
  /** The aria label of a row's ticket link, with `{srNo}`. */
  openTicket: string;
  why: string;
  /** `{count}` rows (v1's own words). */
  headline: string;
  /** `{date}`: how far the records run (v1's own words). */
  recordsTo: string;
  /** `{count}`: the whole log, said under the table when a filter narrows it. */
  whole: string;
  intro: string;
  /** `{date}`: the line under the page. */
  source: string;
  table: PagedWords;
  columns: Record<LogSortKey, string>;
  filters: Record<LogFilterId, string>;
  all: string;
  /** What a row's ticket column says for an entry imported from the workbook (it has no ticket number of its own). */
  imported: string;
  /** The tags on the exceptions: a stop of over 4 hours and one of over 1 hour. */
  long: string;
  watch: string;
  /** `{code}` and `{label}`: the Code filter's option and the badge's tooltip. */
  codeOption: string;
  /** The label before who supported a job, and before a job's type (E, M, E/M). */
  supportedBy: string;
  type: string;
  export: string;
  exportError: string;
  nobody: string;
};

/** One page of the log and what it needs to draw its table; never more than 10 rows. */
export type LogModel = {
  verdict: VerdictData;
  /** ADR 0031 §3: `log`, over the hours by machine of the matching entries (not the page), PM rows and dashes left out. */
  takeaways?: Takeaways;
  rows: LogRow[];
  query: LogQuery;
  /** Rows that match the filters; the pager counts these. */
  matching: number;
  /** The whole log, as the engine counted it. */
  count: number;
  /** The same, in Indian grouping, ready to print. */
  countShown: string;
  /** "showing the newest X of N" when the engine printed fewer entries than it counted; null otherwise. */
  truncated: string | null;
  options: Record<LogFilterId, string[]>;
  /** The plant's code list as `code` to what it means, for the Code filter's option text. */
  codeLabels: Record<string, string>;
  source: string;
  words: LogWords;
};
