import type { TFunction } from 'i18next';
import { fill } from '../../../i18n/fill.js';
import { machineChip, personChips, shortDate } from '../printed-page/printed.js';
import type { LogModel, LogQuery, LogRow, LogWords } from './model.js';
import type { LogReply } from './serve.js';
import { logWords } from './words.js';

const DASH = '—';
const TICKET_NUMBER = /^[A-Z]{1,3}-\d+$/;
const whole = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

/**
 * One printed entry. A ticket number the platform never issued (an imported row carries its workbook id there) is not
 * printed as one.
 */
function rowOf(printed: string[]): LogRow {
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

/** The log's newest entry says how fresh it is; the count says how big. Both are the engine's. */
function verdictOf(reply: LogReply, words: LogWords, source: string): LogModel['verdict'] {
  const newest = reply.rows[0]?.[3];
  return {
    headline: [
      {
        text: fill(words.headline, {
          count: whole.format(reply.count),
          date: newest ? shortDate(newest) : DASH,
        }),
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
    verdict: verdictOf(reply, words, source),
    rows: reply.rows.map(rowOf),
    query,
    matching: reply.matching,
    count: reply.count,
    countShown: whole.format(reply.count),
    options: reply.options,
    source,
    words,
  };
}
