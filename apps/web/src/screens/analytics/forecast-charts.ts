import type { TFunction } from 'i18next';
import type { MessageKey } from '@uptimo/shared/i18n';
import type { ChartSeries, ChartSpec, ChartTone } from '../../ui/chart/use-chart.js';
import type { PageTable } from './page-content.js';

/**
 * The A9 map, the planning forecast chart and the Forecast Lab chart (packet 42e). They sit here, not in
 * `page-content.ts`, because that mapper is already near the 400-line hard budget and these three charts need
 * their own rules. The engine's objects are the source: points, labels, tick text and series are data this module
 * never invents. Drawing rules the key does not carry (arm radius, the High/Critical labels, band colour) are
 * computed here from the engine's own facts, and chrome is a catalogue lookup so the face stays translatable.
 */

type ObjectValue = Record<string, unknown>;

const MAP_ID = 'ch-a9-map';
const FC_ID = 'ch-fc';
const LAB_ID = 'ch-fl';

const MAP_TITLE = 'analytics.content.a9.mapChart' satisfies MessageKey;
const MAP_MACHINE = 'analytics.content.a9.machineLabel' satisfies MessageKey;
const MAP_HOURS = 'analytics.content.a9.hoursLabel' satisfies MessageKey;
const FC_TITLE = 'analytics.content.a9.forecastChart' satisfies MessageKey;
const FC_CATEGORY = 'analytics.content.a9.forecastCategory' satisfies MessageKey;
const LAB_TITLE = 'analytics.content.forecastLab.chart' satisfies MessageKey;
const LAB_MONTH = 'analytics.content.forecastLab.monthAxis' satisfies MessageKey;

/** The key's own rating colours: Critical red, High orange, Watch amber, Low grey. */
const RATING_TONE: Record<string, ChartTone> = {
  Critical: 'danger',
  High: 'hold',
  Watch: 'warning',
  Low: 'muted',
};

/** The key's forecast bands: Hot red, Likely orange, Watch amber, Stable green. */
const BAND_TONE: Record<string, ChartTone> = {
  Hot: 'danger',
  Likely: 'hold',
  Watch: 'warning',
  Stable: 'ok',
};

/** The Lab's actual line is green and each challenger its own tone, as the platform draws them. */
const FL_TONE: Record<string, ChartTone> = {
  Actual: 'ok',
  'Current model': 'muted',
  'Age-adjusted': 'info',
  'Recent-weighted': 'hold',
  'Age + recent': 'moved',
};

