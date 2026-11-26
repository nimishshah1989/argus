import type { TFunction } from 'i18next';
import type { PrintedTable } from '../../../ui/v2/domain/printed-table.js';
import type { Meaning, Takeaways } from '../../../ui/v2/takeaway.js';
import { fill } from '../../../i18n/fill.js';
import { numberIn, type Translate } from '../figures/read.js';
import { takeawayFor, type Item } from '../insight.js';
import { drillFor } from '../rows-behind/drill.js';
import {
  byTitle,
  chartOf,
  chipsOf,
  figuresOf,
  rowWithMost,
  tablesOf,
} from '../printed-page/page-model.js';
import {
  figureOf,
  numberValue,
  pageOf,
  type Page,
  personChip,
  shortDate,
  type FiguresPart,
} from '../printed-page/printed.js';
import { say, strong } from '../printed-page/segs.js';
import { kpiOf, verdictOf } from '../printed-page/verdict.js';
import { pageWords } from '../printed-page/words.js';
import type { ManpowerModel } from './model.js';
import { sumText } from './sweep.js';

/** The engine's figure this screen is built from. */
export const FIGURE = 'a4-manpower';
const SPECIALIZATION = 'Specialization';
const TABLE = 'Manpower Table';
/** The Manpower table's columns: name, type, breakdowns done, hours done, average fix time, then who supported. */
const COL = { name: 0, type: 1, done: 2, hours: 3, share: 8 } as const;
const TYPE_CHIPS = 3;

const PM = 'Preventive Maintenance';
/** A person's count or hours add up, and more is worse (ADR 0026 §4). */
const MEANING: Meaning = { worse: 'high', additive: true };
const MONTHLY: Record<string, string> = {
  'Month-on-Month — # Breakdowns Handled': 'monthly-count',
  'Month-on-Month — BD Hours Handled': 'monthly-hours',
};

/** The section a printed table is, by the engine's title; the PM matrix's two halves end in their measure. */
export function sectionOf(title: string, halves: readonly string[]): string | undefined {
  if (title === TABLE) return 'people';
  if (title === SPECIALIZATION) return 'specialization';
  if (title.startsWith(PM)) {
    const half = halves.findIndex((measure) => title.endsWith(` · ${measure}`));
    return half < 0 ? undefined : ['pm-jobs', 'pm-hours'][half];
  }
  return MONTHLY[title];
}

const whole = (n: number) => sumText(n, 0);
const oneDecimal = (n: number) => sumText(n, 1);
const isTotal = (row: PrintedTable['rows'][number]) => /^plant total/i.test(row[0]?.text ?? '');

/** One item per person: the cell of `column` as printed, the PLANT TOTAL row and cells with no digit left out. */
function peopleItems(table: PrintedTable, column: number): Item[] {
  return table.rows.flatMap((row) => {
    const shown = row[column]?.text ?? '';
    return isTotal(row) || !/\d/.test(shown)
      ? []
      : [{ name: row[0]?.text ?? '', value: numberValue(shown), shown }];
  });
}

/** One item per column in `columns`: its cells summed over every person, printed whole or to one decimal. */
function sumItems(table: PrintedTable, columns: number[], print: (n: number) => string): Item[] {
  return columns.map((column) => {
    const value = table.rows
      .filter((row) => !isTotal(row))
      .reduce((sum, row) => sum + (numberIn(row[column]?.text ?? '') ?? 0), 0);
    return { name: table.header[column]?.label ?? '', value, shown: print(value) };
  });
}

/** The columns after the name, up to `end` from the right; `recorded` leaves out a column with no digit (a month with no records). */
const columnsOf = (table: PrintedTable, end: number, recorded = false) =>
  table.header
    .map((_, at) => at)
    .slice(1, table.header.length - end)
    .filter((at) => !recorded || table.rows.some((row) => /\d/.test(row[at]?.text ?? '')));

