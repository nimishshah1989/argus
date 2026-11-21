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

/** The y axis: numbers, or (A9's map) one named lane per tick, top down. */
function scatterYAxis(spec: ScatterSpec, named: object, p: Palette) {
  const ticks = spec.yTickLabels;
  if (ticks === undefined) return { ...named, name: spec.yLabel };
  return {
    ...named,
    name: spec.yLabel,
    inverse: true,
    min: -0.6,
    max: ticks.length - 0.4,
    interval: 1,
    splitLine: { show: false },
    axisLabel: {
      color: p.axis,
      interval: 0,
      formatter: (value: string | number) => ticks[Math.round(Number(value))] ?? '',
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
  return {
    ...baseOption(p, 24, false),
    // Room for both axis titles, which sit outside the labels.
    grid: { ...(baseOption(p, 24, false).grid as object), left: 28, bottom: 32 },
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
    xAxis: { ...named, name: spec.xLabel },
    yAxis: scatterYAxis(spec, named, p),
    series: [{ type: 'scatter', data: spec.points.map((point) => scatterItem(point, p)) }],
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
