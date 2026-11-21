import { labelPlan, tickWidth, type LabelPlan } from './chart-labels.js';
import type { Palette } from './chart-palette.js';

/** An ECharts option: plain data, built here and handed to `setOption` by the door. */
export type Option = Record<string, unknown>;

/**
 * What every kind starts from. `animation` is false for every chart and so under reduced motion too (D27: the
 * ECharts default of 1 s broke the 300 ms rule); a legend takes a row above the plot.
 */
export function baseOption(
  p: Palette,
  right: number,
  legend: boolean,
  names: string[] = [],
): Option {
  return {
    animation: false,
    textStyle: { fontFamily: p.font, fontSize: 12, color: p.axis },
    grid: {
      left: 8,
      top: legend ? 40 : 24,
      bottom: 8,
      right,
      containLabel: true,
    },
    ...(legend ? { legend: { top: 0, left: 0, data: names, textStyle: { color: p.axis } } } : {}),
  };
}

/** The draw-in a spec asks for with `draw: true`: once, 700 ms (under the 800 ms of DESIGN.md), ease-out. */
export const DRAW_MS = 700;
export function drawOption(draw: true | undefined): Option {
  return draw ? { animation: true, animationDuration: DRAW_MS, animationEasing: 'cubicOut' } : {};
}

/** The option as the browser draws it: under reduced motion nothing animates, whatever the spec asked for. */
export function settle(option: Option, reducedMotion: boolean): Option {
  return reducedMotion ? { ...option, animation: false } : option;
}

/**
 * The option for one draw. The first draw of an instance may animate in (when the spec asked); every later draw (new
 * data into the same chart) is still, so a live update never replays the draw-in. Reduced motion is still always.
 */
export function frameOption(option: Option, draw: { first: boolean; reduced: boolean }): Option {
  return draw.first ? settle(option, draw.reduced) : { ...option, animation: false };
}

/** The tooltip of a chart read by category: one row per series at the pointer, or a tap on a phone. */
export function axisTooltip(kind: 'shadow' | 'line'): Option {
  return { trigger: 'axis', axisPointer: { type: kind }, confine: true };
}

/** The option with room under the plot for a category axis title. */
export function withTitleRoom(option: Option): Option {
  return { ...option, grid: { ...(option.grid as object), bottom: 36 } };
}

/**
 * The category axis; `title` (the spec's `categoryLabel`, asked for by `axisTitles`) names it under the labels. Every
 * label is drawn (`interval: 0`), never skipped for room: `plan` tilts them when they do not fit side by side, and the
 * title sits under the tilted labels.
 */
export function categoryAxis(
  categories: string[],
  p: Palette,
  title?: string,
  plan: LabelPlan = labelPlan(categories, p.width),
) {
  return {
    type: 'category' as const,
    data: categories,
    axisTick: { show: false },
    axisLine: { lineStyle: { color: p.grid } },
    axisLabel: {
      color: p.axis,
      interval: 0,
      hideOverlap: false,
      ...(plan.rotate === 0 ? {} : { rotate: plan.rotate }),
      ...(plan.wrap === undefined ? {} : { width: plan.wrap, overflow: 'break' as const }),
    },
    ...(title === undefined
      ? {}
      : {
          name: title,
          nameLocation: 'middle' as const,
          nameGap: 28 + plan.room,
          nameTextStyle: { color: p.axis },
        }),
  };
}

export function valueAxis(p: Palette) {
  return {
    type: 'value' as const,
    splitLine: { lineStyle: { color: p.grid } },
    axisLabel: { color: p.axis, hideOverlap: true },
  };
}

/** Space between the tick numbers and the rotated title of a vertical value axis, and the room the title takes. */
const TITLE_GAP = 14;
const TITLE_ROOM = 22;

/**
 * The value axis, titled when the chart names its quantity (A9's forecast, the Lab's month hours). A vertical value
 * axis (`top` is the largest value it reaches) puts its title clear of the tick numbers, however wide they are; a
 * horizontal one (no `top`) titles under the axis.
 */
export function titledValueAxis(label: string | undefined, p: Palette, top?: number, unit = '') {
  const axis = valueAxis(p);
  if (label === undefined) return axis;
  return {
    ...axis,
    name: label,
    nameLocation: 'middle' as const,
    nameGap: top === undefined ? 28 : tickWidth(top, unit) + TITLE_GAP,
    nameTextStyle: { color: p.axis },
  };
}

/** The option with room beside the plot for the title of a vertical value axis. */
export function withValueTitleRoom(option: Option): Option {
  return { ...option, grid: { ...(option.grid as object), left: TITLE_ROOM } };
}
