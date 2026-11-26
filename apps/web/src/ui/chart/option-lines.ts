import { endLabelRoom, planOf, topValue } from './chart-labels.js';
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
import { yearOverYear, type YearLine } from './year-over-year.js';

/**
 * How a line is drawn apart from its colour (UX-RULES 21). A loss is solid with round marks; planned and gain lines are
 * dashed with triangles, so no two meanings differ by hue alone. A line with no meaning keeps the kit's own order: the
 * first solid, the rest dashed, the marks alternating round and triangle.
 */
export function strokeOf(
  s: Pick<ChartSeries, 'meaning'>,
  index: number,
): { symbol: 'circle' | 'triangle'; dashed: boolean } {
  if (s.meaning === 'loss') return { symbol: 'circle', dashed: false };
  if (s.meaning === 'planned' || s.meaning === 'gain') return { symbol: 'triangle', dashed: true };
  return { symbol: index % 2 === 0 ? 'circle' : 'triangle', dashed: index > 0 };
}

/** The spec as drawn: months over more than a year turn year over year, with a legend (ADR 0063). */
function drawnSpec(given: LineSpec): { spec: LineSpec; lines?: YearLine[] } {
  if (given.secondAxis === true && given.series.length !== 2)
    throw new Error(`secondAxis needs exactly 2 series, got ${given.series.length}`);
  const yoy = yearOverYear(given);
  return yoy ? { spec: { ...given, ...yoy, legend: true }, lines: yoy.series } : { spec: given };
}

/** A line's colour and weight: the latest year keeps its series' own and is thicker; an older year is thinner, in its own slot. */
function yearLook(line: YearLine | undefined, s: ChartSeries, p: Palette, at: [number, number]) {
  const [i, count] = at;
  const source = line?.source ?? i;
  if (line === undefined || line.current)
    return { source, color: paintOf(s, p, source), size: 8, style: { width: line ? 3 : 2 } };
  return { source, color: paintOf({}, p, i + count), size: 5, style: { width: 1.5, opacity: 0.7 } };
}

/**
 * Lines on one axis or two. An end label names each line, unless a legend does: with a legend the end labels are
 * left off, because two lines that end close together print their names over each other and over the last point.
 */
export function lineOption(given: LineSpec, p: Palette): Option {
  const { spec, lines } = drawnSpec(given);
  const names = spec.series.map((s) => s.name);
  const room = endLabelRoom(names, p.width);
  const natural = endLabelRoom(names);
  const secondAxis = spec.secondAxis === true;
  const legend = spec.legend === true;
  // The second axis has its own scale: only a single-axis chart's title is cleared of the tick numbers by its width.
  const axis = titledValueAxis(spec.valueLabel, p, secondAxis ? undefined : topValue(spec.series));
  const base = baseOption(
    p,
    legend ? 16 : 16 + room,
    legend,
    spec.series.map((s) => s.name),
  );
  const plan = planOf(spec, p.width);
  const titled = spec.axisTitles ? withTitleRoom(base, plan.room) : base;
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
    xAxis: categoryAxis(spec.categories, p, spec.axisTitles ? spec.categoryLabel : undefined, plan),
    yAxis: secondAxis ? [axis, { ...axis, splitLine: { show: false } }] : axis,
    series: spec.series.map((s, i) => {
      const look = yearLook(lines?.[i], s, p, [i, spec.series.length]);
      const stroke = strokeOf(s, look.source);
      return {
        type: 'line' as const,
        name: s.name,
        data: s.values,
        color: look.color,
        ...(secondAxis && look.source === 1 ? { yAxisIndex: 1 } : {}),
        symbol: stroke.symbol,
        symbolSize: look.size,
        showAllSymbol: true,
        lineStyle: {
          ...look.style,
          type: stroke.dashed ? ('dashed' as const) : ('solid' as const),
        },
        endLabel: {
          show: !legend,
          formatter: '{a}',
          color: look.color,
          // A name wider than the room kept for it wraps there.
          ...(room < natural ? { width: room, overflow: 'break' as const } : {}),
        },
      };
    }),
  };
}
