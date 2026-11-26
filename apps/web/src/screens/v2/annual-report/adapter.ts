import type { TFunction } from 'i18next';
import { fill } from '../../../i18n/fill.js';
import type { TakeawayData, TakeawayTone, Takeaways } from '../../../ui/v2/takeaway.js';
import type { PageTable } from '../../analytics/page-content.js';
import type { Translate } from '../figures/read.js';
import { tagOf } from '../insight.js';
import { annualPeriod, asOfOf } from '../monthly-report/adapter.js';
import { chartOf, figuresOf, tablesOf } from '../printed-page/page-model.js';
import { figureOf, numberValue, pageOf, shortDate } from '../printed-page/printed.js';
import type { FiguresPart, Page } from '../printed-page/printed.js';
import { printedTable } from '../printed-page/table.js';
import { say as sayPoint, strong } from '../printed-page/segs.js';
import { verdictOf } from '../printed-page/verdict.js';
import { pageWords } from '../printed-page/words.js';
import { drillFor } from '../rows-behind/drill.js';
import type { AnnualReportModel } from './model.js';

/** The engine's figure this screen is built from. */
export const FIGURE = 'annual-report';

const RANKED = 'Where the downtime comes from';
const PM_AND_LONG = 'Preventive maintenance and long breakdowns';
const BY_TITLE: Record<string, string> = {
  'Month by month': 'months',
  'Quarter by quarter': 'quarters',
  [RANKED]: 'machines',
  'By cell': 'cells',
  'By cause': 'causes',
  'Machine categories — reliability': 'categories',
  'Machine age': 'age',
  'Maintenance team': 'team',
  'Machines added month by month': 'added',
};

/**
 * The section id of a printed table (ADR 0035): its engine title, except that the PM table and the long-breakdowns
 * table share one, and the blank form (first column "Action") is the commentary.
 */
export function sectionOf(title: string, firstColumn = ''): string {
  const first = firstColumn.toLowerCase();
  if (title === PM_AND_LONG) return first === 'month' ? 'pm' : 'long';
  return first === 'action' ? 'commentary' : (BY_TITLE[title] ?? '');
}

const column = (table: PageTable, label: string): number =>
  table.header.findIndex((h) => h.trim().toLowerCase() === label.toLowerCase());

const cell = (row: string[] | undefined, at: number): string => row?.[at] ?? '';

/** The row with the largest number in the column called `label`. */
function topRow(table: PageTable | undefined, label: string): string[] | undefined {
  const at = table ? column(table, label) : -1;
  return at < 0
    ? undefined
    : table?.rows.reduce<string[] | undefined>(
        (best, row) =>
          !best || numberValue(cell(row, at)) > numberValue(cell(best, at)) ? row : best,
        undefined,
      );
}

type Say = (
  key: string,
  values: Record<string, string | number>,
  tone: TakeawayTone,
) => TakeawayData;

/** A takeaway that names the row with the most `measure`: the sentence `key`, its words read from these columns. */
type Most = { measure: string; key: string; tone: TakeawayTone; words: Record<string, string> };

const PER_MACHINE = 'Hrs / machine';
const HOURS = 'Downtime hrs';
const MOST: Record<string, Most> = {
  months: {
    measure: HOURS,
    key: 'annual-report.months',
    tone: 'loss',
    words: { month: 'Month', hours: HOURS },
  },
  quarters: {
    measure: HOURS,
    key: 'annual-report.quarters',
    tone: 'loss',
    words: { quarter: 'Quarter', hours: HOURS },
  },
  cells: {
    measure: PER_MACHINE,
    key: 'annual-report.cells',
    tone: 'risk',
    words: { cell: 'Cell', hours: PER_MACHINE },
  },
  categories: {
    measure: PER_MACHINE,
    key: 'annual-report.categories',
    tone: 'risk',
    words: { category: 'Category', hours: PER_MACHINE },
  },
  age: {
    measure: PER_MACHINE,
    key: 'annual-report.age',
    tone: 'risk',
    words: { band: 'Age band', hours: PER_MACHINE },
  },
};

function mostLine(table: PageTable | undefined, spec: Most, say: Say): TakeawayData | null {
  const row = topRow(table, spec.measure);
  if (!table || !row) return null;
  const values = Object.fromEntries(
    Object.entries(spec.words).map(([name, label]) => [name, cell(row, column(table, label))]),
  );
  return say(spec.key, values, spec.tone);
}

function machinesLine(table: PageTable | undefined, say: Say): TakeawayData | null {
  if (!table || table.rows.length === 0) return null;
  const [first, last] = [table.rows[0], table.rows.at(-1)];
  const values = {
    machine: cell(first, column(table, 'Machine')),
    hours: cell(first, column(table, 'Hours')),
    share: cell(first, column(table, 'Share')),
    n: table.rows.length,
    cum: cell(last, column(table, 'Cumulative')),
  };
  return say('annual-report.machines', values, 'loss');
}

function causesLine(table: PageTable | undefined, say: Say): TakeawayData | null {
  const row = table?.rows[0];
  if (!table || !row) return null;
  const values = {
    code: cell(row, 0),
    hours: cell(row, column(table, 'Hours')),
    share: cell(row, column(table, 'Share')),
  };
  return say('annual-report.causes', values, 'loss');
}

function teamLine(table: PageTable | undefined, say: Say): TakeawayData | null {
  const row = table?.rows[0];
  if (!table || !row) return null;
  const values = { name: cell(row, 0), n: cell(row, column(table, 'Breakdowns')) };
  return say('annual-report.team', values, 'risk');
}

