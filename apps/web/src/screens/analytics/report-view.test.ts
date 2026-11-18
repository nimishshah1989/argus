import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { TFunction } from 'i18next';
import type { FiguresReply } from '@uptimo/shared/analytics';
import { en, gu, type MessageKey } from '@uptimo/shared/i18n';
import type { ChartSpec } from '../../ui/chart/use-chart.js';
import { reportPeriodLine, reportView, type ReportView } from './report-view.js';

/**
 * The two report screens' mapping (packet 45e), pinned against the frozen 11 November monthly and annual keys:
 * every table cell, caption and row count, both chart series of each report, the period line, and the rule that
 * the face adds no number the figure does not carry. The keys are read as data, never copied into this file.
 */

interface KeyTable {
  title: string;
  header: string[];
  rows: string[][];
  rowCount: number;
}

interface KeyChart {
  id: string;
  labels: (string | number)[];
  datasets: { label: string; data: (number | null)[] }[];
}

interface KeyPage {
  page: string;
  title: string;
  kpis: unknown[];
  tables: KeyTable[];
  charts: KeyChart[];
}

interface KeyFile {
  screen: string;
  asOf: string;
  pages: KeyPage[];
}

type Figure = FiguresReply['figures'][number];
type Call = { key: string; values?: Record<string, unknown> };

const MONTHLY = keyOf('monthly-report');
const ANNUAL = keyOf('annual-report');

function keyOf(name: string): KeyFile {
  return JSON.parse(
    readFileSync(
      new URL(`../../../../../fixtures/answer-key/${name}.json`, import.meta.url),
      'utf8',
    ),
  ) as KeyFile;
}

function translator(): { t: TFunction; calls: Call[] } {
  const calls: Call[] = [];
  const t = ((key: string, values?: Record<string, unknown>) => {
    calls.push(values === undefined ? { key } : { key, values });
    const template = en[key as MessageKey] ?? key;
    return Object.entries(values ?? {}).reduce(
      (text, [name, value]) => text.replaceAll(`{{${name}}}`, String(value)),
      template,
    );
  }) as unknown as TFunction;
  return { t, calls };
}

function figure(key: string, value: unknown, status: 'ready' | 'not_computed' = 'ready'): Figure {
  return { key, screen: key, owner: 45, status, value, drill: { type: 'ticket', ids: [] } };
}

/** The chart's series as the page mapper prints them: a null gap stays a gap, never a zero. */
function seriesOf(chart: KeyChart): { name: string; values: (number | undefined)[] }[] {
  return chart.datasets.map((dataset) => ({
    name: dataset.label,
    values: dataset.data.map((value) => (value === null ? undefined : value)),
  }));
}

/** The keys' tables as the face prints them: the same cells, no truncation flag and no sort flag. */
function expectedTables(page: KeyPage, caption: string): unknown[] {
  return page.tables.map((table) => ({
    header: table.header,
    rows: table.rows,
    rowCount: table.rowCount,
    truncated: false,
    title: table.title === '' ? caption : table.title,
  }));
}

/** Every number the face prints from the figure: cells, headers, chart categories and chart values. */
function printedNumbers(view: Extract<ReportView, { state: 'ready' }>): string[] {
  const seriesOfSpec = (spec: ChartSpec): { values: (number | undefined)[] }[] => {
    if (spec.kind === 'scatter') return [];
    if (spec.kind === 'mixed')
      return [...spec.bars, ...(spec.line === undefined ? [] : [spec.line])];
    return spec.series;
  };
  const categoriesOfSpec = (spec: ChartSpec): string[] =>
    spec.kind === 'scatter' ? [] : spec.categories;
  const printed = [
    ...view.content.tables.flatMap((table) => [...table.header, ...table.rows.flat()]),
    ...view.content.charts.flatMap((spec) => [
      ...categoriesOfSpec(spec),
      ...seriesOfSpec(spec).flatMap((series) =>
        series.values.map((value) => (value === undefined ? '' : String(value))),
      ),
    ]),
    view.period,
  ];
  return printed.join(' ').match(/\d+(?:\.\d+)?/g) ?? [];
}

function ready(view: ReportView): Extract<ReportView, { state: 'ready' }> {
  if (view.state !== 'ready') throw new Error(`expected a ready report, got ${view.state}`);
  return view;
}

