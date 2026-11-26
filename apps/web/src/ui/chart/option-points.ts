import { seriesColor, toneColor, type Palette } from './chart-palette.js';
import { baseOption, categoryAxis, valueAxis, type Option } from './chart-parts.js';
import { escapeHtml, inkOn, mix, parseHex } from './chart-color.js';
import { pointName, type HeatmapSpec, type ScatterPoint, type ScatterSpec } from './chart-spec.js';

/** One point: its arm, its rating tone and, only where the spec asks, its machine label. */
function scatterItem(point: ScatterPoint, p: Palette) {
  return {
    value: [point.x, point.y],
    symbolSize: point.r,
    name: pointName(point),
    ...(point.tone === undefined
      ? {}
      : { itemStyle: { color: toneColor(point.tone, p, seriesColor(p, 0)) } }),
    ...(point.showLabel === true
      ? {
          label: {
            show: true,
            position: 'right' as const,
            formatter: pointName(point),
            color: p.axis,
            fontSize: 10,
          },
        }
      : {}),
  };
}

/** The share of a map's width its lane names may take before they are cut (the whole name shows on hover). */
const NAME_SHARE = 0.35;

/**
 * A9's map: one named lane per tick, top down. Its margins are set here, not left to ECharts' automatic fit, which
 * shrank this plot to no height at all and drew every lane on one line.
 */
function laneFrame(spec: ScatterSpec, ticks: string[], p: Palette) {
  const width = p.width ?? 640;
  const longest = Math.max(0, ...ticks.map((tick) => tick.length));
  const names = Math.ceil(Math.min(longest * 7, width * NAME_SHARE));
  const left = names + 16;
  // Point names print to the right of their dot, at 10 px: keep room for the longest one past the last tick.
  const labelled = spec.points.filter((point) => point.showLabel === true);
  const right = 16 + 7 * Math.max(0, ...labelled.map((point) => pointName(point).length));
  return {
    grid: { left, right, top: 8, bottom: 56, containLabel: false, outerBoundsMode: 'none' },
    titleWidth: Math.max(80, width - left - right),
    yAxis: {
      type: 'value' as const,
      inverse: true,
      // Whole-number ends, so every tick (and its name) sits on its lane's own line, half the margin each side.
      min: -1,
      max: ticks.length,
      interval: 1,
      splitLine: { show: false },
      // A cut name shows whole in the tooltip of its label.
      tooltip: { show: true },
      axisLabel: {
        color: p.axis,
        interval: 0,
        width: names,
        overflow: 'truncate' as const,
        formatter: (value: string | number) => ticks[Math.round(Number(value))] ?? '',
      },
    },
  };
}

export function scatterOption(spec: ScatterSpec, p: Palette): Option {
  const named = {
    ...valueAxis(p),
    nameLocation: 'middle' as const,
    nameGap: 28,
    nameTextStyle: { color: p.axis },
  };
  const lanes = spec.yTickLabels === undefined ? undefined : laneFrame(spec, spec.yTickLabels, p);
  return {
    ...baseOption(p, 24, false),
    // Room for both axis titles, which sit outside the labels.
    grid: lanes?.grid ?? { ...(baseOption(p, 24, false).grid as object), left: 28, bottom: 32 },
    tooltip: {
      trigger: 'item',
      confine: true,
      formatter: (params: unknown) => {
        const name = (params as { name?: string }).name;
        const mttr = spec.points.find((point) => pointName(point) === name)?.mttr;
        const label = escapeHtml(String(name ?? ''));
        return mttr === undefined ? label : `${label}<br/>${escapeHtml(spec.mttrLabel)}: ${mttr}`;
      },
    },
    xAxis: {
      ...named,
      name: spec.xLabel,
      // The x axis runs under the lanes, not along lane zero.
      ...(lanes ? { axisLine: { onZero: false } } : {}),
      // A long title wraps under the plot instead of running off the card.
      ...(lanes
        ? { nameTextStyle: { color: p.axis, width: lanes.titleWidth, overflow: 'break' as const } }
        : {}),
    },
    yAxis: lanes?.yAxis ?? { ...named, name: spec.yLabel },
    series: [
      {
        type: 'scatter',
        // Two point names that would print over each other: one gives way (its dot keeps its tooltip).
        labelLayout: { hideOverlap: true },
        data: spec.points.map((point) => scatterItem(point, p)),
      },
    ],
  };
}

/** The label ink for a cell `t` (0 to 1) up the scale from the grid ink to the series colour: black or white. */
function cellInk(t: number, p: Palette, color: string | undefined): string {
  const from = parseHex(p.grid);
  const to = color === undefined ? undefined : parseHex(color);
  return from && to ? inkOn(mix(from, to, Math.max(0, t))) : p.axis;
}

/**
 * A heatmap: rows down, columns across, each cell's depth of colour its value (one hue, so it never reads as a
 * status) and its number printed inside; a gap stays empty.
 */
export function heatmapOption(spec: HeatmapSpec, p: Palette): Option {
  const columns = spec.series.map((s) => s.name);
  const cells = spec.series.flatMap((column, c) =>
    column.values.flatMap((value, r) => (value === undefined ? [] : [{ r, c, value }])),
  );
  const top = Math.max(1, ...cells.map((cell) => cell.value));
  const color = seriesColor(p, 0);
  return {
    ...baseOption(p, 16, false),
    tooltip: {
      trigger: 'item',
      confine: true,
      formatter: (params: unknown) => {
        const [c, r] = (params as { value?: number[] }).value ?? [];
        const value = spec.series[c ?? 0]?.values[r ?? 0];
        const row = escapeHtml(spec.categories[r ?? 0] ?? '');
        return `${row}, ${escapeHtml(columns[c ?? 0] ?? '')}: ${value ?? ''}`;
      },
    },
    // The grid keeps ECharts' own label spacing: its rows and columns are short names.
    xAxis: {
      ...categoryAxis(columns, p),
      axisLabel: { color: p.axis },
      splitArea: { show: false },
    },
    yAxis: { ...categoryAxis(spec.categories, p), axisLabel: { color: p.axis }, inverse: true },
    // The colour scale runs from the grid ink to the first series colour; it is not drawn, the cells carry numbers.
    visualMap: { show: false, min: 0, max: top, dimension: 2, inRange: { color: [p.grid, color] } },
    series: [
      {
        type: 'heatmap' as const,
        data: cells.map((cell) => ({
          value: [cell.c, cell.r, cell.value],
          label: { color: cellInk(cell.value / top, p, color) },
        })),
        label: { show: true, color: p.axis },
        itemStyle: { borderColor: p.grid, borderWidth: 1 },
      },
    ],
  };
}
