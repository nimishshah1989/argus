import type { TFunction } from 'i18next';
import { fill } from '../../../i18n/fill.js';
import type { Point } from '../../../ui/v2/points.js';
import type { Meaning, Takeaways } from '../../../ui/v2/takeaway.js';
import type { PageTable } from '../../analytics/page-content.js';
import type { Translate } from '../figures/read.js';
import { chartOf, chipsOf, figuresOf, tablesOf } from '../printed-page/page-model.js';
import type { PageChart, PrintedPageModel } from '../printed-page/page-model.js';
import {
  figureOf,
  numberValue,
  pageOf,
  shortDate,
  type FiguresPart,
  type Page,
} from '../printed-page/printed.js';
import { say, strong } from '../printed-page/segs.js';
import { kpiOf, verdictOf } from '../printed-page/verdict.js';
import { pageWords } from '../printed-page/words.js';
import { machineChip } from '../printed-page/printed.js';
import { takeawayFor, type Item } from '../insight.js';
import { drillFor } from '../rows-behind/drill.js';
import type { BottleneckModel } from './model.js';

/** A machine's code from its id, by the plant's own list; null for a machine the plant does not list. */
export type CodeOf = (machineId: string) => string | null;

/** The engine's figure this screen is built from. */
export const FIGURE = 'a9-bottleneck-forecast';
const RISK_TABLE = 'Highest-risk machines';
/** The columns whose most common words narrow a long table: how bad, how hot, whether it is getting worse. */
const BAND_COLUMNS = ['Rating', 'Band', 'Verdict', 'Type'];

const REPEATS = 'For Maintenance: faults that keep coming back';
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * The repeat-faults table prints each machine by its database id where every other table prints its code (the engine
 * names `item.machineId`): the id is looked up and the code printed; a machine the plant does not list is a dash.
 */
function withCodes(table: PageTable, codeOf: CodeOf): PageTable {
  const at = table.title === REPEATS ? table.header.indexOf('Machine') : -1;
  if (at < 0) return table;
  return {
    ...table,
    rows: table.rows.map((row) =>
      row.map((cell, i) => (i === at && ID.test(cell) ? (codeOf(cell) ?? '—') : cell)),
    ),
  };
}

const columnOf = (table: PageTable | undefined, label: string): number =>
  table?.header.indexOf(label) ?? -1;

function headlineOf(page: Page, t: TFunction): Point {
  const [critical, high, single] = [
    kpiOf(page, 'Critical'),
    kpiOf(page, 'High'),
    kpiOf(page, 'Only one of their kind'),
  ];
  if (!critical || !high) return [{ text: t('v2r.noFigures') }];
  return say(t('v2b.headline'), {
    critical: strong(critical.value),
    high: strong(high.value),
    single: single?.value ?? '0',
  });
}

/** The machine the risk table ranks first, as a sentence with the machine a chip. */
function topMachine(page: Page, t: TFunction): Point | null {
  const table = page.tables.find((candidate) => candidate.title === RISK_TABLE);
  const row = table?.rows[0];
  const [at, score, rating, availability] = [
    columnOf(table, 'Machine'),
    columnOf(table, 'Score'),
    columnOf(table, 'Rating'),
    columnOf(table, 'Available'),
  ];
  const code = row?.[at];
  if (!row || !code || score < 0 || rating < 0) return null;
  return say(t('v2b.top'), {
    machine: { text: code, entity: machineChip(code) },
    score: strong(row[score] ?? ''),
    rating: row[rating] ?? '',
    availability: row[availability] ?? '',
  });
}

function planLine(page: Page, t: TFunction): Point | null {
  const [plan, worst] = [kpiOf(page, 'Plan for (80%)'), kpiOf(page, 'Worst case (90%)')];
  return plan && worst
    ? say(t('v2b.plan'), { plan: strong(plan.value), worst: worst.value })
    : null;
}

const DOWN = 'What if it goes down?';
const TREND = 'For Maintenance: is it getting worse or better?';

type Section = {
  id: string;
  title: string;
  /** The first column's label, where two tables share a title. */
  first?: string;
  /** The name column and the measure column; no measure means no items. */
  name: string;
  value?: string;
  meaning: Meaning;
};
const HIGH: Meaning = { worse: 'high' };
const SUM: Meaning = { worse: 'high', additive: true };

