import { sidePlan, topValue } from './chart-labels.js';
import { paintOf, seriesColor, toneColor, type Palette } from './chart-palette.js';
import {
  axisTooltip,
  baseOption,
  drawOption,
  categoryAxis,
  titledValueAxis,
  valueAxis,
  withTitleRoom,
  withValueTitleRoom,
  type Option,
} from './chart-parts.js';
import {
  paretoRows,
  type BarSpec,
  type ChartMeaning,
  type MixedSpec,
  type ParetoSpec,
} from './chart-spec.js';

/** The two axes of a bar chart: the categories (the biggest first in a ranking) and the value, with its unit. */
function barAxes(spec: BarSpec, p: Palette, title: string | undefined) {
  const horizontal = spec.horizontal === true;
  const ranked = spec.highlight !== undefined && spec.series.length === 1;
  const category = {
    // Down the side the names sit flat, one to a row (the box is made tall enough for every row).
    ...categoryAxis(
      spec.categories,
      p,
      title,
      horizontal ? sidePlan(spec.categories, p.width) : undefined,
    ),
    // A ranking reads from the top down: the biggest first.
    ...(ranked && horizontal ? { inverse: true } : {}),
  };
  const top = horizontal ? undefined : topValue(spec.series, spec.stacked === true);
  const value = {
    ...titledValueAxis(spec.valueLabel, p, top, spec.unit),
    ...(spec.unit === undefined
      ? {}
      : { axisLabel: { color: p.axis, formatter: `{value}${spec.unit}` } }),
  };
  return horizontal ? { xAxis: value, yAxis: category } : { xAxis: category, yAxis: value };
}

/** The bar series: a meaning or tone colours a series, a ranking colours its first few bars (accent) apart from the rest. */
function barSeries(spec: BarSpec, p: Palette) {
  const ranked = spec.highlight !== undefined && spec.series.length === 1;
  return spec.series.map((series, index) => {
    const color = paintOf(series, p, index);
    // A ranking: the worst few in the accent, the rest quiet (UX-RULES 24: colour on few marks).
    const colourAt = (at: number) =>
      ranked
        ? seriesColor(p, at < (spec.highlight ?? 0) ? 0 : 1)
        : toneColor(series.tones?.[at], p, color);
    return {
      type: 'bar' as const,
      name: series.name,
      data:
        series.tones === undefined && !ranked
          ? series.values
          : series.values.map((item, at) => ({
              value: item ?? null,
              itemStyle: { color: colourAt(at) },
            })),
      color,
      ...plannedStyle(series.meaning, p),
      ...(spec.stacked === true ? { stack: 'total' } : {}),
      label: {
        show: spec.stacked !== true,
        position: spec.horizontal === true ? ('right' as const) : ('top' as const),
        color: p.axis,
      },
    };
  });
}

/** Bars, side by side or stacked, vertical or horizontal; two or more series get a legend when stacked. */
export function barOption(spec: BarSpec, p: Palette): Option {
  const horizontal = spec.horizontal === true;
  const stacked = spec.stacked === true;
  const legend = spec.legend ?? (stacked && spec.series.length >= 2);
  // Horizontal bars keep their long machine labels on the left: the title is for the vertical chart.
  const title = spec.axisTitles && !horizontal ? spec.categoryLabel : undefined;
  const base = baseOption(
    p,
    // A bar's value label sits past its end: keep room for it at the edge.
    horizontal ? 64 : 16,
    legend,
    spec.series.map((s) => s.name),
  );
  const titled = title === undefined ? base : withTitleRoom(base);
  return {
    ...(spec.valueLabel === undefined || horizontal ? titled : withValueTitleRoom(titled)),
    ...drawOption(spec.draw),
    tooltip: axisTooltip('shadow'),
    ...barAxes(spec, p, title),
    series: barSeries(spec, p),
  };
}

/**
 * A planned series is drawn striped as well as blue: the stripes are the card's surface colour, so the bar differs
 * from a loss bar in pattern as well as hue (UX-RULES 21: never colour alone).
 */
export function plannedStyle(meaning: ChartMeaning | undefined, p: Palette): Option {
  if (meaning !== 'planned') return {};
  return {
    itemStyle: {
      decal: {
        symbol: 'rect',
        dashArrayX: [1, 0],
        dashArrayY: [3, 4],
        rotation: Math.PI / 4,
        ...(p.surface ? { color: p.surface } : {}),
      },
    },
  };
}

/** The line that rides the right-hand axis in the mixed and Pareto charts. */
function secondAxisLine(
  name: string,
  data: unknown[],
  color: string | undefined,
  extra: Option = {},
) {
  return {
    type: 'line' as const,
    name,
    data,
    color,
    yAxisIndex: 1,
    symbol: 'circle',
    symbolSize: 8,
    showAllSymbol: true,
    lineStyle: { width: 2, type: 'dashed' as const },
    endLabel: { show: true, formatter: '{a}', color },
    ...extra,
  };
}

export function mixedOption(spec: MixedSpec, p: Palette): Option {
  const legend = spec.legend === true;
  const names = [...spec.bars, ...(spec.line === undefined ? [] : [spec.line])].map((s) => s.name);
  return {
    ...baseOption(p, 16, legend, names),
    ...drawOption(spec.draw),
    tooltip: axisTooltip('shadow'),
    xAxis: categoryAxis(spec.categories, p),
    yAxis: [valueAxis(p), { ...valueAxis(p), splitLine: { show: false } }],
    series: [
      ...spec.bars.map((s, i) => ({
        type: 'bar' as const,
        name: s.name,
        data: s.values,
        // One colour for the stack unless a legend must tell its parts apart; a meaning always colours.
        color: paintOf(s, p, legend ? i : 0),
        ...plannedStyle(s.meaning, p),
        stack: 'total',
      })),
      ...(spec.line === undefined
        ? []
        : [
            secondAxisLine(
              spec.line.name,
              spec.line.values,
              legend ? seriesColor(p, spec.bars.length) : p.series[1],
              // With a legend the line is named there; an end label would crowd the right axis.
              legend ? { endLabel: { show: false } } : {},
            ),
          ]),
    ],
  };
}

/** A Pareto: bars in falling order on the left axis, the running share (0 to 100 %) as a line on the right. */
export function paretoOption(spec: ParetoSpec, p: Palette): Option {
  const rows = paretoRows(spec);
  const names = [spec.series[0].name, spec.cumulativeLabel];
  return {
    ...baseOption(p, 40, spec.legend ?? true, names),
    ...drawOption(spec.draw),
    tooltip: axisTooltip('shadow'),
    xAxis: categoryAxis(
      rows.map((row) => row.category),
      p,
    ),
    yAxis: [valueAxis(p), { ...valueAxis(p), min: 0, max: 100, splitLine: { show: false } }],
    series: [
      {
        type: 'bar' as const,
        name: spec.series[0].name,
        data: rows.map((row) => row.value),
        color: paintOf(spec.series[0], p, 0),
        ...plannedStyle(spec.series[0].meaning, p),
        label: { show: true, position: 'top' as const, color: p.axis },
      },
      secondAxisLine(
        spec.cumulativeLabel,
        rows.map((row) => row.share),
        seriesColor(p, 1),
        { endLabel: { show: false } },
      ),
    ],
  };
}
