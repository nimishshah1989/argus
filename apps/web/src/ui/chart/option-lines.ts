import { seriesColor, toneColor, type Palette } from './chart-palette.js';
import {
  axisTooltip,
  baseOption,
  categoryAxis,
  titledValueAxis,
  type Option,
} from './chart-parts.js';
import type { LineSpec } from './chart-spec.js';

/** Lines on one axis or two; an end label names each line, a legend does too when the spec asks. */
export function lineOption(spec: LineSpec, p: Palette): Option {
  const longest = Math.max(...spec.series.map((s) => s.name.length));
  if (spec.secondAxis === true && spec.series.length !== 2)
    throw new Error(`secondAxis needs exactly 2 series, got ${spec.series.length}`);
  const secondAxis = spec.secondAxis === true;
  const axis = titledValueAxis(spec.valueLabel, p);
  return {
    ...baseOption(
      p,
      16 + 7 * longest,
      spec.legend === true,
      spec.series.map((s) => s.name),
    ),
    tooltip: axisTooltip('line'),
    xAxis: categoryAxis(spec.categories, p),
    yAxis: secondAxis ? [axis, { ...axis, splitLine: { show: false } }] : axis,
    series: spec.series.map((s, i) => ({
      type: 'line' as const,
      name: s.name,
      data: s.values,
      color: toneColor(s.tone, p, seriesColor(p, i)),
      ...(secondAxis && i === 1 ? { yAxisIndex: 1 } : {}),
      symbol: (['circle', 'triangle'] as const)[i % 2],
      symbolSize: 8,
      showAllSymbol: true,
      lineStyle: { width: 2, type: (i === 0 ? 'solid' : 'dashed') as 'solid' | 'dashed' },
      endLabel: {
        show: true,
        formatter: '{a}',
        color: toneColor(s.tone, p, seriesColor(p, i)),
      },
    })),
  };
}
