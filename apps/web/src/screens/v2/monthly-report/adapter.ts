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

function takeawaysOf(page: Page, tables: PageTable[], asOf: string, t: TFunction): Takeaways {
  const tagWord = (key: string) => t(key) as string;
  const line = (
    key: string,
    values: Record<string, string | number>,
    tone: TakeawayTone,
  ): TakeawayData => ({
    text: fill(t(key) as string, values),
    tone,
    tag: tagOf(tone, tagWord),
  });
  const month = MONTHS[monthBefore(asOf, 1).month - 1] ?? '';
  const previous = MONTHS[monthBefore(asOf, 2).month - 1] ?? '';
  const out: Takeaways = {};
  const named = (id: string) =>
    tables.find((table) => sectionOf(table.title, table.header[0]) === id);

  const [dayHours, dayCounts] = [seriesOf(page, 0, 1), seriesOf(page, 0, 0)];
  const day = largest(dayHours);
  out.daily =
    dayHours.length > 0
      ? line(
          'monthly-report.daily',
          { day: day + 1, month: month.slice(0, 3), hours: hoursOf(dayHours[day]), n: dayCounts[day] ?? 0 },
          'loss',
        )
      : null;

  const monthHours = seriesOf(page, 1, 1);
  const worst = largest(monthHours);
  const labels = page.charts[1]?.kind === 'line' ? page.charts[1].categories : [];
  out.months =
    monthHours.length > 0
      ? line('monthly-report.months', { month: labels[worst] ?? '', hours: hoursOf(monthHours[worst]) }, 'loss')
      : null;

  for (const id of ['machine', 'cell', 'category', 'code']) {
    const [name, , hours, , change] = named(id)?.rows[0] ?? [];
    const tone = change?.startsWith('▼') ? 'gain' : change?.startsWith('▲') ? 'loss' : 'neutral';
    out[id] =
      name === undefined
        ? null
        : line('monthly-report.rank', { name, hours: hours ?? '', change: change ?? '', previous }, tone);
  }

  const longest = named('longest');
  const [first, second] = longest?.rows ?? [];
  out.longest = first
    ? line(
        second ? 'monthly-report.longest' : 'monthly-report.longestOnly',
        {
          machine: first[1] ?? '',
          date: shortDate(first[0] ?? ''),
          hours: first[5] ?? '',
          times: (numberValue(first[5] ?? '') / numberValue(second?.[5] ?? '')).toFixed(1),
        },
        'loss',
      )
    : null;

  const team = named('team');
  const share = team ? column(team, 'Share') : -1;
  const top = team?.rows.reduce<string[] | undefined>(
    (best, row) => (!best || numberValue(row[share] ?? '') > numberValue(best[share] ?? '') ? row : best),
    undefined,
  );
  out.team = top && share >= 0 ? line('monthly-report.team', { name: top[0] ?? '', share: top[share] ?? '' }, 'risk') : null;

  const added = named('added');
  const count = added ? column(added, 'Added this period') : -1;
  const total = added?.rows.reduce((sum, row) => sum + Math.max(0, numberValue(row[count] ?? '')), 0) ?? 0;
  const most = added?.rows.reduce<string[] | undefined>(
    (best, row) => (!best || numberValue(row[count] ?? '') > numberValue(best[count] ?? '') ? row : best),
    undefined,
  );
  out.added =
    most && count >= 0 && total > 0
      ? line('monthly-report.added', { n: total, category: most[0] ?? '', most: most[count] ?? '' }, 'neutral')
      : null;
  return out;
}

/**
 * The Monthly Report from the engine's `monthly-report` figure, whole (2 charts, 8 tables), with the period line, the
 * two downloads and one takeaway per section (#763). The untitled table is the blank commentary form: captioned, kept
 * with its empty columns, and with no takeaway. Null when the engine has no page.
 */
export function monthlyReportModel(reply: FiguresPart, t: TFunction): MonthlyReportModel | null {
  const page = pageOf(figureOf(reply, FIGURE), t);
  if (page === null) return null;
  const words = pageWords(t, 'monthly-report.source');
  const say_: Translate = (key, values) => t(key, { ...values }) as string;
  const asOf = asOfOf(reply);
  const { year, month: at } = monthBefore(asOf, 1);
  const period = t('analytics.report.periodMonthly', { month: MONTHS[at - 1] ?? '', year }) as string;
  const caption = t('analytics.report.commentary') as string;
  const tables = page.tables.map((table) => (table.title === '' ? { ...table, title: caption } : table));
  const source = fill(words.source, { date: shortDate(reply.asOf) });

  const months = seriesOf(page, 1, 1);
  const counts = seriesOf(page, 0, 0);
  const now = months.at(-1);
  const before = months.at(-2);
  const labels = page.charts[1]?.kind === 'line' ? page.charts[1].categories : [];
  const headline = sayPoint(t('monthly-report.headline') as string, {
    period,
    n: strong(String(counts.reduce((sum, n) => sum + n, 0))),
    hours: strong(hoursOf(seriesOf(page, 0, 1).reduce((sum, h) => sum + h, 0))),
  });
  const against =
    now !== undefined && before !== undefined
      ? sayPoint(t('monthly-report.against') as string, {
          month: MONTHS[at - 1] ?? '',
          hours: hoursOf(now),
          before: hoursOf(before),
          previous: labels.at(-2) ?? '',
        })
      : null;

  return {
    verdict: verdictOf(headline, [against], source),
    figures: figuresOf(page.kpis),
    // The daily chart's id carries its month ("2026-10"), which the View needs to lay the days out as a calendar.
    charts: page.charts.map((spec, i) => {
      const chart = chartOf(spec, words);
      return i === 0 ? { ...chart, id: `${chart.id}|${year}-${String(at).padStart(2, '0')}` } : chart;
    }),
    tables: tables.flatMap((table) =>
      table.title === caption
        ? [printedTable(table, [], table.header.map((_, i) => i))]
        : tablesOf([table], words),
    ),
    drill: drillFor(reply, FIGURE, say_),
    source,
    words,
    period,
    links: [
      { href: '/api/v1/reports/monthly.pdf', label: t('analytics.report.downloadPdf') as string },
      { href: '/api/v1/reports/workbook.xlsx', label: t('analytics.report.downloadWorkbook') as string },
    ],
    takeaways: takeawaysOf(page, tables, asOf, t),
  };
}
