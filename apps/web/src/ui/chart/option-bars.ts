import { planOf, sidePlan, topValue, type LabelPlan } from './chart-labels.js';
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

/** The two axes of a bar chart: the categories (the worst first in a ranking) and the value, with its unit. */
function barAxes(spec: BarSpec, p: Palette, title: string | undefined, plan: LabelPlan) {
  const horizontal = spec.horizontal === true;
  const ranked = spec.highlight !== undefined && spec.series.length === 1;
  // A ranking reads from the top down: the first category on the top row.
  const category = {
    ...categoryAxis(spec.categories, p, title, plan),
    ...(ranked && horizontal ? { inverse: true } : {}),
  };
  const top = horizontal ? undefined : topValue(spec.series, spec.stacked === true);
  const value = {
    ...titledValueAxis(spec.valueLabel, p, top, spec.unit),
    ...(spec.unit === undefined
      ? {}
      : {
          axisLabel: {
            color: p.axis,
            hideOverlap: p.fixed !== true,
            formatter: `{value}${spec.unit}`,
          },
        }),
  };
  return horizontal ? { xAxis: value, yAxis: category } : { xAxis: category, yAxis: value };
}

/**
 * The bar series. A meaning or tone colours a series. In a ranking the first `highlight` bars that have a value take the
 * series' colour (its meaning's, else the accent) and the rest stay neutral (UX-RULES 24: colour on few marks); a bar
 * of nothing is never marked.
 */
function barSeries(spec: BarSpec, p: Palette) {
  const ranked = spec.highlight !== undefined && spec.series.length === 1;
  const unit = spec.unit ?? '';
  return spec.series.map((series, index) => {
    const color = paintOf(series, p, index);
    const colourAt = (at: number) =>
      ranked
        ? at < (spec.highlight ?? 0) && (series.values[at] ?? 0) > 0
          ? color
          : seriesColor(p, 1)
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
        ...(unit === '' ? {} : { formatter: `{c}${unit}` }),
      },
    };
  });
}

/** Bars, side by side or stacked, vertical or horizontal; two or more series get a legend when stacked. */
export function barOption(spec: BarSpec, p: Palette): Option {
  const horizontal = spec.horizontal === true;
  // Horizontal bars keep their long machine labels on the left: the category title is for the vertical chart.
  const title = spec.axisTitles && !horizontal ? spec.categoryLabel : undefined;
  // Down the side the names sit flat, one to a row (the box is made tall enough for every row).
  const plan = horizontal ? sidePlan(spec.categories, p.width) : planOf(spec, p.width);
  return {
    ...barFrame(spec, p, title, plan),
    ...drawOption(spec.draw),
    tooltip: barTooltip(spec.unit),
    ...barAxes(spec, p, title, plan),
    series: barSeries(spec, p),
  };
}

/** The tooltip of a bar chart; a percent chart prints its unit after each value. */
function barTooltip(unit: string | undefined): Option {
  const tooltip = axisTooltip('shadow');
  return unit === undefined
    ? tooltip
    : { ...tooltip, valueFormatter: (v: unknown) => `${String(v)}${unit}` };
}

/** The plot's margins: room for the legend, for a title under the plot, and beside it for a vertical value title. */
function barFrame(spec: BarSpec, p: Palette, title: string | undefined, plan: LabelPlan): Option {
  const horizontal = spec.horizontal === true;
  const legend = spec.legend ?? (spec.stacked === true && spec.series.length >= 2);
  const base = baseOption(
    p,
    // A bar's value label sits past its end: keep room for it at the edge.
    horizontal && !p.fixed ? 64 : 16,
    legend,
    spec.series.map((s) => s.name),
  );
  // A title under the plot: the category title of a vertical chart, the value title of a horizontal one.
  const underTitle =
    title !== undefined || (horizontal && spec.valueLabel !== undefined && !p.fixed);
  const titled = underTitle ? withTitleRoom(base, horizontal ? 0 : plan.room) : base;
  return spec.valueLabel === undefined || horizontal ? titled : withValueTitleRoom(titled);
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
    xAxis: categoryAxis(spec.categories, p, undefined, planOf(spec, p.width)),
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
      undefined,
      planOf(spec, p.width),
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