function pmLine(table: PageTable | undefined, say: Say): TakeawayData | null {
  const top = topRow(table, 'PM hours');
  if (!table || !top) return null;
  const entries = column(table, 'PM entries');
  const none = table.rows.filter((row) => numberValue(cell(row, entries)) === 0).length;
  const values = {
    month: cell(top, 0),
    hours: cell(top, column(table, 'PM hours')),
    none,
  };
  return say('annual-report.pm', values, none > 0 ? 'risk' : 'neutral');
}

function longLine(table: PageTable | undefined, say: Say): TakeawayData | null {
  const [first, second] = table?.rows ?? [];
  if (!table || !first) return null;
  const hours = column(table, 'Hours');
  const values = {
    machine: cell(first, column(table, 'Machine')),
    date: shortDate(cell(first, column(table, 'Date'))),
    hours: cell(first, hours),
    times: (numberValue(cell(first, hours)) / numberValue(cell(second, hours))).toFixed(1),
  };
  const key = second ? 'monthly-report.longest' : 'monthly-report.longestOnly';
  return say(key, values, 'loss');
}

function addedLine(table: PageTable | undefined, say: Say): TakeawayData | null {
  const added = table ? column(table, 'Added') : -1;
  if (!table || added < 0) return null;
  // The engine closes this table with its own "Total" row: the year's count, and not a category.
  const total = table.rows.find((row) => cell(row, 0) === 'Total');
  const categories = { ...table, rows: table.rows.filter((row) => cell(row, 0) !== 'Total') };
  const most = topRow(categories, 'Added');
  if (!total || !most) return null;
  const values = { n: cell(total, added), category: cell(most, 0), most: cell(most, added) };
  return say('annual-report.added', values, 'neutral');
}

function takeawaysOf(tables: PageTable[], t: TFunction): Takeaways {
  const say: Say = (key, values, tone) => ({
    text: fill(t(key) as string, values),
    tone,
    tag: tagOf(tone, (word) => t(word) as string),
  });
  const named = (id: string) =>
    tables.find((table) => sectionOf(table.title, table.header[0]) === id);
  const most = (id: string) => mostLine(named(id), MOST[id] as Most, say);
  return {
    months: most('months'),
    quarters: most('quarters'),
    machines: machinesLine(named('machines'), say),
    cells: most('cells'),
    causes: causesLine(named('causes'), say),
    categories: most('categories'),
    age: most('age'),
    team: teamLine(named('team'), say),
    pm: pmLine(named('pm'), say),
    long: longLine(named('long'), say),
    added: addedLine(named('added'), say),
  };
}

/** The year's breakdowns and hours, then the worst month and the costliest machine, all in one sentence. */
function verdictFor(
  page: Page,
  tables: PageTable[],
  t: TFunction,
  period: string,
): (source: string) => ReturnType<typeof verdictOf> {
  const named = (id: string) =>
    tables.find((table) => sectionOf(table.title, table.header[0]) === id);
  const months = named('months');
  const machines = named('machines');
  const line = page.charts[0]?.kind === 'line' ? page.charts[0].series : [];
  const sum = (values: readonly (number | null | undefined)[] | undefined) =>
    (values ?? []).reduce<number>((total, value) => total + (value ?? 0), 0);
  const worst = topRow(months, 'Downtime hrs');
  const costliest = machines?.rows[0];
  const headline = sayPoint(t('annual-report.headline') as string, {
    period,
    n: strong(sum(line[0]?.values).toLocaleString('en-IN')),
    hours: strong(
      sum(line[1]?.values).toLocaleString('en-IN', {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }),
    ),
    month: cell(worst, 0),
    monthHours: cell(worst, months ? column(months, 'Downtime hrs') : -1),
    machine: cell(costliest, machines ? column(machines, 'Machine') : -1),
    share: cell(costliest, machines ? column(machines, 'Share') : -1),
  });
  return (source: string) => verdictOf(headline, [], source);
}

/**
 * The Annual Report from the engine's `annual-report` figure, whole (2 charts, 12 tables), with the period line, the
 * two downloads and one takeaway per table section (#765). The untitled table is the blank commentary form: captioned,
 * kept with its empty columns, and with no takeaway. Null when the engine has no page.
 */
export function annualReportModel(reply: FiguresPart, t: TFunction): AnnualReportModel | null {
  const page = pageOf(figureOf(reply, FIGURE), t);
  if (page === null) return null;
  const words = pageWords(t, 'annual-report.source');
  const say_: Translate = (key, values) => t(key, { ...values }) as string;
  const period = annualPeriod(asOfOf(reply, FIGURE), t);
  const caption = t('analytics.report.commentary') as string;
  const tables = page.tables.map((table) =>
    table.title === '' ? { ...table, title: caption } : table,
  );
  const source = fill(words.source, { date: shortDate(reply.asOf) });

  return {
    verdict: verdictFor(page, tables, t, period)(source),
    figures: figuresOf(page.kpis),
    charts: page.charts.map((spec) => chartOf(spec, words)),
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
      { href: '/api/v1/reports/annual.pdf', label: t('analytics.report.downloadPdf') as string },
      {
        href: '/api/v1/reports/workbook.xlsx',
        label: t('analytics.report.downloadWorkbook') as string,
      },
    ],
    takeaways: takeawaysOf(tables, t),
  };
}
