import type { TFunction } from 'i18next';
import { fill } from '../../../i18n/fill.js';
import { machineChip, personChips, shortDate } from '../printed-page/printed.js';
import type { LogModel, LogQuery, LogRow, LogWords } from './model.js';
import type { LogEntry, LogReply } from './serve.js';
import { logWords } from './words.js';

const DASH = '—';
const TICKET_NUMBER = /^[A-Z]{1,3}-\d+$/;
const whole = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

/**
 * One printed entry. A ticket number the platform never issued (an imported row carries its workbook id there) is not
 * printed as one.
 */
function rowOf({ cells: printed, ticketId }: LogEntry): LogRow {
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
    ticket: TICKET_NUMBER.test(ticket) ? ticket : DASH,
    date: shortDate(date),
    shift,
    machine: machineChip(machine),
    problem,
    doneBy: personChips(doneBy),
    hours,
    code,
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
  const source = fill(words.source, { date: shortDate(asOf) });
  return {
    verdict: verdictOf(reply, words, source, asOf),
    rows: reply.rows.map(rowOf),
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
    source,
    words,
  };
}
