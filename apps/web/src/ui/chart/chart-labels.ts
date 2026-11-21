import type { ChartSpec } from './chart-spec.js';

/**
 * Room for the words on a chart's axes, worked out from the spec and the box's width alone (never measured from
 * the picture), so every category label is drawn and none is skipped or crossed by the axis title.
 */

/** A label is about 6.8 px a character at 12 px (a Gujarati name is wider than the Latin average). */
const CHAR = 6.8;
const SLOT = 12;
/** What the value axis, its title and the margins take of the box's width. */
const SIDE = 90;
/** Rotated at 45 degrees, a label needs about this much width (12 px type, 13 px between lines). */
const TILTED = 18;
const TILT = Math.SQRT1_2;
/** The height the kit gives a chart (`.v2-trend`), and what a horizontal bar needs per category. */
export const BASE_HEIGHT = 220;
const LANE = 24;

export interface LabelPlan {
  /** 0 when the labels fit side by side, else 45. */
  rotate: 0 | 45;
  /** Height to add under the plot for the tilted labels. */
  room: number;
  /** Down the side: the width a long name wraps at, so the bars keep the room they need; absent when it fits on one line. */
  wrap?: number;
  /** Down the side: how many lines a row's name takes at most. */
  lines?: number;
  /** The width the chart needs when 45 degrees is still too tight for the box: the card scrolls sideways. */
  scrollWidth?: number;
}

const wide = (label: string): number => [...label].length * CHAR;

/** Side by side when they fit; tilted to 45 degrees when they do not; the box scrolls when even that is too tight. */
export function labelPlan(
  categories: readonly string[],
  width: number | undefined,
  reserve = 0,
): LabelPlan {
  if (width === undefined || categories.length === 0) return { rotate: 0, room: 0 };
  const plot = width - SIDE - reserve;
  const flat = categories.reduce((sum, label) => sum + wide(label) + SLOT, 0);
  if (flat <= plot) return { rotate: 0, room: 0 };
  const longest = Math.max(...categories.map(wide));
  const room = Math.ceil((longest + SLOT) * TILT + 8);
  const need = categories.length * TILTED;
  return need <= plot
    ? { rotate: 45, room }
    : { rotate: 45, room, scrollWidth: Math.ceil(need + SIDE + reserve) };
}

/** The width a chart keeps at its right for what is not plot: a line's end labels, a second value axis. */
export function reserveOf(spec: ChartSpec): number {
  if (spec.kind === 'line')
    return spec.legend === true ? 0 : 7 * Math.max(...spec.series.map((s) => s.name.length));
  return spec.kind === 'pareto' ? 40 : 0;
}

/** The plan for a chart whose categories run along the bottom. */
export const planOf = (spec: Exclude<ChartSpec, { kind: 'scatter' | 'heatmap' }>, width?: number) =>
  labelPlan(spec.categories, width, reserveOf(spec));

/** The share of a horizontal chart's width its category names may take before they wrap onto more lines. */
const SIDE_SHARE = 0.4;
const LINE = 14;

/** Names down the side of a horizontal bar chart: flat, one row each, wrapped when they would crowd out the bars. */
export function sidePlan(categories: readonly string[], width: number | undefined): LabelPlan {
  const flat: LabelPlan = { rotate: 0, room: 0, lines: 1 };
  if (width === undefined || categories.length === 0) return flat;
  const longest = Math.max(...categories.map(wide));
  const cap = Math.floor(width * SIDE_SHARE);
  if (longest <= cap) return flat;
  return { ...flat, wrap: cap, lines: Math.ceil(longest / cap) };
}

/** The box a chart needs: more height for tilted labels or a long horizontal bar, a scroll width when it is too tight. */
export function chartRoom(
  spec: ChartSpec,
  width: number | undefined,
): { height: number; scrollWidth?: number } {
  if (spec.kind === 'scatter' || spec.kind === 'heatmap') return { height: BASE_HEIGHT };
  if (spec.kind === 'bar' && spec.horizontal === true) {
    const lane = Math.max(LANE, (sidePlan(spec.categories, width).lines ?? 1) * LINE + 10);
    return { height: Math.max(BASE_HEIGHT, spec.categories.length * lane + 60) };
  }
  const plan = planOf(spec, width);
  return {
    height: BASE_HEIGHT + plan.room,
    ...(plan.scrollWidth === undefined ? {} : { scrollWidth: plan.scrollWidth }),
  };
}

/**
 * The widest tick text a value axis prints for values up to `max`, worked out as ECharts places its ticks (about five
 * steps of 1, 2, 3, 5 or 10 times a power of ten, the last one at or past the maximum): "1,200", "0.6", "7".
 */
function tickChars(max: number): number {
  if (!(max > 0)) return 1;
  const raw = max / 5;
  const power = 10 ** Math.floor(Math.log10(raw));
  const f = raw / power;
  const step = (f < 1.5 ? 1 : f < 2.5 ? 2 : f < 4 ? 3 : f < 7 ? 5 : 10) * power;
  const digits = Math.max(0, Math.ceil(-Math.log10(step) - 1e-9));
  const top = Math.ceil(max / step - 1e-9) * step;
  return top.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).length;
}

/** Width in px of the tick labels beside the value axis, for the largest value any series reaches. */
export function tickWidth(max: number, unit = ''): number {
  return Math.ceil((tickChars(max) + unit.length) * CHAR);
}

/** The largest value a chart's value axis must reach; a stacked bar adds its series. */
export function topValue(
  series: readonly { values: readonly (number | undefined)[] }[],
  stacked = false,
): number {
  const columns = Math.max(0, ...series.map((s) => s.values.length));
  const at = (i: number) => series.map((s) => Math.max(0, s.values[i] ?? 0));
  const column = (i: number) =>
    stacked ? at(i).reduce((a, b) => a + b, 0) : Math.max(0, ...at(i));
  return Math.max(0, ...Array.from({ length: columns }, (_, i) => column(i)));
}
