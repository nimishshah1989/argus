import { planOf, topValue } from './chart-labels.js';
import { paintOf, type Palette } from './chart-palette.js';
import {
  axisTooltip,
  baseOption,
  categoryAxis,
  drawOption,
  titledValueAxis,
  withTitleRoom,
  withValueTitleRoom,
  type Option,
} from './chart-parts.js';
import type { ChartSeries, LineSpec } from './chart-spec.js';

/** A planned line is always dashed with triangle marks, and a loss or gain line solid with round ones: pattern and hue. */
function strokeOf(s: ChartSeries, index: number): { symbol: string; dashed: boolean } {
  const dashed = s.meaning === 'planned' || (s.meaning === undefined && index % 2 === 1);
  return { symbol: dashed ? 'triangle' : 'circle', dashed };
}

/**
 * Lines on one axis or two. An end label names each line, unless a legend does: with a legend the end labels are
 * left off, because two lines that end close together print their names over each other and over the last point.
 */
export function lineOption(spec: LineSpec, p: Palette): Option {
  const longest = Math.max(...spec.series.map((s) => s.name.length));
  if (spec.secondAxis === true && spec.series.length !== 2)
    throw new Error(`secondAxis needs exactly 2 series, got ${spec.series.length}`);
  const secondAxis = spec.secondAxis === true;
  const legend = spec.legend === true;
  // The second axis has its own scale: only a single-axis chart's title is cleared of the tick numbers by its width.
  const axis = titledValueAxis(spec.valueLabel, p, secondAxis ? undefined : topValue(spec.series));
  const base = baseOption(
    p,
    legend ? 16 : 16 + 7 * longest,
    legend,
    spec.series.map((s) => s.name),
  );
  const titled = spec.axisTitles ? withTitleRoom(base) : base;
  return {
    ...(spec.valueLabel === undefined || secondAxis ? titled : withValueTitleRoom(titled)),
    ...drawOption(spec.draw),
    tooltip: spec.tooltipClass
      ? {
          ...axisTooltip('line'),
          className: spec.tooltipClass,
          backgroundColor: 'transparent',
          borderWidth: 0,
          padding: 0,
          extraCssText: 'box-shadow:none;',
        }
      : axisTooltip('line'),
    xAxis: categoryAxis(
      spec.categories,
      p,
      spec.axisTitles ? spec.categoryLabel : undefined,
      planOf(spec, p.width),
    ),
    yAxis: secondAxis ? [axis, { ...axis, splitLine: { show: false } }] : axis,
    series: spec.series.map((s, i) => {
      const stroke = strokeOf(s, i);
      const color = paintOf(s, p, i);
      return {
        type: 'line' as const,
        name: s.name,
        data: s.values,
        color,
        ...(secondAxis && i === 1 ? { yAxisIndex: 1 } : {}),
        symbol: stroke.symbol,
        symbolSize: 8,
        showAllSymbol: true,
        lineStyle: { width: 2, type: stroke.dashed ? ('dashed' as const) : ('solid' as const) },
        endLabel: { show: !legend, formatter: '{a}', distance: 10, color },
      };
    }),
  };
}
