import type { TFunction } from 'i18next';
import { fill } from '../../../i18n/fill.js';
import { machineChip, numberValue, personChips, shortDate } from '../printed-page/printed.js';
import type { LogModel, LogQuery, LogRow, LogWords } from './model.js';
import type { LogEntry, LogReply } from './serve.js';
import { logWords } from './words.js';

const DASH = '—';
/** Bhavin's hard-coded bands (11 Nov platform): red over 4 hours, amber over 1 hour; queued as a plant setting. */
const LONG_STOP_HOURS = 4;
const WATCH_STOP_HOURS = 1;
const TICKET_NUMBER = /^[A-Z]{1,3}-\d+$/;
const whole = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

const severityOf = (hours: string): LogRow['severity'] => {
  const value = hours === DASH ? 0 : numberValue(hours);
  return value > LONG_STOP_HOURS ? 'long' : value > WATCH_STOP_HOURS ? 'watch' : null;
};

/** Who supported the job, and its type (E, M, E/M) when that adds to the code. */
const detailOf = (detail: LogEntry['detail'], code: string) => ({
  type: detail.type !== code ? detail.type : '',
  supportedBy: personChips(detail.supportedBy),
});

/**
 * One printed entry. A ticket number the platform never issued (an imported row carries its workbook id there) is said
 * as where the entry came from, never as a dash or as that id.
 */
function rowOf(
  { cells: printed, ticketId, detail }: LogEntry,
  words: LogWords,
  labels: Record<string, string>,
): LogRow {
  const [
    ,
    srNo = '',
    ticket = '',
    date = '',
    shift = '',
    machine = '',
    problem = '',
    doneBy = '',
    hours = '',
    code = '',
  ] = printed;
  return {
    id: `${srNo}|${ticket}|${machine}`,
    ticketId,
    srNo,
    ticket: TICKET_NUMBER.test(ticket) ? ticket : words.imported,
    date: shortDate(date),
    shift,
    machine: machineChip(machine),
    problem,
    doneBy: personChips(doneBy),
    hours,
    severity: severityOf(hours),
    code,
    codeLabel: labels[code] ?? null,
    ...detailOf(detail, code),
  };
}

/** The count says how big the log is and the date says how far its records run; both are v1's words. */
function verdictOf(
  reply: LogReply,
  words: LogWords,
  source: string,
  asOf: string,
): LogModel['verdict'] {
  return {
    headline: [
      {
        text: `${fill(words.headline, { count: whole.format(reply.count) })} · ${fill(words.recordsTo, { date: shortDate(asOf) })}`,
        tone: 'strong',
      },
    ],
    why: [[{ text: words.intro }]],
    context: source,
  };
}

/**
 * The Breakdown Log model for one page the server answered (or `cutPage` cut, until it does): at most ten entries,
 * with the counts and the filter values around them. Null when the log is empty: an empty plant never becomes a page.
 */
export function logModel(
  reply: LogReply,
  query: LogQuery,
  asOf: string,
  t: TFunction,
): LogModel | null {
  if (reply.count === 0) return null;
  const words = logWords(t);
  const labels = Object.fromEntries(reply.codes.map(({ code, label }) => [code, label]));
  const source = fill(words.source, { date: shortDate(asOf) });
  return {
    verdict: verdictOf(reply, words, source, asOf),
    rows: reply.rows.map((entry) => rowOf(entry, words, labels)),
    query,
    matching: reply.matching,
    count: reply.count,
    countShown: whole.format(reply.count),
    truncated:
      reply.held < reply.count
        ? t('analytics.log.truncated', {
            shown: whole.format(reply.held),
            total: whole.format(reply.count),
          })
        : null,
    options: reply.options,
    codeLabels: labels,
    source,
    words,
  };
}
