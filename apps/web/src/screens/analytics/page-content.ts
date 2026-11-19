import type { TFunction } from 'i18next';
import type { MessageKey } from '@uptimo/shared/i18n';
import type { ChartSeries, ChartSpec } from '../../ui/chart/use-chart.js';
import { specialChart } from './forecast-charts.js';
import { screenChart } from './screen-charts.js';

/**
 * The key-shaped page (packets 40e-1 and 40e-2, extended by 41e-1 and 41e-2): the platform's own page, whole. The
 * log, A1, A2, A3, A4, A6 and A10 are pages, so one mapping turns the engine's KPIs, tables and charts into the
 * kit's pieces. A10's bubble is the one chart whose labels are not on the chart (the groups table carries them).
 * The page title, KPI labels, table titles and cells are the engine's printed data; the charts' titles and axes
 * are catalogue copy. Split from `figure-content.ts` when the two breakdown keys took the mapper towards the
 * 400-line hard limit.
 */

export interface PageKpi {
  label: string;
  value: string;
  sub: string | null;
}

export interface PageTable {
  title: string;
  header: string[];
  rows: string[][];
  rowCount: number;
  truncated: boolean;
  /** The face may sort this table client-side (41e-1: A4's Manpower table and its two month matrices). */
  sortable?: boolean;
  heat?: boolean;
}

export interface PageContent {
  kind: 'page';
  title: string;
  kpis: PageKpi[];
  tables: PageTable[];
  charts: ChartSpec[];
}

type ObjectValue = Record<string, unknown>;

const A1_CELL_AXIS = 'analytics.content.a1.cellAxis' satisfies MessageKey;
const A1_MONTH_AXIS = 'analytics.content.a1.trendAxis' satisfies MessageKey;
const CATEGORY_AXIS = 'analytics.content.a2.categoryAxis' satisfies MessageKey;
const CELL_AXIS = 'analytics.content.a2.cellAxis' satisfies MessageKey;
const AGE_AXIS = 'analytics.content.a3.ageAxis' satisfies MessageKey;
const MONTH_AXIS = 'analytics.content.a3.monthAxis' satisfies MessageKey;
const PERSON_AXIS = 'analytics.content.a4.personAxis' satisfies MessageKey;
const A10_GROUP = 'analytics.content.a10.groupLabel' satisfies MessageKey;
const A10_HOURS = 'analytics.content.a10.hours' satisfies MessageKey;
const RP_DAILY = 'analytics.content.report.dailyChart' satisfies MessageKey;
const RP_MONTHS = 'analytics.content.report.monthsChart' satisfies MessageKey;
const RY_MONTHS = 'analytics.content.report.yearMonthsChart' satisfies MessageKey;
const RY_PARETO = 'analytics.content.report.paretoChart' satisfies MessageKey;
const REPORT_DAY = 'analytics.content.report.dayAxis' satisfies MessageKey;
const REPORT_MONTH = 'analytics.content.report.monthAxis' satisfies MessageKey;
const REPORT_MACHINE = 'analytics.content.report.machineAxis' satisfies MessageKey;

/**
 * The A4 tables the face sorts (41e-1): the Manpower table and the two breakdown month matrices. The PM table
 * keeps its paired count/hours rows and the Specialization card owns its category/code toggle, so neither is sorted.
 */
const SORTABLE: Record<string, readonly string[]> = {
  a4: [
    'Manpower Table',
    'Month-on-Month — # Breakdowns Handled',
    'Month-on-Month — BD Hours Handled',
  ],
};

/**
 * The tables a face sorts by position: A10's five data cards, A9's risk, planning-forecast, both trend and repeat
 * tables, and the Forecast Lab's method and month tables.
 */
const SORTABLE_INDEX: Record<string, readonly number[]> = {
  a9: [0, 5, 6, 7, 8],
  fl: [0, 1],
  a10: [0, 1, 2, 3, 4],
  // 43e: Compare's two longest-breakdown tables and by-shift, Money's two tables, Fix Finder's 15 rows.
  cmp: [3, 4, 5],
  mm: [0, 1],
  ff: [0],
};

