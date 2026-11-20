import type { TFunction } from 'i18next';
import { fill } from '../../../i18n/fill.js';
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

const KEY = 'a6-why-why';
const DONE = 'Completed';
/** The candidate table's columns: machine, date, problem, hours down, status, then the platform's action cell. */
const COL = { machine: 0, date: 1, problem: 2, down: 3, status: 4 } as const;

function wordsOf(t: TFunction): WhyWhyWords {
  return {
    why: t('v2p.why'),
    source: t('v2r.ww.source'),
    startNote: t('v2r.ww.startNote'),
    startLink: t('v2r.ww.startLink'),
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
 * The Why-Why model from the engine's reply: the page of the `a6-why-why` figure, whole. Its one table keeps every
 * row and the engine's own status word, worst first as the engine ordered it; the platform's action cell (Start or
 * View) is not printed because it cannot be tied to a ticket here (see the coverage table). Null when the engine has
 * no candidates.
 */
export function whyWhyModel(reply: FiguresPart, t: TFunction): WhyWhyModel | null {
  const page = pageOf(figureOf(reply, KEY), t);
  const table = page?.tables[0];
  if (!page || !table) return null;
  const words = wordsOf(t);
  const source = fill(words.source, { date: shortDate(reply.asOf) });
  const rows: WhyWhyRow[] = table.rows.map((row, at) => ({
    id: String(at),
    machine: machineChip(row[COL.machine] ?? ''),
    date: { shown: shortDate(row[COL.date] ?? ''), value: dayValue(row[COL.date] ?? '') },
    problem: row[COL.problem] ?? '',
    down: { shown: row[COL.down] ?? '', value: numberValue(row[COL.down] ?? '') },
    status: { text: row[COL.status] ?? '', done: (row[COL.status] ?? '').trim() === DONE },
  }));
  const done = rows.filter((row) => row.status.done).length;
  const worst = rows[0];
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
    source,
    words,
  };
}
