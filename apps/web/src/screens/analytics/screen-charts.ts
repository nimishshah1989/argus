import type { TFunction } from 'i18next';
import type { MessageKey } from '@uptimo/shared/i18n';
import type { ChartSeries, ChartSpec } from '../../ui/chart/use-chart.js';

/**
 * The screen-own charts this file places (43e, extended by 48c): Compare's hours by maintenance code and by month,
 * Money Matters' money lost by problem, and the shift-calendar KPIs' four Paretos. They sit beside
 * `forecast-charts.ts` so the one page mapper keeps its other chart ids and stays inside the 400-line hard budget.
 * The engine's labels and datasets are data; every title and axis is a catalogue lookup, and a blank dataset name
 * is named by the catalogue. A mixed chart is the annual report's Pareto shape: the bars are hours, the line their
 * running share.
 */

type ObjectValue = Record<string, unknown>;

const CMP_CODE = 'ch-cmp-code';
const CMP_MONTH = 'ch-cmp-month';
const MM_CHART = 'ch-mm';
const SK_MACHINE = 'ch-sk-machine';
const SK_CELL = 'ch-sk-cell';
const SK_CODE = 'ch-sk-code';
const SK_SHIFT = 'ch-sk-shift';

interface ChartMeta {
  title: MessageKey;
  category: MessageKey;
  kind: 'bar' | 'line' | 'mixed';
  /** The value axis title; absent leaves the axis unnamed. */
  valueLabel?: MessageKey;
  /** The series name when the engine sends none. */
  value?: MessageKey;
  /** Draw the bars horizontally (Money Matters' long problem names). */
  horizontal?: true;
}

const CHART_META: Record<string, ChartMeta> = {
  [CMP_CODE]: {
    title: 'analytics.content.cmp.codeChart',
    category: 'analytics.content.cmp.codeAxis',
    kind: 'bar',
    valueLabel: 'analytics.content.cmp.hoursAxis',
  },
  [CMP_MONTH]: {
    title: 'analytics.content.cmp.monthChart',
    category: 'analytics.content.cmp.monthAxis',
    kind: 'line',
    valueLabel: 'analytics.content.cmp.hoursAxis',
  },
  [MM_CHART]: {
    title: 'analytics.content.mm.chart',
    category: 'analytics.content.mm.problemAxis',
    kind: 'bar',
    valueLabel: 'analytics.content.mm.valueAxis',
    value: 'analytics.content.mm.value',
    horizontal: true,
  },
  // 48c: the four Paretos, ranked worst first; the line is the running share of the dimension's hours.
  [SK_MACHINE]: {
    title: 'analytics.content.sk.machineChart',
    category: 'analytics.content.sk.machineAxis',
    kind: 'mixed',
  },
  [SK_CELL]: {
    title: 'analytics.content.sk.cellChart',
    category: 'analytics.content.sk.cellAxis',
    kind: 'mixed',
  },
  [SK_CODE]: {
    title: 'analytics.content.sk.codeChart',
    category: 'analytics.content.sk.codeAxis',
    kind: 'mixed',
  },
  [SK_SHIFT]: {
    title: 'analytics.content.sk.shiftChart',
    category: 'analytics.content.sk.shiftAxis',
    kind: 'mixed',
  },
};

function isObject(value: unknown): value is ObjectValue {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function categoriesOf(raw: ObjectValue): string[] {
  return Array.isArray(raw.labels) ? raw.labels.map(String) : [];
}

/** One series: its label as data, one value per category; a null month is a gap, never a zero. */
function seriesOf(value: unknown): ChartSeries | null {
  if (!isObject(value) || typeof value.label !== 'string' || !Array.isArray(value.data))
    return null;
  const values = value.data.map((item) => (item === null ? undefined : Number(item)));
  return values.every((item) => item === undefined || Number.isFinite(item))
    ? { name: value.label, values }
    : null;
}

function seriesOfChart(raw: ObjectValue): ChartSeries[] {
  return (Array.isArray(raw.datasets) ? raw.datasets : []).flatMap((dataset) => {
    const parsed = seriesOf(dataset);
    return parsed === null ? [] : [parsed];
  });
}

/** A blank dataset name becomes the catalogue's word; the engine's own names pass through as data. */
function namedSeries(series: readonly ChartSeries[], meta: ChartMeta, t: TFunction): ChartSeries[] {
  return series.map((data) =>
    data.name === '' && meta.value !== undefined ? { ...data, name: t(meta.value) } : data,
  );
}

/** The catalogue chrome shared by both chart kinds. */
function chrome(meta: ChartMeta, t: TFunction) {
  return {
    title: t(meta.title),
    categoryLabel: t(meta.category),
    ...(meta.valueLabel === undefined ? {} : { valueLabel: t(meta.valueLabel) }),
  };
}

/** The chart the engine sent, or null so the page mapper keeps its other ids. */
export function screenChart(raw: unknown, t: TFunction): ChartSpec[] | null {
  if (!isObject(raw) || typeof raw.id !== 'string') return null;
  const meta = CHART_META[raw.id];
  if (meta === undefined) return null;
  const categories = categoriesOf(raw);
  const series = seriesOfChart(raw);
  if (categories.length === 0 || series.length === 0 || series.length > 2) return [];
  const named = namedSeries(series, meta, t);
  if (meta.kind === 'mixed') {
    const [bars, line] = named;
    if (bars === undefined) return [];
    return [
      {
        kind: 'mixed',
        title: t(meta.title),
        categoryLabel: t(meta.category),
        categories,
        bars: [bars],
        line,
      },
    ];
  }
  const pair = named as [ChartSeries] | [ChartSeries, ChartSeries];
  if (meta.kind === 'bar')
    return [
      {
        kind: 'bar',
        ...chrome(meta, t),
        categories,
        series: pair,
        ...(meta.horizontal === true ? { horizontal: true as const } : {}),
      },
    ];
  return [{ kind: 'line', ...chrome(meta, t), categories, series: pair }];
}
