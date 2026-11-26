import type { TFunction } from 'i18next';
import { fill } from '../../../i18n/fill.js';
import type { TakeawayData, TakeawayTone, Takeaways } from '../../../ui/v2/takeaway.js';
import type { PageTable } from '../../analytics/page-content.js';
import type { Translate } from '../figures/read.js';
import { tagOf } from '../insight.js';
import { chartOf, figuresOf, tablesOf } from '../printed-page/page-model.js';
import { figureOf, numberValue, pageOf, shortDate } from '../printed-page/printed.js';
import type { FiguresPart, Page } from '../printed-page/printed.js';
import { printedTable } from '../printed-page/table.js';
import { say as sayPoint, strong } from '../printed-page/segs.js';
import { verdictOf } from '../printed-page/verdict.js';
import { pageWords } from '../printed-page/words.js';
import { drillFor } from '../rows-behind/drill.js';
import type { MonthlyReportModel } from './model.js';

/** The engine's figure this screen is built from. */
export const FIGURE = 'monthly-report';

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const PLANT_DATE = /^\d{4}-\d{2}-\d{2}$/;
const RANKED = 'Where the time went';

/** The calendar month `back` months before the run month (1 is the report's month), as the engine's `monthlyPeriod` counts. */
function monthBefore(asOf: string, back: number): { year: number; month: number } {
  const [year = 0, month = 1] = asOf.split('-').map(Number);
  const index = year * 12 + month - 1 - back;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

/** The figure's own `asOf` when it carries one (the period it was computed for), else the reply's. */
function asOfOf(reply: FiguresPart): string {
  const value = figureOf(reply, FIGURE)?.value as { asOf?: unknown } | undefined;
  return typeof value?.asOf === 'string' && PLANT_DATE.test(value.asOf) ? value.asOf : reply.asOf;
}

/** The section id of a printed table (ADR 0035): the four rankings by their first column; '' for the blank form. */
export function sectionOf(title: string, firstColumn = ''): string {
  const first = firstColumn.toLowerCase();
  if (title === RANKED) return ['machine', 'cell', 'category', 'code'].includes(first) ? first : '';
  if (title.startsWith('Longest breakdowns')) return 'longest';
  if (title === 'Maintenance team') return 'team';
  return title === 'Machines added' ? 'added' : '';
}

const column = (table: PageTable, label: string): number =>
  table.header.findIndex((h) => h.trim().toLowerCase() === label.toLowerCase());

const hoursOf = (value: number | undefined): string => (value ?? 0).toFixed(1);

/** A line series' values as numbers (a gap is 0), and its categories. */
function seriesOf(page: Page, at: number, index: number): number[] {
  const spec = page.charts[at];
  return spec?.kind === 'line' ? (spec.series[index]?.values.map((v) => v ?? 0) ?? []) : [];
}

const largest = (values: number[]): number =>
  values.reduce((best, value, at) => (value > (values[best] ?? -Infinity) ? at : best), 0);

const labelsOf = (page: Page): string[] =>
  page.charts[1]?.kind === 'line' ? page.charts[1].categories : [];

type Say = (
  key: string,
  values: Record<string, string | number>,
  tone: TakeawayTone,
) => TakeawayData;

const cell = (row: string[] | undefined, at: number): string => row?.[at] ?? '';

/** The row with the largest number in column `at`. */
const topRow = (rows: string[][], at: number): string[] | undefined =>
  rows.reduce<string[] | undefined>(
    (best, row) => (!best || numberValue(cell(row, at)) > numberValue(cell(best, at)) ? row : best),
    undefined,
  );

/** The day that lost the most hours and the worst month of the twelve. */
function chartLines(page: Page, month: string, say: Say): Takeaways {
  const [dayHours, dayCounts] = [seriesOf(page, 0, 1), seriesOf(page, 0, 0)];
  const day = largest(dayHours);
  const monthHours = seriesOf(page, 1, 1);
  const worst = largest(monthHours);
  const daily = {
    day: day + 1,
    month: month.slice(0, 3),
    hours: hoursOf(dayHours[day]),
    n: dayCounts[day] ?? 0,
  };
  const months = { month: labelsOf(page)[worst] ?? '', hours: hoursOf(monthHours[worst]) };
  return {
    daily: dayHours.length > 0 ? say('monthly-report.daily', daily, 'loss') : null,
    months: monthHours.length > 0 ? say('monthly-report.months', months, 'loss') : null,
  };
}

/** A ranking's first row (the engine ranks by hours), toned by its change on the month before. */
function rankLine(table: PageTable | undefined, previous: string, say: Say): TakeawayData | null {
  const row = table?.rows[0];
  if (!row) return null;
  const change = cell(row, 4);
  const tone = change.startsWith('▼') ? 'gain' : change.startsWith('▲') ? 'loss' : 'neutral';
  const values = { name: cell(row, 0), hours: cell(row, 2), change, previous };
  return say('monthly-report.rank', values, tone);
}

function longestLine(table: PageTable | undefined, say: Say): TakeawayData | null {
  const [first, second] = table?.rows ?? [];
  if (!first) return null;
  const values = {
    machine: cell(first, 1),
    date: shortDate(cell(first, 0)),
    hours: cell(first, 5),
    times: (numberValue(cell(first, 5)) / numberValue(cell(second, 5))).toFixed(1),
  };
  return say(second ? 'monthly-report.longest' : 'monthly-report.longestOnly', values, 'loss');
}

function teamLine(table: PageTable | undefined, say: Say): TakeawayData | null {
  const share = table ? column(table, 'Share') : -1;
  const top = share >= 0 ? topRow(table?.rows ?? [], share) : undefined;
  if (!top) return null;
  return say('monthly-report.team', { name: cell(top, 0), share: cell(top, share) }, 'risk');
}

function addedLine(table: PageTable | undefined, say: Say): TakeawayData | null {
  const count = table ? column(table, 'Added this period') : -1;
  if (!table || count < 0) return null;
  // The engine closes this table with its own "Total CNC machines" row: not a category, and not to be summed twice.
  const categories = table.rows.filter((row) => !cell(row, 0).startsWith('Total'));
  const n = categories.reduce((sum, row) => sum + Math.max(0, numberValue(cell(row, count))), 0);
  const most = topRow(categories, count);
  if (!most || n === 0) return null;
  const values = { n, category: cell(most, 0), most: cell(most, count) };
  return say('monthly-report.added', values, 'neutral');
}

function takeawaysOf(page: Page, tables: PageTable[], asOf: string, t: TFunction): Takeaways {
  const tagWord = (key: string) => t(key) as string;
  const say: Say = (key, values, tone) => ({
    text: fill(t(key) as string, values),
    tone,
    tag: tagOf(tone, tagWord),
  });
  const month = MONTHS[monthBefore(asOf, 1).month - 1] ?? '';
  const previous = MONTHS[monthBefore(asOf, 2).month - 1] ?? '';
  const named = (id: string) =>
    tables.find((table) => sectionOf(table.title, table.header[0]) === id);
  const out: Takeaways = chartLines(page, month, say);
  for (const id of ['machine', 'cell', 'category', 'code'])
    out[id] = rankLine(named(id), previous, say);
  out.longest = longestLine(named('longest'), say);
  out.team = teamLine(named('team'), say);
  out.added = addedLine(named('added'), say);
  return out;
}

/** The month's breakdowns and hours, then the month against the one before it. */
function verdictFor(page: Page, t: TFunction, period: string, month: string) {
  const months = seriesOf(page, 1, 1);
  const [now, before] = [months.at(-1), months.at(-2)];
  const headline = sayPoint(t('monthly-report.headline') as string, {
    period,
    n: strong(String(seriesOf(page, 0, 0).reduce((sum, n) => sum + n, 0))),
    hours: strong(hoursOf(seriesOf(page, 0, 1).reduce((sum, h) => sum + h, 0))),
  });
  const against =
    now !== undefined && before !== undefined
      ? sayPoint(t('monthly-report.against') as string, {
          month,
          hours: hoursOf(now),
          before: hoursOf(before),
          previous: labelsOf(page).at(-2) ?? '',
        })
      : null;
  return (source: string) => verdictOf(headline, [against], source);
}

/**
 * The Monthly Report from the engine's `monthly-report` figure, whole (2 charts, 8 tables), with the period line, the
 * two downloads and one takeaway per section (ticket 763). The untitled table is the blank commentary form: captioned, kept
 * with its empty columns, and with no takeaway. Null when the engine has no page.
 */
export function monthlyReportModel(reply: FiguresPart, t: TFunction): MonthlyReportModel | null {
  const page = pageOf(figureOf(reply, FIGURE), t);
  if (page === null) return null;
  const words = pageWords(t, 'monthly-report.source');
  const say_: Translate = (key, values) => t(key, { ...values }) as string;
  const asOf = asOfOf(reply);
  const { year, month: at } = monthBefore(asOf, 1);
  const period = t('analytics.report.periodMonthly', {
    month: MONTHS[at - 1] ?? '',
    year,
  }) as string;
  const caption = t('analytics.report.commentary') as string;
  const tables = page.tables.map((table) =>
    table.title === '' ? { ...table, title: caption } : table,
  );
  const source = fill(words.source, { date: shortDate(reply.asOf) });

  return {
    verdict: verdictFor(page, t, period, MONTHS[at - 1] ?? '')(source),
    figures: figuresOf(page.kpis),
    // The daily chart's id carries its month ("2026-10"), which the View needs to lay the days out as a calendar.
    charts: page.charts.map((spec, i) => {
      const chart = chartOf(spec, words);
      return i === 0
        ? { ...chart, id: `${chart.id}|${year}-${String(at).padStart(2, '0')}` }
        : chart;
    }),
    tables: tables.flatMap((table) =>
      table.title === caption
        ? [
            printedTable(
              table,
              [],
              table.header.map((_, i) => i),
            ),
          ]
        : tablesOf([table], words),
    ),
    drill: drillFor(reply, FIGURE, say_),
    source,
    words,
    period,
    links: [
      { href: '/api/v1/reports/monthly.pdf', label: t('analytics.report.downloadPdf') as string },
      {
        href: '/api/v1/reports/workbook.xlsx',
        label: t('analytics.report.downloadWorkbook') as string,
      },
    ],
    takeaways: takeawaysOf(page, tables, asOf, t),
  };
}
