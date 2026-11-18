import type { TFunction } from 'i18next';
import type { FiguresReply } from '@uptimo/shared/analytics';
import type { MessageKey } from '@uptimo/shared/i18n';
import type { ChartSeries, ChartSpec } from '../../ui/chart/use-chart.js';

/**
 * The five object-valued figures (ticket 38.5) become renderable content here, and nowhere else. The engine
 * values are the source: points, series, rows and item sentences are data this module never invents. Chrome
 * (titles, axis names, headers, group labels) is always a catalogue lookup, so the face stays translatable.
 */

type Figure = FiguresReply['figures'][number];
type ObjectValue = Record<string, unknown>;

export type ContentKind = 'chart' | 'table' | 'text' | 'list' | 'page';

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

export type FigureContent =
  | { kind: 'chart'; spec: ChartSpec }
  | { kind: 'table'; header: string[]; rows: string[][]; caption?: string }
  | { kind: 'text'; text: string }
  | { kind: 'list'; groups: { label: string; rows: string[] }[] }
  | {
      kind: 'page';
      title: string;
      kpis: PageKpi[];
      tables: PageTable[];
      charts: ChartSpec[];
    };

/** The catalogue keys the mapper prints; typed so a missing key is a compile error, not an English label. */
const KEY = {
  bubbleTitle: 'analytics.content.bubble.title',
  bubbleMachine: 'analytics.content.bubble.machineLabel',
  bubbleX: 'analytics.content.bubble.xLabel',
  bubbleY: 'analytics.content.bubble.yLabel',
  bubbleMttr: 'analytics.content.bubble.mttrLabel',
  timelineTitle: 'analytics.content.timeline.title',
  timelineCategory: 'analytics.content.timeline.categoryLabel',
  breakdownFree: 'analytics.content.breakdownFree.text',
  costliestProblem: 'analytics.content.costliest.problem',
  costliestHours: 'analytics.content.costliest.hours',
  costliestShare: 'analytics.content.costliest.share',
  costliestBreakdowns: 'analytics.content.costliest.breakdowns',
  costliestCaption: 'analytics.content.costliest.caption',
  a1CellChart: 'analytics.content.a1.cellChart',
  a1CellAxis: 'analytics.content.a1.cellAxis',
  a1TrendChart: 'analytics.content.a1.trendChart',
  a1TrendAxis: 'analytics.content.a1.trendAxis',
} as const satisfies Record<string, MessageKey>;

/** The A1 charts' chrome: the engine's id is data, the title and axis are catalogue copy. */
const CHART_META: Record<
  string,
  { title: MessageKey; category: MessageKey; kind: 'bar' | 'line' }
> = {
  'ch-a1-cell': { title: KEY.a1CellChart, category: KEY.a1CellAxis, kind: 'bar' },
  'ch-a1-trend': { title: KEY.a1TrendChart, category: KEY.a1TrendAxis, kind: 'line' },
};

/** The engine's group order (data-checklist.ts holds the same list); a checklist group is only printed here. */
const CHECKLIST_GROUPS = [
  'bd_date',
  'bd_mach',
  'bd_hrs',
  'bd_code',
  'bd_done',
  'bd_prob',
  'bd_shift',
  'bd_obs',
  'bd_em',
  'log_gap',
  'ww',
  'mc_age',
  'mc_dim',
  'mc_pw',
  'mc_cell',
  'mc_loc',
] as const;

type ChecklistGroup = (typeof CHECKLIST_GROUPS)[number];

const CHECKLIST_LABEL: Record<ChecklistGroup, MessageKey> = {
  bd_date: 'analytics.checklist.group.bd_date',
  bd_mach: 'analytics.checklist.group.bd_mach',
  bd_hrs: 'analytics.checklist.group.bd_hrs',
  bd_code: 'analytics.checklist.group.bd_code',
  bd_done: 'analytics.checklist.group.bd_done',
  bd_prob: 'analytics.checklist.group.bd_prob',
  bd_shift: 'analytics.checklist.group.bd_shift',
  bd_obs: 'analytics.checklist.group.bd_obs',
  bd_em: 'analytics.checklist.group.bd_em',
  log_gap: 'analytics.checklist.group.log_gap',
  ww: 'analytics.checklist.group.ww',
  mc_age: 'analytics.checklist.group.mc_age',
  mc_dim: 'analytics.checklist.group.mc_dim',
  mc_pw: 'analytics.checklist.group.mc_pw',
  mc_cell: 'analytics.checklist.group.mc_cell',
  mc_loc: 'analytics.checklist.group.mc_loc',
};

const KIND: Record<string, ContentKind> = {
  'dashboard.bubble-chart': 'chart',
  'dashboard.expansion-timeline': 'chart',
  'dashboard.breakdown-free': 'text',
  'dashboard.costliest-problems': 'table',
  'data-checklist': 'list',
  'breakdown-log': 'page',
  'a1-bd-pm': 'page',
};

const oneDecimal = new Intl.NumberFormat('en-GB', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const whole = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 });

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

function seriesOf(value: unknown): { name: string; values: number[] } | null {
  if (!isObject(value) || typeof value.label !== 'string' || !Array.isArray(value.data))
    return null;
  return { name: value.label, values: value.data.map((item) => Number(item)) };
}

/** A cheap kind for the parent's span choice; it maps a known object key, never builds the content. */
export function contentKind(figure: Figure): ContentKind | null {
  if (figure.status !== 'ready' || !isObject(figure.value)) return null;
  return KIND[figure.key] ?? null;
}