describe('the monthly report screen', () => {
  const page = MONTHLY.pages[0]!;

  it('maps the key page whole: no KPIs, all eight tables in the key order and both charts', () => {
    const { t } = translator();
    const view = ready(reportView(figure('monthly-report', MONTHLY), 'monthly', MONTHLY.asOf, t));
    expect(view.period).toBe('October 2026');
    expect(view.content.title).toBe(page.title);
    expect(view.content.kpis).toEqual([]);
    expect(view.content.tables).toEqual(expectedTables(page, 'Management commentary and actions'));
    expect(view.content.tables).toHaveLength(8);
    expect(view.content.charts).toHaveLength(2);
  });

  it('pins every row count, the untitled commentary caption and that no table is sortable', () => {
    const { t } = translator();
    const view = ready(reportView(figure('monthly-report', MONTHLY), 'monthly', MONTHLY.asOf, t));
    expect(view.content.tables.map((table) => table.rowCount)).toEqual([5, 9, 5, 6, 10, 13, 15, 5]);
    expect(view.content.tables.map((table) => table.rows.length)).toEqual([
      5, 9, 5, 6, 10, 13, 15, 5,
    ]);
    expect(page.tables[7]!.title).toBe('');
    expect(view.content.tables[7]!.title).toBe('Management commentary and actions');
    expect(view.content.tables[7]!.header).toEqual(['Action', 'Owner', 'Due date']);
    expect(view.content.tables[7]!.rows).toEqual(Array.from({ length: 5 }, () => ['', '', '']));
    for (const table of view.content.tables) expect(table.sortable).toBeUndefined();
  });

  it('pins the first machine row and the machine, cell, category and code cells against the key', () => {
    const { t } = translator();
    const view = ready(reportView(figure('monthly-report', MONTHLY), 'monthly', MONTHLY.asOf, t));
    expect(view.content.tables[0]!.rows[0]).toEqual([
      'VC-16 CVM1160',
      '9',
      '25.9',
      '7.9',
      '▲ 18.0',
    ]);
    expect(view.content.tables[1]!.rows[0]![0]).toBe('Cell 2');
    expect(view.content.tables[2]!.rows[0]![0]).toBe('Vertical Machining Center');
    expect(view.content.tables[3]!.rows[0]![0]).toBe('M Mechanical');
    expect(view.content.tables[5]!.rows[0]![0]).toBe('Person 11');
  });

  it('pins both chart series: the daily three-line chart and the ten-month chart', () => {
    const { t } = translator();
    const [daily, months] = page.charts;
    const view = ready(reportView(figure('monthly-report', MONTHLY), 'monthly', MONTHLY.asOf, t));
    expect(view.content.charts).toEqual([
      {
        kind: 'line',
        title: 'Breakdowns and hours, day by day',
        categoryLabel: 'Day',
        categories: daily!.labels.map(String),
        series: seriesOf(daily!),
      },
      {
        kind: 'line',
        title: 'Breakdowns and hours, month by month',
        categoryLabel: 'Month',
        categories: months!.labels.map(String),
        series: seriesOf(months!),
        secondAxis: true,
      },
    ]);
    expect(daily!.labels).toHaveLength(31);
    expect(daily!.datasets).toHaveLength(3);
    expect(daily!.datasets[2]!.data.at(-1)).toBeNull();
    expect(months!.labels).toEqual([
      'Jan 26',
      'Feb 26',
      'Mar 26',
      'Apr 26',
      'May 26',
      'Jun 26',
      'Jul 26',
      'Aug 26',
      'Sep 26',
      'Oct 26',
    ]);
  });
});

describe('the annual report screen', () => {
  const page = ANNUAL.pages[0]!;

  it('maps the key page whole: no KPIs, all twelve tables in the key order and both charts', () => {
    const { t } = translator();
    const view = ready(reportView(figure('annual-report', ANNUAL), 'annual', ANNUAL.asOf, t));
    expect(view.period).toBe('2026 to 11 November');
    expect(view.content.title).toBe(page.title);
    expect(view.content.kpis).toEqual([]);
    expect(view.content.tables).toEqual(expectedTables(page, 'Management commentary and actions'));
    expect(view.content.tables).toHaveLength(12);
    expect(view.content.charts).toHaveLength(2);
  });

  it('pins every row count, the untitled commentary caption and that no table is sortable', () => {
    const { t } = translator();
    const view = ready(reportView(figure('annual-report', ANNUAL), 'annual', ANNUAL.asOf, t));
    expect(view.content.tables.map((table) => table.rowCount)).toEqual([
      11, 4, 10, 9, 8, 13, 5, 8, 11, 8, 15, 5,
    ]);
    expect(view.content.tables.map((table) => table.rows.length)).toEqual([
      11, 4, 10, 9, 8, 13, 5, 8, 11, 8, 15, 5,
    ]);
    expect(page.tables[11]!.title).toBe('');
    expect(view.content.tables[11]!.title).toBe('Management commentary and actions');
    for (const table of view.content.tables) expect(table.sortable).toBeUndefined();
  });

  it('pins the Months-in-top-5 row and the month-by-month cells against the key', () => {
    const { t } = translator();
    const view = ready(reportView(figure('annual-report', ANNUAL), 'annual', ANNUAL.asOf, t));
    const top = view.content.tables[2]!;
    expect(top.header).toEqual([
      '#',
      'Machine',
      'Category',
      'Age',
      'Cell',
      'Breakdowns',
      'Hours',
      'Share',
      'Cumulative',
      'Months in top 5',
    ]);
    expect(top.rows[0]).toEqual([
      '1',
      'TMC-2 SL30MC',
      'Turnmill',
      '9y',
      '2',
      '20',
      '307.6',
      '10.1%',
      '10.1%',
      '3',
    ]);
    expect(view.content.tables[0]!.rows[10]).toEqual([
      'November (to date)',
      '58',
      '51.1',
      '▼ 80%',
      '0.88',
      '0.22%',
      '5.3',
      '99.75%',
    ]);
  });

  it('pins both chart series: the starred month chart and the Pareto bars with its cumulative line', () => {
    const { t } = translator();
    const [months, pareto] = page.charts;
    const view = ready(reportView(figure('annual-report', ANNUAL), 'annual', ANNUAL.asOf, t));
    const series = seriesOf(pareto!);
    expect(view.content.charts).toEqual([
      {
        kind: 'line',
        title: 'Breakdowns and hours, month by month this year',
        categoryLabel: 'Month',
        categories: months!.labels,
        series: seriesOf(months!),
        secondAxis: true,
      },
      {
        kind: 'mixed',
        title: 'Where the downtime comes from',
        categoryLabel: 'Machine',
        categories: pareto!.labels,
        bars: [series[0]!],
        line: series[1]!,
      },
    ]);
    expect(months!.labels.at(-1)).toBe('Nov*');
    expect(pareto!.labels).toHaveLength(15);
  });
});

