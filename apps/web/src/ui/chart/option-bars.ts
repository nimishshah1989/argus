import { seriesColor, toneColor, type Palette } from './chart-palette.js';
import {
  axisTooltip,
  baseOption,
  categoryAxis,
  titledValueAxis,
  valueAxis,
  type Option,
} from './chart-parts.js';
import { paretoRows, type BarSpec, type MixedSpec, type ParetoSpec } from './chart-spec.js';

/** Bars, side by side or stacked, vertical or horizontal; two or more series get a legend when stacked. */
export function barOption(spec: BarSpec, p: Palette): Option {
  const horizontal = spec.horizontal === true;
  const stacked = spec.stacked === true;
  const legend = spec.legend ?? (stacked && spec.series.length >= 2);
  const category = categoryAxis(spec.categories, p);
  const value = titledValueAxis(spec.valueLabel, p);
  return {
    ...baseOption(
      p,
      16,
      legend,
      spec.series.map((s) => s.name),
    ),
    tooltip: axisTooltip('shadow'),
    xAxis: horizontal ? value : category,
    yAxis: horizontal ? category : value,
    series: spec.series.map((series, index) => {
      const color = toneColor(series.tone, p, seriesColor(p, index));
      return {
        type: 'bar' as const,
        name: series.name,
        data:
          series.tones === undefined
            ? series.values
            : series.values.map((item, at) => ({
                value: item ?? null,
                itemStyle: { color: toneColor(series.tones?.[at], p, color) },
              })),
        color,
        ...(stacked ? { stack: 'total' } : {}),
        label: {
          show: !stacked,
          position: horizontal ? ('right' as const) : ('top' as const),
          color: p.axis,
        },
      };
    }),
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
    tooltip: axisTooltip('shadow'),
    xAxis: categoryAxis(spec.categories, p),
    yAxis: [valueAxis(p), { ...valueAxis(p), splitLine: { show: false } }],
    series: [
      ...spec.bars.map((s, i) => ({
        type: 'bar' as const,
        name: s.name,
        data: s.values,
        // One colour for the stack unless a legend must tell its parts apart.
        color: legend ? seriesColor(p, i) : p.series[0],
        stack: 'total',
      })),
      ...(spec.line === undefined
        ? []
        : [
            secondAxisLine(
              spec.line.name,
              spec.line.values,
              legend ? seriesColor(p, spec.bars.length) : p.series[1],
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
        color: toneColor(spec.series[0].tone, p, seriesColor(p, 0)),
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