/** The renderable content of an object figure, or null when there is nothing honest to draw. */
export function contentOf(figure: Figure, t: TFunction): FigureContent | null {
  if (figure.status !== 'ready' || !isObject(figure.value)) return null;
  switch (figure.key) {
    case 'dashboard.bubble-chart':
      return bubble(figure.value, t);
    case 'dashboard.expansion-timeline':
      return timeline(figure.value, t);
    case 'dashboard.breakdown-free':
      return breakdownFree(figure.value, t);
    case 'dashboard.costliest-problems':
      return costliest(figure.value, t);
    case 'data-checklist':
      return checklist(figure.value, t);
    case 'breakdown-log':
    case 'a1-bd-pm':
      return page(figure.value, t);
    default:
      return null;
  }
}

/** One bubble per engine point: hours, breakdowns, MTTR-sized radius, machine id as label. */
function bubble(value: ObjectValue, t: TFunction): FigureContent | null {
  const points = datasets(value).flatMap((dataset) => {
    if (!isObject(dataset) || !Array.isArray(dataset.data)) return [];
    return dataset.data.flatMap((point) => {
      if (!isObject(point)) return [];
      return [
        {
          x: Number(point.x),
          y: Number(point.y),
          r: Number(point.r),
          label: String(point.id),
          mttr: point.mttr === undefined ? undefined : Number(point.mttr),
        },
      ];
    });
  });
  if (points.length === 0) return null;
  return {
    kind: 'chart',
    spec: {
      kind: 'scatter',
      title: t(KEY.bubbleTitle),
      machineLabel: t(KEY.bubbleMachine),
      xLabel: t(KEY.bubbleX),
      yLabel: t(KEY.bubbleY),
      mttrLabel: t(KEY.bubbleMttr),
      points,
    },
  };
}

/** The engine's prefix datasets are the stacked bars; its last dataset is the cumulative line. */
function timeline(value: ObjectValue, t: TFunction): FigureContent | null {
  const series = datasets(value).flatMap((dataset) => {
    const parsed = seriesOf(dataset);
    return parsed === null ? [] : [parsed];
  });
  const line = series[series.length - 1];
  if (line === undefined) return null;
  return {
    kind: 'chart',
    spec: {
      kind: 'mixed',
      title: t(KEY.timelineTitle),
      categoryLabel: t(KEY.timelineCategory),
      categories: (Array.isArray(value.labels) ? value.labels : []).map((label) => String(label)),
      bars: series.slice(0, -1),
      line,
    },
  };
}

/** Counts are engine data; only the sentence around them is catalogue copy. */
function breakdownFree(value: ObjectValue, t: TFunction): FigureContent | null {
  const clean = Number(value.runningClean);
  const total = Number(value.inService);
  if (!Number.isFinite(clean) || !Number.isFinite(total)) return null;
  return { kind: 'text', text: t(KEY.breakdownFree, { clean, total }) };
}

/** The top problem rows, formatted for reading; the caption carries the engine's total hours. */
function costliest(value: ObjectValue, t: TFunction): FigureContent {
  const rows = (Array.isArray(value.rows) ? value.rows : []).flatMap((row) => {
    if (!isObject(row)) return [];
    const share = Number(row.share);
    return [
      [
        String(row.problem ?? ''),
        oneDecimal.format(Number(row.hours)),
        `${share.toFixed(2)}%`,
        whole.format(Number(row.breakdowns)),
      ],
    ];
  });
  const total = Number(value.totalHours);
  return {
    kind: 'table',
    header: [
      t(KEY.costliestProblem),
      t(KEY.costliestHours),
      t(KEY.costliestShare),
      t(KEY.costliestBreakdowns),
    ],
    rows,
    caption: Number.isFinite(total)
      ? t(KEY.costliestCaption, { hours: oneDecimal.format(total) })
      : undefined,
  };
}

/** One group per count the engine sent, in the engine's order; each row is the engine's own sentence. */
function checklist(value: ObjectValue, t: TFunction): FigureContent {
  const counts = isObject(value.counts) ? value.counts : {};
  const items = Array.isArray(value.items) ? value.items : [];
  const groups = CHECKLIST_GROUPS.flatMap((group) => {
    if (!(Number(counts[group]) > 0)) return [];
    const rows = items.flatMap((item) =>
      isObject(item) && item.group === group && typeof item.plain === 'string' ? [item.plain] : [],
    );
    return [{ label: t(CHECKLIST_LABEL[group]), rows }];
  });
  return { kind: 'list', groups };
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

/** A chart the catalogue knows, with the engine's labels and numeric datasets as its data. */
function pageChart(raw: unknown, t: TFunction): ChartSpec[] {
  const chart = isObject(raw) ? raw : null;
  if (chart === null || typeof chart.id !== 'string') return [];
  const meta = CHART_META[chart.id];
  if (meta === undefined) return [];
  const categories = (Array.isArray(chart.labels) ? chart.labels : []).map(String);
  const series = datasets(chart).flatMap((dataset) => {
    const parsed = seriesOf(dataset);
    return parsed === null || parsed.values.some((value) => !Number.isFinite(value))
      ? []
      : [parsed];
  });
  if (categories.length === 0 || series.length === 0 || series.length > 2) return [];
  const pair = series as [ChartSeries] | [ChartSeries, ChartSeries];
  const title = t(meta.title);
  const categoryLabel = t(meta.category);
  return [
    meta.kind === 'bar'
      ? { kind: 'bar', title, categoryLabel, categories, series: pair }
      : { kind: 'line', title, categoryLabel, categories, series: pair },
  ];
}

/**
 * The key-shaped page (40e-1): the platform's own page, whole. The log and A1 are pages, so the screen renders
 * KPIs, tables and charts from one mapping instead of a per-screen layout. A page with nothing to print is null.
 */
function page(value: ObjectValue, t: TFunction): FigureContent | null {
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
