import type { TFunction } from 'i18next';
import { fill } from '../../../i18n/fill.js';
import type { Translate } from '../figures/read.js';
import {
  byTitle,
  chartOf,
  chipsOf,
  rowWithMost,
  tablesOf,
  type PrintedPageModel,
} from '../printed-page/page-model.js';
import { unpair } from '../printed-page/pair.js';
import {
  cellChip,
  figureOf,
  pageOf,
  shortDate,
  type FiguresPart,
} from '../printed-page/printed.js';
import { say, strong } from '../printed-page/segs.js';
import { verdictOf } from '../printed-page/verdict.js';
import { pageWords } from '../printed-page/words.js';
import { seeRowsFor } from '../rows-behind/drill.js';

export const FIGURE = 'a3-mttr-mtbf';
const CELL_MONTHS = 'Month-on-Month MTTR & MTBF — Cell-wise and Plant-wide';
const CELLS = 'By Cell';
const MACHINES = 'By Individual Machine';
/** The By Cell table's columns: name, machines, breakdowns, hours, MTTR, MTBF. */
const COL = { name: 0, mttr: 4, mtbf: 5 } as const;
const MACHINE_CHIPS = 2;

/**
 * The MTTR and MTBF model from the engine's reply: the page of the `a3-mttr-mtbf` figure, whole. Its seven charts and
 * six tables are kept as printed (the two paired month-on-month matrices become one table per measure). The answer is
 * the plant's own year figures, the engine's last column of its plant-wide row, and the cell that is slowest to fix.
 */
export function mttrMtbfModel(reply: FiguresPart, t: TFunction): PrintedPageModel | null {
  const page = pageOf(figureOf(reply, FIGURE), t);
  if (page === null) return null;
  const words = pageWords(t, 'v2r.mm.source');
  const source = fill(words.source, { date: shortDate(reply.asOf) });
  const say_: Translate = (key, values) => t(key, { ...values }) as string;
  const months = byTitle(page, CELL_MONTHS);
  const plant = (half: { rows: string[][] } | undefined): string | undefined => {
    const row = half?.rows.find((r) => /^plant total/i.test(r[0] ?? ''));
    return row?.[row.length - 1];
  };
  const halves = months ? unpair(months, words.pair) : null;
  const [mttr, mtbf] = [plant(halves?.[0]), plant(halves?.[1])];
  const slowest = rowWithMost(byTitle(page, CELLS), COL.mttr);
  return {
    verdict: verdictOf(
      mttr && mtbf
        ? say(t('v2r.mm.headline'), { mttr: strong(mttr), mtbf: strong(mtbf) })
        : [{ text: t('v2r.noFigures') }],
      [
        slowest
          ? say(t('v2r.mm.slowest'), {
              cell: { text: slowest[COL.name] ?? '', entity: cellChip(slowest[COL.name] ?? '') },
              mttr: strong(slowest[COL.mttr] ?? ''),
              mtbf: slowest[COL.mtbf] ?? '',
            })
          : null,
      ],
      source,
    ),
    figures: [],
    charts: page.charts.map((spec) => chartOf(spec, words)),
    tables: tablesOf(page.tables, words, (table) =>
      table.title === MACHINES
        ? [
            ...chipsOf(table, 1, MACHINE_CHIPS, words.all),
            ...chipsOf(table, 2, MACHINE_CHIPS, words.all).slice(1),
          ]
        : [],
    ),
    drill: seeRowsFor(reply, FIGURE, say_),
    source,
    words,
  };
}
