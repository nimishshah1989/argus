import type { TFunction } from 'i18next';
import type { Point } from '../../../ui/v2/points.js';
import { fill } from '../../../i18n/fill.js';
import { byTitle, figuresOf, rowWithMost, tablesOf, chartOf } from '../printed-page/page-model.js';
import type { PrintedPageModel } from '../printed-page/page-model.js';
import {
  cellChip,
  figureOf,
  pageOf,
  type Page,
  shortDate,
  type FiguresPart,
} from '../printed-page/printed.js';
import { say, strong } from '../printed-page/segs.js';
import { kpiOf, verdictOf } from '../printed-page/verdict.js';
import { pageWords } from '../printed-page/words.js';

const KEY = 'a1-bd-pm';
const CELLS = 'By Cell — Detail';
/** The By Cell table's columns: name, machines, available hours, BD hours, BD %, PM hours, PM %, total %. */
const COL = { cell: 0, bd: 4, pm: 6, total: 7 } as const;

function headlineOf(page: Page, t: TFunction): Point {
  const [bd, pm, availability] = [
    kpiOf(page, 'Actual Breakdown'),
    kpiOf(page, 'PM Downtime'),
    kpiOf(page, 'Fleet Availability'),
  ];
  if (!bd || !pm || !availability) return [{ text: t('v2r.noFigures') }];
  return say(t('v2r.bd.headline'), {
    bd: strong(bd.value),
    bdSub: bd.sub ?? '',
    pm: strong(pm.value),
    pmSub: pm.sub ?? '',
    availability: strong(availability.value),
  });
}

/** The cell the By Cell table says loses the most of its available hours, as a sentence with the cell a chip. */
function worstCell(page: Page, t: TFunction): Point | null {
  const row = rowWithMost(byTitle(page, CELLS), COL.total);
  if (!row) return null;
  const name = row[COL.cell] ?? '';
  return say(t('v2r.bd.worst'), {
    cell: { text: name, entity: cellChip(name) },
    total: strong(row[COL.total] ?? ''),
    bd: row[COL.bd] ?? '',
    pm: row[COL.pm] ?? '',
  });
}

/**
 * The BD % and PM split model from the engine's reply: the page of the `a1-bd-pm` figure, whole. Its six figures, two
 * charts and four tables are kept as printed (the two paired month-on-month rows become one table per measure), and the
 * answer is read from the printed figures and the cell the table says loses the most. Null when the engine has no page.
 */
export function bdPmModel(reply: FiguresPart, t: TFunction): PrintedPageModel | null {
  const page = pageOf(figureOf(reply, KEY), t);
  if (page === null) return null;
  const words = pageWords(t, 'v2r.bd.source');
  const source = fill(words.source, { date: shortDate(reply.asOf) });
  const availability = kpiOf(page, 'Fleet Availability')?.sub;
  return {
    verdict: verdictOf(
      headlineOf(page, t),
      [
        availability ? say(t('v2r.bd.availability'), { sub: availability }) : null,
        worstCell(page, t),
      ],
      source,
    ),
    figures: figuresOf(page.kpis),
    charts: page.charts.map((spec) => chartOf(spec, words)),
    tables: tablesOf(page.tables, words),
    source,
    words,
  };
}
