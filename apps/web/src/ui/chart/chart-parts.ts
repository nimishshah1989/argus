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
    grid: { left: 8, top: legend ? 40 : 24, bottom: 8, right, containLabel: true },
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

/** The tooltip of a chart read by category: one row per series at the pointer, or a tap on a phone. */
export function axisTooltip(kind: 'shadow' | 'line'): Option {
  return { trigger: 'axis', axisPointer: { type: kind }, confine: true };
}

export function categoryAxis(categories: string[], p: Palette) {
  return {
    type: 'category' as const,
    data: categories,
    axisTick: { show: false },
    axisLine: { lineStyle: { color: p.grid } },
    axisLabel: { color: p.axis },
  };
}

export function valueAxis(p: Palette) {
  return {
    type: 'value' as const,
    splitLine: { lineStyle: { color: p.grid } },
    axisLabel: { color: p.axis },
  };
}

/** The value axis, titled when the chart names its quantity (A9's forecast, the Lab's month hours). */
export function titledValueAxis(label: string | undefined, p: Palette) {
  const axis = valueAxis(p);
  if (label === undefined) return axis;
  return {
    ...axis,
    name: label,
    nameLocation: 'middle' as const,
    nameGap: 28,
    nameTextStyle: { color: p.axis },
  };
}
