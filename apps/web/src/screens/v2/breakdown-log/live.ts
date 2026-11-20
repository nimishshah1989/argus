import type { TFunction } from 'i18next';
import { NotComputed } from '../figures/live-error.js';
import { figureOf, pageOf, type FiguresPart } from '../printed-page/printed.js';
import { logModel } from './adapter.js';
import type { LogModel, LogQuery } from './model.js';
import { cutPage, everyMatch, type PrintedLog } from './serve.js';

const KEY = 'breakdown-log';

/** The engine's printed log in a figures reply; null when it has none. */
export function printedLog(reply: FiguresPart, t: TFunction): PrintedLog | null {
  const figure = figureOf(reply, KEY);
  const table = pageOf(figure, t)?.tables[0];
  if (figure === undefined || table === undefined || table.rows.length === 0) return null;
  return {
    header: table.header,
    rows: table.rows,
    ticketIds: table.rowTicketIds ?? [],
    rowCount: table.rowCount,
  };
}

/**
 * The Breakdown Log for one query, from the figures reply: the one page the query asks for (`cutPage`, until a server
 * endpoint serves pages) through the adapter. Null when the log is empty or not computed.
 */
export function logFromFigures(reply: FiguresPart, query: LogQuery, t: TFunction): LogModel | null {
  const log = printedLog(reply, t);
  return log === null ? null : logModel(cutPage(log, query), query, reply.asOf, t);
}

/** The whole narrowed log in the order asked, for the export: the engine's header and every row that matches. */
export function everyMatchOf(
  reply: FiguresPart,
  query: LogQuery,
  t: TFunction,
): { header: string[]; rows: string[][] } {
  const log = printedLog(reply, t);
  return log === null
    ? { header: [], rows: [] }
    : { header: log.header, rows: everyMatch(log, query) };
}

/**
 * What the screen is asked for: the page `logFromFigures` cuts, except that a log the engine has not computed says so
 * (`NotComputed`, "Not computed yet") and is never read as an empty plant.
 */
export function liveLog(reply: FiguresPart, query: LogQuery, t: TFunction): LogModel | null {
  if (figureOf(reply, KEY)?.status !== 'ready') throw new NotComputed();
  return logFromFigures(reply, query, t);
}