/** The A1/A2/A3 charts' chrome: the engine's id is data, the title and axis are catalogue copy. */
const CHART_META: Record<
  string,
  {
    title: MessageKey;
    category: MessageKey;
    kind: 'bar' | 'line' | 'mixed';
    secondAxis?: true;
    /** The series name when the engine sends none (A10's Pareto labels carry the group name). */
    value?: MessageKey;
  }
> = {
  'ch-a1-cell': {
    title: 'analytics.content.a1.cellChart',
    category: A1_CELL_AXIS,
    kind: 'bar',
  },
  'ch-a1-trend': {
    title: 'analytics.content.a1.trendChart',
    category: A1_MONTH_AXIS,
    kind: 'line',
  },
  'ch-a2-cathrs': {
    title: 'analytics.content.a2.catHrsChart',
    category: CATEGORY_AXIS,
    kind: 'bar',
  },
  'ch-a2-catcnt': {
    title: 'analytics.content.a2.catCountChart',
    category: CATEGORY_AXIS,
    kind: 'bar',
  },
  'ch-a2-cellhrs': {
    title: 'analytics.content.a2.cellHrsChart',
    category: CELL_AXIS,
    kind: 'bar',
  },
  'ch-a2-cellcnt': {
    title: 'analytics.content.a2.cellCountChart',
    category: CELL_AXIS,
    kind: 'bar',
  },
  'ch-a2-catavghrs': {
    title: 'analytics.content.a2.catAvgHrsChart',
    category: CATEGORY_AXIS,
    kind: 'bar',
  },
  'ch-a2-catavgcnt': {
    title: 'analytics.content.a2.catAvgCountChart',
    category: CATEGORY_AXIS,
    kind: 'bar',
  },
  'ch-a2-cellavghrs': {
    title: 'analytics.content.a2.cellAvgHrsChart',
    category: CELL_AXIS,
    kind: 'bar',
  },
  'ch-a2-cellavgcnt': {
    title: 'analytics.content.a2.cellAvgCountChart',
    category: CELL_AXIS,
    kind: 'bar',
  },
  'ch-a3-catmttr': {
    title: 'analytics.content.a3.catMttrChart',
    category: CATEGORY_AXIS,
    kind: 'bar',
  },
  'ch-a3-catmtbf': {
    title: 'analytics.content.a3.catMtbfChart',
    category: CATEGORY_AXIS,
    kind: 'bar',
  },
  'ch-a3-cellmttr': {
    title: 'analytics.content.a3.cellMttrChart',
    category: CELL_AXIS,
    kind: 'bar',
  },
  'ch-a3-cellmtbf': {
    title: 'analytics.content.a3.cellMtbfChart',
    category: CELL_AXIS,
    kind: 'bar',
  },
  'ch-a3-agemttr': {
    title: 'analytics.content.a3.ageMttrChart',
    category: AGE_AXIS,
    kind: 'bar',
  },
  'ch-a3-agemtbf': {
    title: 'analytics.content.a3.ageMtbfChart',
    category: AGE_AXIS,
    kind: 'bar',
  },
  'ch-a3-planttrend': {
    title: 'analytics.content.a3.plantTrendChart',
    category: MONTH_AXIS,
    kind: 'line',
    secondAxis: true,
  },
  'ch-a4-count': {
    title: 'analytics.content.a4.countChart',
    category: PERSON_AXIS,
    kind: 'bar',
  },
  // 45e: the two monthly and two annual report charts, in the engine's own id order.
  'ch-rp-daily': { title: RP_DAILY, category: REPORT_DAY, kind: 'line' },
  'ch-rp-12m': { title: RP_MONTHS, category: REPORT_MONTH, kind: 'line', secondAxis: true },
  'ch-ry-month': { title: RY_MONTHS, category: REPORT_MONTH, kind: 'line', secondAxis: true },
  'ch-ry-pareto': { title: RY_PARETO, category: REPORT_MACHINE, kind: 'mixed' },
  'ch-prob-pareto': {
    title: 'analytics.content.a10.paretoChart',
    category: A10_GROUP,
    kind: 'bar',
    value: A10_HOURS,
  },
};