function isObject(value: unknown): value is ObjectValue {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function datasets(value: ObjectValue): unknown[] {
  return Array.isArray(value.datasets) ? value.datasets : [];
}

function axesOf(chart: ObjectValue): { x: string; y: string } {
  const axes = isObject(chart.axes) ? chart.axes : {};
  return {
    x: typeof axes.x === 'string' ? axes.x : '',
    y: typeof axes.y === 'string' ? axes.y : '',
  };
}

function categoriesOf(chart: ObjectValue): string[] {
  return Array.isArray(chart.labels) ? chart.labels.map(String) : [];
}

/** One numeric series; a null gap stays a gap, never a zero. */
function seriesOf(value: unknown): ChartSeries | null {
  if (!isObject(value) || typeof value.label !== 'string' || !Array.isArray(value.data))
    return null;
  const values = value.data.map((item) => (item === null ? undefined : Number(item)));
  return values.every((item) => item === undefined || Number.isFinite(item))
    ? { name: value.label, values }
    : null;
}

function allSeries(chart: ObjectValue): ChartSeries[] {
  return datasets(chart).flatMap((entry) => {
    const series = seriesOf(entry);
    return series === null ? [] : [series];
  });
}

/** The platform's arm radius: 4 + 0.7×√hours, capped at 15 (the key's WJ-01 is 10.4038). */
function radiusOf(hours: number): number {
  return Math.max(4, Math.min(15, 4 + Math.sqrt(Math.max(0, hours)) * 0.7));
}

interface MapPoint {
  x: number;
  y: number;
  r: number;
  label: string;
  mttr: number;
  tone: ChartTone | undefined;
  showLabel: boolean;
}

/** One point per production machine, in the key's dataset order, with the drawing rules applied. */
function mapPoints(chart: ObjectValue): MapPoint[] {
  return datasets(chart).flatMap((raw) => {
    if (!isObject(raw) || typeof raw.label !== 'string' || !Array.isArray(raw.data)) return [];
    const rating = raw.label;
    const tone = RATING_TONE[rating];
    const showLabel = rating === 'High' || rating === 'Critical';
    return raw.data.flatMap((item) => {
      if (!isObject(item)) return [];
      const x = Number(item.x);
      const y = Number(item.y);
      const hours = Number(item.h);
      if (![x, y, hours].every(Number.isFinite) || typeof item.id !== 'string') return [];
      return [{ x, y, r: radiusOf(hours), label: item.id, mttr: hours, tone, showLabel }];
    });
  });
}

/** The map: raw tick labels (never normalised), one lane per category, only High/Critical carry a label. */
function mapChart(chart: ObjectValue, t: TFunction): ChartSpec[] {
  const points = mapPoints(chart);
  if (points.length === 0) return [];
  const ticks =
    isObject(chart.tickLabels) && Array.isArray(chart.tickLabels.y)
      ? chart.tickLabels.y.map(String)
      : [];
  const axes = axesOf(chart);
  return [
    {
      kind: 'scatter',
      title: t(MAP_TITLE),
      machineLabel: t(MAP_MACHINE),
      xLabel: axes.x,
      yLabel: axes.y,
      mttrLabel: t(MAP_HOURS),
      ...(ticks.length === 0 ? {} : { yTickLabels: ticks }),
      points,
    },
  ];
}

/** The band behind each forecast bar, read from the page's own forecast table in machine order. */
function tonesByBand(
  categories: readonly string[],
  tables: readonly PageTable[],
): (ChartTone | undefined)[] {
  const table = tables.find((entry) => entry.header.includes('Band'));
  const machine = table?.header.indexOf('Machine') ?? -1;
  const band = table?.header.indexOf('Band') ?? -1;
  return categories.map((label) => {
    const id = label.split(' · ')[0] ?? '';
    const row = table?.rows.find((cells) => cells[machine] === id);
    return row === undefined || band < 0 ? undefined : BAND_TONE[row[band] ?? ''];
  });
}

/** The 15 highest expected-hours machines, horizontal: expected coloured by band beside the 80% plan. */
function forecastChart(
  chart: ObjectValue,
  t: TFunction,
  tables: readonly PageTable[],
): ChartSpec[] {
  const categories = categoriesOf(chart);
  const series = allSeries(chart);
  if (categories.length === 0 || series.length === 0) return [];
  const expected: ChartSeries = { ...series[0]!, tones: tonesByBand(categories, tables) };
  const pair = series.length === 1 ? [expected] : [expected, series[1]!];
  return [
    {
      kind: 'bar',
      title: t(FC_TITLE),
      categoryLabel: t(FC_CATEGORY),
      categories,
      series: pair as [ChartSeries] | [ChartSeries, ChartSeries],
      valueLabel: axesOf(chart).x,
      horizontal: true,
    },
  ];
}

/** The Lab's month lines: Actual first, then each method in the key's order, on the key's y title. */
function labChart(chart: ObjectValue, t: TFunction): ChartSpec[] {
  const categories = categoriesOf(chart);
  const series = allSeries(chart).map((entry) => {
    const tone = FL_TONE[entry.name];
    return tone === undefined ? entry : { ...entry, tone };
  });
  if (categories.length === 0 || series.length === 0) return [];
  return [
    {
      kind: 'line',
      title: t(LAB_TITLE),
      categoryLabel: t(LAB_MONTH),
      categories,
      series,
      valueLabel: axesOf(chart).y,
    },
  ];
}

/** The three charts this module owns, or null so the one page mapper keeps its other chart ids. */
export function specialChart(
  raw: unknown,
  t: TFunction,
  tables: readonly PageTable[],
): ChartSpec[] | null {
  if (!isObject(raw) || typeof raw.id !== 'string') return null;
  if (raw.id === MAP_ID) return mapChart(raw, t);
  if (raw.id === FC_ID) return forecastChart(raw, t, tables);
  if (raw.id === LAB_ID) return labChart(raw, t);
  return null;
}