describe('the report screen adds no number the figure does not carry', () => {
  it.each([
    ['monthly', MONTHLY, 'monthly'],
    ['annual', ANNUAL, 'annual'],
  ] as const)('every number in the %s view is in its key', (_name, key, kind) => {
    const { t } = translator();
    const view = ready(reportView(figure(key.screen, key), kind, key.asOf, t));
    expect(view.content.kpis).toEqual([]);
    const source = JSON.stringify(key);
    for (const token of printedNumbers(view)) expect(source, token).toContain(token);
  });
});

describe('the period line and the honest states', () => {
  it('derives the period from the figure’s own as-of, by the figure’s own rule', () => {
    const { t } = translator();
    expect(reportPeriodLine('monthly', '2026-11-11', t)).toBe('October 2026');
    expect(reportPeriodLine('monthly', '2026-01-05', t)).toBe('December 2025');
    expect(reportPeriodLine('annual', '2026-11-11', t)).toBe('2026 to 11 November');
    const value = { ...MONTHLY, asOf: '2026-11-11' };
    const view = reportView(figure('monthly-report', value), 'monthly', '2026-12-20', t);
    expect(view.period).toBe('October 2026');
  });

  it('prints the empty-report line for a null value and keeps the period line', () => {
    const { t } = translator();
    expect(reportView(figure('monthly-report', null), 'monthly', MONTHLY.asOf, t)).toEqual({
      state: 'empty',
      period: 'October 2026',
    });
    expect(reportView(figure('annual-report', null), 'annual', ANNUAL.asOf, t)).toEqual({
      state: 'empty',
      period: '2026 to 11 November',
    });
  });

  it('keeps the honest not-computed line for a missing, uncomputed or undrawable figure', () => {
    const { t } = translator();
    expect(reportView(undefined, 'monthly', MONTHLY.asOf, t).state).toBe('notComputed');
    expect(
      reportView(figure('monthly-report', MONTHLY, 'not_computed'), 'monthly', MONTHLY.asOf, t)
        .state,
    ).toBe('notComputed');
    expect(
      reportView(figure('monthly-report', { pages: [] }), 'monthly', MONTHLY.asOf, t).state,
    ).toBe('notComputed');
    expect(reportView(figure('monthly-report', 42), 'monthly', MONTHLY.asOf, t).state).toBe(
      'notComputed',
    );
    expect(reportView(undefined, 'annual', ANNUAL.asOf, t).period).toBe('2026 to 11 November');
  });
});

describe('the 45e copy catalogue', () => {
  it('names every new chrome string in both catalogues', () => {
    const keys: MessageKey[] = [
      'analytics.report.nav',
      'analytics.report.downloadPdf',
      'analytics.report.downloadWorkbook',
      'analytics.report.commentary',
      'analytics.report.periodMonthly',
      'analytics.report.periodAnnual',
      'analytics.report.empty',
      'analytics.content.report.dailyChart',
      'analytics.content.report.monthsChart',
      'analytics.content.report.yearMonthsChart',
      'analytics.content.report.paretoChart',
      'analytics.content.report.dayAxis',
      'analytics.content.report.monthAxis',
      'analytics.content.report.machineAxis',
    ];
    for (const key of keys) {
      expect(en[key], key).toBeTruthy();
      expect(gu, key).toHaveProperty(key);
    }
  });
});
