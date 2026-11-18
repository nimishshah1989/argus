import { esc } from './html.js';

/**
 * A report figure's chart, drawn as inline SVG (ticket 45, packet 45d). The figure's chart object is the key's
 * own: a label per x position and one or more series. The drawing rule is the platform's report chart: a count
 * series is bars, an hours series is the line on the second axis, and a Pareto's hours stay bars with its
 * cumulative share as the line. Nothing is recomputed: a value is drawn where the figure printed it.
 */

export interface ReportChartSeries {
  label: string;
  data: ReadonlyArray<number | null>;
}

export interface ReportChart {
  id: string;
  type: string;
  axes: { x: string; y: string; y1: string };
  tickLabels: { x: string[]; y: string[]; y1: string[] };
  labels: ReadonlyArray<string | number>;
  datasets: ReadonlyArray<ReportChartSeries>;
}

type Axis = 'y' | 'y1';

interface SeriesStyle {
  series: ReportChartSeries;
  axis: Axis;
  bars: boolean;
}

const COUNT = /breakdowns?\b/i;
const HOURS = /(hrs|hours)\b/i;
const CUMULATIVE = /cumulative|%/i;

/**
 * How each series is drawn: a cumulative or a percentage series is the line on the second axis; an hours series
 * is that line when the chart also has a count series (otherwise the hours are the bars); everything else is a
 * bar on the first axis.
 */
export function seriesStyles(chart: ReportChart): SeriesStyle[] {
  const hasCount = chart.datasets.some((series) => COUNT.test(series.label));
  return chart.datasets.map((series) => {
    if (CUMULATIVE.test(series.label)) return { series, axis: 'y1', bars: false };
    if (HOURS.test(series.label) && hasCount) return { series, axis: 'y1', bars: false };
    return { series, axis: 'y', bars: true };
  });
}

/** The largest drawn value of these series, ignoring gaps; 1 when there is none, so a scale is never zero. */
function seriesMax(series: readonly ReportChartSeries[]): number {
  let max = 0;
  for (const one of series) {
    for (const value of one.data) {
      if (value !== null && Number.isFinite(value) && value > max) max = value;
    }
  }
  return max > 0 ? max : 1;
}

/** A round top for an axis: 1, 2, 5 or 10 times a power of ten, so the gridlines read as whole numbers. */
function niceMax(value: number): number {
  const power = 10 ** Math.floor(Math.log10(value));
  const fraction = value / power;
  const step = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
  return step * power;
}

const LEFT = 34;
const RIGHT = 34;
const TOP = 22;
const BOTTOM = 48;
const WIDTH = 640;
const HEIGHT = 276;

interface Frame {
  band: number;
  x: (index: number) => number;
  y: (value: number, max: number) => number;
}

function frame(labels: number): Frame {
  const plotWidth = WIDTH - LEFT - RIGHT;
  const plotHeight = HEIGHT - TOP - BOTTOM;
  const band = plotWidth / Math.max(labels, 1);
  return {
    band,
    x: (index) => LEFT + (index + 0.5) * band,
    y: (value, max) => TOP + plotHeight - (value / max) * plotHeight,
  };
}

/** A number as an axis tick: an integer when it is whole, one decimal otherwise. */
const tickText = (value: number): string =>
  Number.isInteger(value) ? String(value) : String(Math.round(value * 10) / 10);

function gridLines(scale: Frame, max: number, axis: Axis): string {
  const side = axis === 'y' ? LEFT - 4 : WIDTH - RIGHT + 4;
  const anchor = axis === 'y' ? 'end' : 'start';
  return [0, 0.25, 0.5, 0.75, 1]
    .map((step) => {
      const value = max * step;
      const y = scale.y(value, max);
      return `<line x1="${LEFT}" y1="${y.toFixed(1)}" x2="${WIDTH - RIGHT}" y2="${y.toFixed(
        1,
      )}" class="grid"/><text x="${side}" y="${(y + 3).toFixed(1)}" text-anchor="${anchor}" class="tick">${tickText(
        value,
      )}</text>`;
    })
    .join('');
}

interface BarPlace {
  max: number;
  index: number;
  count: number;
}

/** One bar per drawn value, the series' own colour and place in its group. */
function barGroup(style: SeriesStyle, scale: Frame, place: BarPlace): string {
  const width = Math.min(34, (scale.band * 0.72) / place.count);
  const offset = (place.index - (place.count - 1) / 2) * width;
  const shade = place.index === 0 ? 'bar-a' : 'bar-b';
  return style.series.data
    .map((value, index) => {
      if (value === null || !Number.isFinite(value)) return '';
      const x = scale.x(index) + offset - width / 2;
      const y = scale.y(Math.max(value, 0), place.max);
      return `<rect class="bar ${shade}" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${width.toFixed(
        1,
      )}" height="${Math.max(scale.y(0, place.max) - y, 0).toFixed(1)}"/>`;
    })
    .join('');
}

/** A line through every drawn value; a gap is left out, not drawn as zero. */
function linePath(style: SeriesStyle, scale: Frame, max: number): string {
  const points = style.series.data
    .map((value, index) =>
      value === null || !Number.isFinite(value)
        ? null
        : `${scale.x(index).toFixed(1)},${scale.y(value, max).toFixed(1)}`,
    )
    .filter((point): point is string => point !== null);
  return points.length === 0 ? '' : `<polyline class="line" points="${points.join(' ')}"/>`;
}

function xLabels(labels: ReportChart['labels'], scale: Frame): string {
  const rotate = labels.length > 10;
  return labels
    .map(
      (label, index) =>
        `<text x="${scale.x(index).toFixed(1)}" y="${HEIGHT - BOTTOM + 18}" text-anchor="${
          rotate ? 'end' : 'middle'
        }" class="xlabel"${rotate ? ' transform="rotate(-40)"' : ''}>${esc(String(label))}</text>`,
    )
    .join('');
}

function legend(styles: readonly SeriesStyle[]): string {
  return styles
    .map(
      (style, index) =>
        `<text x="${LEFT + index * 130}" y="12" class="legend">${esc(style.series.label)}</text>`,
    )
    .join('');
}

/** The figure's chart as an inline SVG: gridlines, bars, lines, x labels and a legend. */
export function chartSvg(chart: ReportChart): string {
  const scale = frame(chart.labels.length);
  const styles = seriesStyles(chart);
  const bars = styles.filter((style) => style.bars);
  const lines = styles.filter((style) => !style.bars);
  const barMax = niceMax(seriesMax(bars.map((style) => style.series)));
  const lineMax = niceMax(seriesMax(lines.map((style) => style.series)));
  const drawnBars = bars
    .map((style, index) => barGroup(style, scale, { max: barMax, index, count: bars.length }))
    .join('');
  const drawnLines = lines
    .map((style) => linePath(style, scale, style.axis === 'y1' ? lineMax : barMax))
    .join('');
  const secondAxis = lines.some((style) => style.axis === 'y1')
    ? gridLines(scale, lineMax, 'y1')
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" class="chart" role="img" aria-label="${esc(
    chart.id,
  )}">${gridLines(scale, barMax, 'y')}${secondAxis}${drawnBars}${drawnLines}${xLabels(
    chart.labels,
    scale,
  )}${legend(styles)}</svg>`;
}