/** The engine's nine tables, in its order, each with the measure its takeaway reads. */
const SECTIONS: Section[] = [
  { id: 'risk', title: RISK_TABLE, name: 'Machine', value: 'Score', meaning: HIGH },
  { id: 'down-log', title: DOWN, first: 'Date', name: 'Problem', value: 'Hrs', meaning: SUM },
  { id: 'down-backup', title: DOWN, first: 'Machine', name: 'Machine', meaning: HIGH },
  {
    id: 'category',
    title: 'Capacity by machine category',
    name: 'Category',
    value: 'BD hrs',
    meaning: SUM,
  },
  { id: 'cell', title: 'Capacity by cell', name: 'Cell', value: 'BD hrs', meaning: SUM },
  {
    id: 'forecast',
    title: 'Downtime forecast for Planning',
    name: 'Machine',
    value: 'Expected hrs',
    meaning: SUM,
  },
  {
    id: 'trend-category',
    title: TREND,
    first: 'Category',
    name: 'Category',
    value: 'Test score',
    meaning: HIGH,
  },
  {
    id: 'trend-machine',
    title: TREND,
    first: 'Machine',
    name: 'Machine',
    value: 'Test score',
    meaning: HIGH,
  },
  { id: 'repeats', title: REPEATS, name: 'Machine', value: 'Downtime (hrs)', meaning: SUM },
];

/** The section a drawn table is, by its title and (where two share a title) its first column. */
export const sectionOf = (title: string, firstLabel: string | undefined): string | undefined =>
  SECTIONS.find((s) => s.title === title && (s.first === undefined || s.first === firstLabel))?.id;

/** One takeaway per table the engine sent, over every row of it. */
function takeawaysOf(tables: PageTable[], t: TFunction): Takeaways {
  const out: Takeaways = {};
  for (const table of tables) {
    const section = SECTIONS.find((s) => sectionOf(table.title, table.header[0]) === s.id);
    if (!section) continue;
    const [name, value] = [columnOf(table, section.name), columnOf(table, section.value ?? '')];
    const items: Item[] =
      value < 0 || name < 0
        ? []
        : table.rows.map((row) => ({
            name: row[name] ?? '',
            value: numberValue(row[value] ?? ''),
            shown: row[value] ?? '',
          }));
    out[section.id] = takeawayFor(items, section.meaning, t);
  }
  return out;
}

/**
 * The risk map is a bubble chart with no categories: its line says how many machines it draws. The engine names each
 * dot by the machine's id, so a dot is relabelled by the plant's own code, and a machine the plant does not list is a dash.
 */
function chartCard(
  spec: Page['charts'][number],
  t: TFunction,
  words: PrintedPageModel['words'],
  codeOf: CodeOf,
): PageChart {
  if (spec.kind !== 'scatter') return chartOf(spec, words);
  const n = spec.points.length;
  return {
    id: spec.title,
    spec: {
      ...spec,
      points: spec.points.map((point) => ({ ...point, label: codeOf(point.label) ?? '—' })),
    },
    sub: fill(t('v2b.map.sub'), { n }),
    aria: fill(t('v2b.map.aria'), { n, title: spec.title }),
  };
}

/**
 * The Bottleneck screen from the engine's `a9-bottleneck-forecast` figure, whole: its fourteen figures, its risk map
 * and downtime chart, and its nine tables (the highest-risk machines, what happens if one goes down, capacity by
 * category and by cell, the planning forecast, the trend tests and the repeat faults), every cell as printed. The
 * answer is read from the printed figures and the table's first row. Null when the engine has no page.
 */
export function bottleneckModel(
  reply: FiguresPart,
  t: TFunction,
  codeOf: CodeOf,
): BottleneckModel | null {
  const page = pageOf(figureOf(reply, FIGURE), t);
  if (page === null) return null;
  const words = pageWords(t, 'v2b.source');
  const say_: Translate = (key, values) => t(key, { ...values }) as string;
  const source = fill(words.source, { date: shortDate(reply.asOf) });
  const coded = page.tables.map((table) => withCodes(table, codeOf));
  return {
    verdict: verdictOf(headlineOf(page, t), [planLine(page, t), topMachine(page, t)], source),
    // shortcut: the engine's sub is a basis, not a yardstick; upgrade when the engine prints a prior period.
    figures: figuresOf(page.kpis).map((figure) => ({ ...figure, yardstick: figure.sub })),
    charts: page.charts.map((spec) => chartCard(spec, t, words, codeOf)),
    takeaways: takeawaysOf(coded, t),
    tables: tablesOf(coded, words, (table) => {
      const column = BAND_COLUMNS.map((label) => columnOf(table, label)).find((at) => at >= 0);
      return column === undefined ? [] : chipsOf(table, column, 4, words.all);
    }),
    drill: drillFor(reply, FIGURE, say_),
    source,
    words,
  };
}
