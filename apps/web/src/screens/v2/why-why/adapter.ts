import type { TFunction } from 'i18next';
import { fill } from '../../../i18n/fill.js';
import type { Translate } from '../figures/read.js';
import { drillFor } from '../rows-behind/drill.js';
import {
  dayValue,
  figureOf,
  machineChip,
  numberValue,
  pageOf,
  shortDate,
  type FiguresPart,
} from '../printed-page/printed.js';
import { say, strong } from '../printed-page/segs.js';
import { verdictOf } from '../printed-page/verdict.js';
import type { WhyWhyModel, WhyWhyRow, WhyWhyWords } from './model.js';

/** The engine's figure this screen is built from. */
export const FIGURE = 'a6-why-why';
const DONE = 'Completed';
/** The candidate table's columns: machine, date, problem, hours down, status, then the platform's action cell. */
const COL = { machine: 0, date: 1, problem: 2, down: 3, status: 4 } as const;

function wordsOf(t: TFunction): WhyWhyWords {
  return {
    why: t('v2p.why'),
    source: t('v2r.ww.source'),
    action: {
      column: t('analytics.whyWhy.action'),
      start: t('analytics.whyWhy.start'),
      view: t('analytics.whyWhy.view'),
      refused: t('analytics.whyWhy.refused'),
    },
    form: {
      form: t('analytics.whyWhy.form'),
      title: t('analytics.whyWhy.title'),
      whys: [1, 2, 3, 4, 5].map((number) => t('analytics.whyWhy.why', { number })),
      conclusion: t('analytics.whyWhy.conclusion'),
      save: t('analytics.whyWhy.save'),
      saved: t('analytics.whyWhy.saved'),
      pdf: t('analytics.whyWhy.pdf'),
      cancel: t('analytics.whyWhy.cancel'),
    },
    table: {
      title: t('v2r.ww.tableTitle'),
      search: t('v2r.search'),
      showing: t('v2p.showing'),
      noResults: t('v2p.noResults'),
      open: t('v2p.open'),
      columns: {
        machine: t('v2p.machine'),
        date: t('v2p.date'),
        problem: t('v2p.problem'),
        down: t('v2r.ww.down'),
        status: t('v2r.ww.status'),
      },
      filters: { all: t('v2p.all'), todo: t('v2r.ww.todo'), done: t('v2r.ww.done') },
    },
  };
}

/**
 * The ticket the engine printed beside row `at`, or null when it named none. The figure's own drill ids are sorted, not
 * in row order, so a row is never tied to a ticket by its place in them.
 */
function ticketOf(ids: readonly string[] | undefined, at: number): string | null {
  const id = ids?.[at];
  return id === undefined || id === '' ? null : id;
}

/**
 * The Why-Why model from the engine's reply: the page of the `a6-why-why` figure, whole. Its one table keeps every
 * row and the engine's own status word, worst first as the engine ordered it. Each row carries the ticket the engine
 * printed beside it, so Start and View act on that row's own ticket (the platform's action cell is not printed). Null
 * when the engine has no candidates.
 */
export function whyWhyModel(reply: FiguresPart, t: TFunction): WhyWhyModel | null {
  const page = pageOf(figureOf(reply, FIGURE), t);
  const table = page?.tables[0];
  if (!page || !table) return null;
  const words = wordsOf(t);
  const source = fill(words.source, { date: shortDate(reply.asOf) });
  const rows: WhyWhyRow[] = table.rows.map((row, at) => ({
    id: String(at),
    machine: machineChip(row[COL.machine] ?? ''),
    date: {
      shown: shortDate(row[COL.date] ?? ''),
      value: dayValue(row[COL.date] ?? ''),
      printed: row[COL.date] ?? '',
    },
    problem: row[COL.problem] ?? '',
    down: { shown: row[COL.down] ?? '', value: numberValue(row[COL.down] ?? '') },
    status: { text: row[COL.status] ?? '', done: (row[COL.status] ?? '').trim() === DONE },
    ticketId: ticketOf(table.rowTicketIds, at),
  }));
  const done = rows.filter((row) => row.status.done).length;
  const worst = rows[0];
  const say_: Translate = (key, values) => t(key, { ...values }) as string;
  return {
    verdict: verdictOf(
      say(t('v2r.ww.headline'), {
        n: strong(String(rows.length)),
        done: String(done),
        todo: strong(String(rows.length - done)),
      }),
      [
        worst
          ? say(t('v2r.ww.worst'), {
              machine: { text: worst.machine.label, entity: worst.machine },
              hours: strong(worst.down.shown),
              date: worst.date.shown,
              problem: worst.problem,
            })
          : null,
      ],
      source,
    ),
    rows,
    drill: drillFor(reply, FIGURE, say_),
    source,
    words,
  };
}