/** One kit line per section, over every row of its table (ADR 0035); null when the engine printed no such table. */
function takeawaysOf(tables: PrintedTable[], halves: readonly string[], t: TFunction): Takeaways {
  const say_ = (key: string) => t(key) as string;
  const items: Record<string, (table: PrintedTable) => Item[]> = {
    people: (table) => peopleItems(table, COL.hours),
    'pm-jobs': (table) => peopleItems(table, table.header.length - 1),
    'pm-hours': (table) => peopleItems(table, table.header.length - 1),
    specialization: (table) => sumItems(table, columnsOf(table, 0), whole),
    'monthly-count': (table) => sumItems(table, columnsOf(table, 1, true), whole),
    'monthly-hours': (table) => sumItems(table, columnsOf(table, 1, true), oneDecimal),
  };
  return Object.fromEntries(
    Object.entries(items).map(([id, itemsOf]) => {
      const table = tables.find((candidate) => sectionOf(candidate.title, halves) === id);
      const meaning: Meaning = id.startsWith('monthly') ? { worse: 'high' } : MEANING;
      return [id, table ? takeawayFor(itemsOf(table), meaning, say_) : null];
    }),
  );
}

/** A figure's yardstick (ADR 0035): the average per member and per breakdown, and the share of members who are the team. */
function figuresOfPage(page: Page, tables: PrintedTable[], t: TFunction) {
  const read = (label: string) => numberIn(kpiOf(page, label)?.value ?? '');
  const [breakdowns, hours, tracked] = [
    read('Total Breakdowns'),
    read('Total BD Hours'),
    read('Team Members Tracked'),
  ];
  const average = (n: number | null, by: number | null, digits: number) =>
    n === null || !by
      ? undefined
      : fill(t('insight.yardstick.average'), { value: (n / by).toFixed(digits) });
  const team = tables
    .find((table) => table.title === TABLE)
    ?.rows.filter((row) => row[COL.type]?.text === 'Team').length;
  const share =
    team === undefined || !tracked
      ? undefined
      : fill(t('insight.yardstick.share'), {
          pct: Math.round((team / tracked) * 100),
          total: whole(tracked),
        });
  const yardsticks: Record<string, string | undefined> = {
    'Total Breakdowns': average(breakdowns, tracked, 1),
    'Total BD Hours': average(hours, breakdowns, 2),
    'Team Members Tracked': share,
  };
  return figuresOf(page.kpis).map((figure) => {
    const yardstick = yardsticks[figure.label];
    return yardstick ? { ...figure, yardstick } : figure;
  });
}

/**
 * The Manpower model from the engine's reply: the page of the `a4-manpower` figure, whole. Its three figures, chart
 * and five tables are kept as printed (the PM matrix's paired rows become one table for jobs and one for hours); a
 * person is a chip. The answer is the person who handled the most breakdowns, read from the printed table.
 */
export function manpowerModel(reply: FiguresPart, t: TFunction): ManpowerModel | null {
  const page = pageOf(figureOf(reply, FIGURE), t);
  if (page === null) return null;
  const words = pageWords(t, 'v2r.mp.source');
  const say_: Translate = (key, values) => t(key, { ...values }) as string;
  const source = fill(words.source, { date: shortDate(reply.asOf) });
  const table = byTitle(page, TABLE);
  const [most, hours] = [rowWithMost(table, COL.done), rowWithMost(table, COL.hours)];
  const [total, tracked, all] = [
    kpiOf(page, 'Total Breakdowns'),
    kpiOf(page, 'Team Members Tracked'),
    kpiOf(page, 'Total BD Hours'),
  ];
  const tables = tablesOf(page.tables, words, (t) =>
    t.title === TABLE ? chipsOf(t, COL.type, TYPE_CHIPS, words.all) : [],
  );
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
    figures: figuresOfPage(page, tables, t),
    charts: page.charts.map((spec) => chartOf(spec, words)),
    tables,
    takeaways: takeawaysOf(tables, words.pair.fallback, t),
    drill: drillFor(reply, FIGURE, say_),
    source,
    words,
    specialization: {
      table: SPECIALIZATION,
      toggle: t('analytics.specialization.toggle'),
      category: t('analytics.specialization.category'),
      code: t('analytics.specialization.code'),
      notComputed: t('analytics.notComputed'),
    },
  };
}
