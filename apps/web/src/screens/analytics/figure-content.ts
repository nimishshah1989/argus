import type { TFunction } from 'i18next';
import type { FiguresReply } from '@uptimo/shared/analytics';
import type { MessageKey } from '@uptimo/shared/i18n';
import type { ChartSpec } from '../../ui/chart/use-chart.js';
import { pageContent, type PageKpi, type PageTable } from './page-content.js';

/**
 * The five object-valued figures (ticket 38.5) become renderable content here, and nowhere else. The engine
 * values are the source: points, series, rows and item sentences are data this module never invents. Chrome
 * (titles, axis names, headers, group labels) is always a catalogue lookup, so the face stays translatable.
 */

type Figure = FiguresReply['figures'][number];
type ObjectValue = Record<string, unknown>;

export type ContentKind = 'chart' | 'table' | 'text' | 'list' | 'page' | 'energy';

/** One A5 heat tile, exactly the key's bucket: its load is the platform's connected (rated) KVA. */
export interface EnergyTile {
  key: string;
  machines: number;
  /** The key's `totalKva`: connected load, never re-rounded. */
  connectedKva: number;
  avgConnectedKva: number;
  runningKva: number;
  avgRunningKva: number;
  machineIds: string[];
}

/** One A5 grid. `axis` is what a tile click filters the drill reply by; the average grid hides its running line. */
export interface EnergyGrid {
  axis: 'cell' | 'location';
  showRunning: boolean;
  tiles: EnergyTile[];
}

/** A5's own content: two heat grids and the per-machine average grid, with the plant's efficiency factor. */
export interface EnergyContent {
  kind: 'energy';
  title: string;
  effFactorPct: number;
  byCell: EnergyGrid;
  byLocation: EnergyGrid;
  byMachine: EnergyGrid;
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
    }
  | EnergyContent;

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
} as const satisfies Record<string, MessageKey>;

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
  'a2-category-cell': 'page',
  'a3-mttr-mtbf': 'page',
  'a4-manpower': 'page',
  'a5-energy': 'energy',
  'a6-why-why': 'page',
  'a10-problems': 'page',
  'a9-bottleneck-forecast': 'page',
  'forecast-lab': 'page',
  compare: 'page',
  'team-focus': 'page',
  'money-matters': 'page',
  'fix-finder': 'page',
  'shift-kpis.compare': 'page',
  'shift-kpis.shift-split': 'page',
  'shift-kpis.backlog': 'page',
  'shift-kpis.breakdown-map': 'page',
};

const oneDecimal = new Intl.NumberFormat('en-GB', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const whole = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 });

function isObject(value: unknown): value is ObjectValue {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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

/** The whole-page figures: the log, A1, A2, A3, A4, A6 and A10 all map through the one page mapper. */
const PAGE_KEYS = new Set([
  'breakdown-log',
  'a1-bd-pm',
  'a2-category-cell',
  'a3-mttr-mtbf',
  'a4-manpower',
  'a6-why-why',
  'a10-problems',
  'a9-bottleneck-forecast',
  'forecast-lab',
  'compare',
  'team-focus',
  'money-matters',
  'fix-finder',
  'shift-kpis.compare',
  'shift-kpis.shift-split',
  'shift-kpis.backlog',
  'shift-kpis.breakdown-map',
]);

/** The renderable content of an object figure, or null when there is nothing honest to draw. */
export function contentOf(figure: Figure, t: TFunction): FigureContent | null {
  if (figure.status !== 'ready' || !isObject(figure.value)) return null;
  if (PAGE_KEYS.has(figure.key)) return pageContent(figure.value, t);
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
    case 'a5-energy':
      return energyContent(figure.value);
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

function finite(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

/** One bucket of A5's `extra`, with the key's raw floats kept: the screen formats, the mapper never rounds. */
function energyTile(raw: unknown): EnergyTile | null {
  if (!isObject(raw) || typeof raw.key !== 'string') return null;
  const numbers = [raw.machines, raw.totalKva, raw.avgKva, raw.runningKva, raw.avgRunningKva].map(
    finite,
  );
  if (numbers.some((number) => number === null)) return null;
  const [machines, connectedKva, avgConnectedKva, runningKva, avgRunningKva] = numbers as number[];
  const machineIds = Array.isArray(raw.machineIds)
    ? raw.machineIds.flatMap((id) => (typeof id === 'string' ? [id] : []))
    : [];
  return {
    key: raw.key,
    machines: machines as number,
    connectedKva: connectedKva as number,
    avgConnectedKva: avgConnectedKva as number,
    runningKva: runningKva as number,
    avgRunningKva: avgRunningKva as number,
    machineIds,
  };
}

/** One grid of buckets, in the engine's Settings order; a bucket the mapper cannot read is dropped, not zeroed. */
function energyGrid(raw: unknown, axis: EnergyGrid['axis'], showRunning: boolean): EnergyGrid {
  const tiles = (Array.isArray(raw) ? raw : []).flatMap((bucket) => {
    const tile = energyTile(bucket);
    return tile === null ? [] : [tile];
  });
  return { axis, showRunning, tiles };
}

/**
 * A5's page and its two keyed grids. The third grid is the platform's normalized view: the same cell buckets with
 * their connected load replaced by the average per machine, so it prints no running line. The value carries the
 * key's page title and efficiency factor; the chrome around it is catalogue copy in `EnergyPage`.
 */
function energyContent(value: ObjectValue): EnergyContent | null {
  const extra = isObject(value.extra) ? value.extra : null;
  if (extra === null) return null;
  const effFactorPct = finite(extra.effFactorPct);
  if (effFactorPct === null) return null;
  const byCell = energyGrid(extra.byCell, 'cell', true);
  const byLocation = energyGrid(extra.byLocation, 'location', true);
  if (byCell.tiles.length === 0 && byLocation.tiles.length === 0) return null;
  const byMachine: EnergyGrid = {
    axis: 'cell',
    showRunning: false,
    tiles: byCell.tiles.map((tile) => ({ ...tile, connectedKva: tile.avgConnectedKva })),
  };
  const first = (Array.isArray(value.pages) ? value.pages : []).find(isObject);
  return {
    kind: 'energy',
    title: first !== undefined && typeof first.title === 'string' ? first.title : '',
    effFactorPct,
    byCell,
    byLocation,
    byMachine,
  };
}
