import type { TFunction } from 'i18next';
import { fill } from '../../../i18n/fill.js';
import {
  byTitle,
  chartOf,
  chipsOf,
  figuresOf,
  rowWithMost,
  tablesOf,
  type PrintedPageModel,
} from '../printed-page/page-model.js';
import {
  figureOf,
  pageOf,
  personChip,
  shortDate,
  type FiguresPart,
} from '../printed-page/printed.js';
import { say, strong } from '../printed-page/segs.js';
import { kpiOf, verdictOf } from '../printed-page/verdict.js';
import { pageWords } from '../printed-page/words.js';

const KEY = 'a4-manpower';
const TABLE = 'Manpower Table';
/** The Manpower table's columns: name, type, breakdowns done, hours done, average fix time, then who supported. */
const COL = { name: 0, type: 1, done: 2, hours: 3, share: 8 } as const;
const TYPE_CHIPS = 3;

/**
 * The Manpower model from the engine's reply: the page of the `a4-manpower` figure, whole. Its three figures, chart
 * and five tables are kept as printed (the PM matrix's paired rows become one table for jobs and one for hours); a
 * person is a chip. The answer is the person who handled the most breakdowns, read from the printed table.
 */
export function manpowerModel(reply: FiguresPart, t: TFunction): PrintedPageModel | null {
  const page = pageOf(figureOf(reply, KEY), t);
  if (page === null) return null;
  const words = pageWords(t, 'v2r.mp.source');
  const source = fill(words.source, { date: shortDate(reply.asOf) });
  const table = byTitle(page, TABLE);
  const most = rowWithMost(table, COL.done);
  const hours = rowWithMost(table, COL.hours);
  const [total, tracked, all] = [
    kpiOf(page, 'Total Breakdowns'),
    kpiOf(page, 'Team Members Tracked'),
    kpiOf(page, 'Total BD Hours'),
  ];
  const who = (row: string[]) => ({
    text: row[COL.name] ?? '',
    entity: personChip(row[COL.name] ?? ''),
  });
  return {
    verdict: verdictOf(
      most && total
        ? say(t('v2r.mp.headline'), {
            person: who(most),
            count: strong(most[COL.done] ?? ''),
            total: total.value,
            share: most[COL.share] ?? '',
          })
        : [{ text: t('v2r.noFigures') }],
      [
        hours
          ? say(t('v2r.mp.hours'), { person: who(hours), hours: strong(hours[COL.hours] ?? '') })
          : null,
        tracked && all
          ? say(t('v2r.mp.team'), {
              n: tracked.value,
              sub: tracked.sub ?? '',
              hours: all.value,
            })
          : null,
      ],
      source,
    ),
    figures: figuresOf(page.kpis),
    charts: page.charts.map((spec) => chartOf(spec, words)),
    tables: tablesOf(page.tables, words, (t) =>
      t.title === TABLE ? chipsOf(t, COL.type, TYPE_CHIPS, words.all) : [],
    ),
    source,
    words,
  };
}
