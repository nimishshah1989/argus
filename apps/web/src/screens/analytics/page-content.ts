import type { TFunction } from 'i18next';
import type { MessageKey } from '@uptimo/shared/i18n';
import type { ChartSeries, ChartSpec } from '../../ui/chart/use-chart.js';

/**
 * The key-shaped page (packets 40e-1 and 40e-2): the platform's own page, whole. The log, A1, A2 and A3 are
 * pages, so one mapping turns the engine's KPIs, tables and charts into the kit's pieces. The page title, KPI
 * labels, table titles and cells are the engine's printed data; the charts' titles and axes are catalogue copy.
 * Split from `figure-content.ts` when the two breakdown keys took the mapper towards the 400-line hard limit.
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

/** The A1/A2/A3 charts' chrome: the engine's id is data, the title and axis are catalogue copy. */
const CHART_META: Record<
  string,
  {
    title: MessageKey;
    category: MessageKey;
    kind: 'bar' | 'line';
    secondAxis?: true;
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

/** The engine's own cells, kept exactly; a row with an empty cell is still a row. */
function pageTable(raw: unknown): PageTable[] {
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
  return [
    {
      title: typeof table.title === 'string' ? table.title : '',
      header,
      rows,
      rowCount: Number.isFinite(count) ? count : rows.length,
      truncated: table.truncated === true,
    },
  ];
}

/** A chart the catalogue knows, with the engine's labels and datasets as its data. */
function pageChart(raw: unknown, t: TFunction): ChartSpec[] {
  const chart = isObject(raw) ? raw : null;
  if (chart === null || typeof chart.id !== 'string') return [];
  const meta = CHART_META[chart.id];
  if (meta === undefined) return [];
  const categories = (Array.isArray(chart.labels) ? chart.labels : []).map(String);
  const series = datasets(chart).flatMap((dataset) => {
    const parsed = seriesOf(dataset);
    return parsed === null ? [] : [parsed];
  });
  if (categories.length === 0 || series.length === 0 || series.length > 2) return [];
  const pair = series as [ChartSeries] | [ChartSeries, ChartSeries];
  const title = t(meta.title);
  const categoryLabel = t(meta.category);
  if (meta.kind === 'bar') return [{ kind: 'bar', title, categoryLabel, categories, series: pair }];
  return [
    {
      kind: 'line',
      title,
      categoryLabel,
      categories,
      series: pair,
      ...(meta.secondAxis === true ? { secondAxis: true } : {}),
    },
  ];
}

/** A page with nothing to print is null: an empty plant never becomes a fabricated page. */
export function pageContent(value: ObjectValue, t: TFunction): PageContent | null {
  const first = (Array.isArray(value.pages) ? value.pages : []).find(isObject);
  if (first === undefined) return null;
  const kpis = (Array.isArray(first.kpis) ? first.kpis : []).flatMap(pageKpi);
  const tables = (Array.isArray(first.tables) ? first.tables : []).flatMap(pageTable);
  const charts = (Array.isArray(first.charts) ? first.charts : []).flatMap((chart) =>
    pageChart(chart, t),
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