function isObject(value: unknown): value is ObjectValue {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** A cell the engine printed as a string or a finite number; anything else is not a printable cell. */
function printableOf(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

function datasets(value: ObjectValue): unknown[] {
  return Array.isArray(value.datasets) ? value.datasets : [];
}

/** A chart series: its label as data, and one value per category; a null month is a gap, never a zero. */
function seriesOf(value: unknown): { name: string; values: (number | undefined)[] } | null {
  if (!isObject(value) || typeof value.label !== 'string' || !Array.isArray(value.data))
    return null;
  const values = value.data.map((item) => (item === null ? undefined : Number(item)));
  return values.every((item) => item === undefined || Number.isFinite(item))
    ? { name: value.label, values }
    : null;
}

/** One KPI the engine printed: its label, value and sub-line are all data. */
function pageKpi(raw: unknown): PageKpi[] {
  const kpi = isObject(raw) ? raw : null;
  if (kpi === null) return [];
  const label = typeof kpi.label === 'string' ? kpi.label : null;
  const value = printableOf(kpi.value);
  if (label === null || value === null) return [];
  return [{ label, value, sub: typeof kpi.sub === 'string' ? kpi.sub : printableOf(kpi.sub) }];
}

/** Whether the face may sort one table: A4 names its tables, A10's unplaced title changes with the count. */
function isSortable(page: string, title: string, index: number): boolean {
  return SORTABLE[page]?.includes(title) === true || SORTABLE_INDEX[page]?.includes(index) === true;
}

/** The engine's own cells, kept exactly; a row with an empty cell is still a row. */
function pageTable(raw: unknown, page: string, index: number): PageTable[] {
  const table = isObject(raw) ? raw : null;
  if (table === null) return [];
  const header = (Array.isArray(table.header) ? table.header : []).flatMap((cell) =>
    typeof cell === 'string' ? [cell] : [],
  );
  const rows = (Array.isArray(table.rows) ? table.rows : []).flatMap((row) => {
    const cells = (Array.isArray(row) ? row : []).map(printableOf);
    return cells.length > 0 && cells.every((cell) => cell !== null) ? [cells as string[]] : [];
  });
  if (header.length === 0 && rows.length === 0) return [];
  const count = Number(table.rowCount);
  const title = typeof table.title === 'string' ? table.title : '';
  return [
    {
      title,
      header,
      rows,
      rowCount: Number.isFinite(count) ? count : rows.length,
      truncated: table.truncated === true,
      ...(table.heat === true ? { heat: true } : {}),
      ...(isSortable(page, title, index) ? { sortable: true } : {}),
    },
  ];
}

/** The groups table behind A10's bubble: its first column is the group name, its fifth the group hours. */
function groupsTable(tables: readonly PageTable[]): PageTable | undefined {
  return tables.find((table) => table.header[0] === 'Problem group');
}

/** A cell as a number, grouping commas read; null when the key's cell is not a number. */
function numericCell(cell: string | undefined): number | null {
  if (cell === undefined) return null;
  const value = Number(cell.replaceAll(',', '').trim());
  return Number.isFinite(value) ? value : null;
}

/**
 * A10's bubble: the engine sends x (count), y (average hours) and r (radius) per group and no labels, so the
 * names come from the groups table's own hours order, which is the order the engine built both from. The third
 * point value is the group's hours, so the chart's table and tooltip print a real number, never a blank MTTR.
 */
function groupBubble(chart: ObjectValue, t: TFunction, tables: readonly PageTable[]): ChartSpec[] {
  const dataset = datasets(chart)[0];
  if (!isObject(dataset) || !Array.isArray(dataset.data)) return [];
  const groups = groupsTable(tables);
  const points = dataset.data.flatMap((point, index) => {
    if (!isObject(point)) return [];
    const x = Number(point.x);
    const y = Number(point.y);
    const r = Number(point.r);
    if (![x, y, r].every(Number.isFinite)) return [];
    const row = groups?.rows[index];
    const hours = numericCell(row?.[4]);
    return [
      {
        x,
        y,
        r,
        label: row?.[0] ?? '',
        ...(hours === null ? {} : { mttr: hours }),
      },
    ];
  });
  if (points.length === 0) return [];
  const axes = isObject(chart.axes) ? chart.axes : {};
  return [
    {
      kind: 'scatter',
      title: t('analytics.content.a10.bubbleChart'),
      machineLabel: t(A10_GROUP),
      xLabel: typeof axes.x === 'string' ? axes.x : '',
      yLabel: typeof axes.y === 'string' ? axes.y : '',
      mttrLabel: t(A10_HOURS),
      points,
    },
  ];
}

/** A chart object with an id, mapped by the catalogue or by one of the three screen-own mappers. */
function knownChart(chart: ObjectValue, t: TFunction, tables: readonly PageTable[]): ChartSpec[] {
  if (chart.id === 'ch-prob-scatter') return groupBubble(chart, t, tables);
  const screen = screenChart(chart, t);
  if (screen !== null) return screen;
  const special = specialChart(chart, t, tables);
  if (special !== null) return special;
  const meta = CHART_META[typeof chart.id === 'string' ? chart.id : ''];
  if (meta === undefined) return [];
  return catalogueChart(chart, meta, t);
}

/** A chart the catalogue knows, with the engine's labels and datasets as its data. */
function pageChart(raw: unknown, t: TFunction, tables: readonly PageTable[]): ChartSpec[] {
  const chart = isObject(raw) ? raw : null;
  if (chart === null || typeof chart.id !== 'string') return [];
  return knownChart(chart, t, tables);
}

function catalogueChart(
  chart: ObjectValue,
  meta: (typeof CHART_META)[string],
  t: TFunction,
): ChartSpec[] {
  const categories = (Array.isArray(chart.labels) ? chart.labels : []).map(String);
  const series = datasets(chart).flatMap((dataset) => {
    const parsed = seriesOf(dataset);
    return parsed === null ? [] : [parsed];
  });
  if (categories.length === 0 || series.length === 0) return [];
  const limit = meta.kind === 'line' ? 3 : 2;
  if (series.length > limit) return [];
  const named = series.map((data) =>
    data.name === '' && meta.value !== undefined ? { ...data, name: t(meta.value) } : data,
  );
  const pair = named as [ChartSeries] | [ChartSeries, ChartSeries];
  const title = t(meta.title);
  const categoryLabel = t(meta.category);
  if (meta.kind === 'mixed') {
    const [bars, line] = named;
    if (bars === undefined) return [];
    return [{ kind: 'mixed', title, categoryLabel, categories, bars: [bars], line }];
  }
  if (meta.kind === 'bar') return [{ kind: 'bar', title, categoryLabel, categories, series: pair }];
  return [
    {
      kind: 'line',
      title,
      categoryLabel,
      categories,
      series: named,
      ...(meta.secondAxis === true ? { secondAxis: true } : {}),
    },
  ];
}

/** A page with nothing to print is null: an empty plant never becomes a fabricated page. */
export function pageContent(value: ObjectValue, t: TFunction): PageContent | null {
  const first = (Array.isArray(value.pages) ? value.pages : []).find(isObject);
  if (first === undefined) return null;
  const kpis = (Array.isArray(first.kpis) ? first.kpis : []).flatMap(pageKpi);
  const page = typeof first.page === 'string' ? first.page : '';
  const tables = (Array.isArray(first.tables) ? first.tables : []).flatMap((table, index) =>
    pageTable(table, page, index),
  );
  const charts = (Array.isArray(first.charts) ? first.charts : []).flatMap((chart) =>
    pageChart(chart, t, tables),
  );
  if (kpis.length === 0 && tables.length === 0 && charts.length === 0) return null;
  return {
    kind: 'page',
    title: typeof first.title === 'string' ? first.title : '',
    kpis,
    tables,
    charts,
  };
}
