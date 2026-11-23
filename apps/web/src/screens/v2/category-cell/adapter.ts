import type { TFunction } from 'i18next';
import type { Point } from '../../../ui/v2/points.js';
import { fill } from '../../../i18n/fill.js';
import type { Translate } from '../figures/read.js';
import type { PageTable } from '../../analytics/page-content.js';
import {
  byTitle,
  chartOf,
  cellsNamed,
  chipsOf,
  rowWithMost,
  tablesOf,
  type PageWords,
  type PrintedPageModel,
} from '../printed-page/page-model.js';
import {
  cellChip,
  figureOf,
  pageOf,
  shortDate,
  type FiguresPart,
} from '../printed-page/printed.js';
import { chartNotes } from '../printed-page/notes.js';
import { say, strong } from '../printed-page/segs.js';
import { printedTable, type PrintedTable } from '../printed-page/table.js';
import { verdictOf } from '../printed-page/verdict.js';
import { pageWords } from '../printed-page/words.js';
import { seeRowsFor } from '../rows-behind/drill.js';

export const FIGURE = 'a2-category-cell';
const CATEGORIES = 'By Category — Detail';
const CELLS = 'By Cell — Detail';
const MACHINES = 'Machine-Level Detail';
/** The two summary tables' columns: name, machines, breakdowns, hours, share of all, hours a machine, hours a breakdown. */
const COL = { name: 0, machines: 1, hours: 3, share: 4, perMachine: 5 } as const;
/** The machine table's: machine, category, cell (the category is added by this screen), breakdowns, hours, share. */
const MACHINE_CHIPS = 2;

/**
 * The engine prints one "Machine-Level Detail" table per category and never says which: they follow the By Category
 * table's rows, one to one. Read that way only when each table holds exactly the machines its category row counts;
 * then they are one table with a Category column, every row kept. Otherwise null and the tables stay as printed.
 */
function machinesByCategory(
  categories: PageTable | undefined,
  detail: PageTable[],
  words: PageWords,
): PrintedTable | null {
  const rows = categories?.rows ?? [];
  const fits =
    detail.length > 0 &&
    detail.length === rows.length &&
    detail.every((table, at) => String(table.rows.length) === rows[at]?.[COL.machines]);
  if (!categories || !fits) return null;
  const [first] = detail;
  const merged: PageTable = {
    ...first!,
    header: [first!.header[0] ?? '', categories.header[COL.name] ?? '', ...first!.header.slice(1)],
    rows: detail.flatMap((table, at) =>
      table.rows.map((row) => [row[0] ?? '', rows[at]?.[COL.name] ?? '', ...row.slice(1)]),
    ),
  };
  merged.rowCount = merged.rows.length;
  const chips = [
    ...chipsOf(merged, 1, MACHINE_CHIPS, words.all),
    ...chipsOf(merged, 2, MACHINE_CHIPS, words.all).slice(1),
  ];
  return printedTable(merged, chips);
}

const nameOf = (row: string[]) => row[COL.name] ?? '';

function headlineOf(categories: PageTable | undefined, t: TFunction): Point {
  const row = rowWithMost(categories, COL.hours);
  if (!row) return [{ text: t('v2r.noFigures') }];
  return say(t('v2r.cc.headline'), {
    name: strong(nameOf(row)),
    hours: strong(row[COL.hours] ?? ''),
    share: row[COL.share] ?? '',
  });
}

function behind(categories: PageTable | undefined, cells: PageTable | undefined, t: TFunction) {
  const cell = rowWithMost(cells, COL.hours);
  const perMachine = rowWithMost(categories, COL.perMachine);
  return [
    cell
      ? say(t('v2r.cc.cell'), {
          cell: { text: nameOf(cell), entity: cellChip(nameOf(cell)) },
          hours: strong(cell[COL.hours] ?? ''),
          share: cell[COL.share] ?? '',
        })
      : null,
    perMachine
      ? say(t('v2r.cc.perMachine'), {
          name: nameOf(perMachine),
          hours: strong(perMachine[COL.perMachine] ?? ''),
        })
      : null,
  ];
}

/**
 * The Category and Cell model from the engine's reply: the page of the `a2-category-cell` figure, whole. Its eight
 * charts and two summary tables are kept as printed; the fourteen machine tables become one table with the category
 * the engine's order gives each. The answer is read from the printed rows: the category and cell with the most hours.
 */
export function categoryCellModel(reply: FiguresPart, t: TFunction): PrintedPageModel | null {
  const page = pageOf(figureOf(reply, FIGURE), t);
  if (page === null) return null;
  const words = pageWords(t, 'v2r.cc.source');
  const source = fill(words.source, { date: shortDate(reply.asOf) });
  const say_: Translate = (key, values) => t(key, { ...values }) as string;
  const categories = byTitle(page, CATEGORIES);
  const detail = page.tables
    .filter((table) => table.title === MACHINES)
    .map((table) => cellsNamed(table, words));
  const merged = machinesByCategory(categories, detail, words);
  return {
    verdict: verdictOf(
      headlineOf(categories, t),
      behind(categories, byTitle(page, CELLS), t),
      source,
    ),
    figures: [],
    charts: chartNotes(
      page.charts.map((spec) => chartOf(spec, words)),
      {
        [t('analytics.content.a2.catAvgHrsChart')]: t('v2r.note.cc.catAvgHrs'),
        [t('analytics.content.a2.catAvgCountChart')]: t('v2r.note.cc.catAvgCount'),
        [t('analytics.content.a2.cellAvgHrsChart')]: t('v2r.note.cc.cellAvgHrs'),
        [t('analytics.content.a2.cellAvgCountChart')]: t('v2r.note.cc.cellAvgCount'),
      },
    ),
    tables: [
      ...tablesOf(
        page.tables.filter((table) => table.title !== MACHINES),
        words,
      ),
      ...(merged ? [merged] : tablesOf(detail, words)),
    ],
    drill: seeRowsFor(reply, FIGURE, say_),
    source,
    words,
  };
}
