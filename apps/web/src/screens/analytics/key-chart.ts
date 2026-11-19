import type { ChartSpec } from '../../ui/chart/use-chart.js';

/**
 * A key page's chart as the new look draws it: a bar, line, mixed or Pareto chart draws in once (the chart door
 * stills it under reduced motion), two or more series name themselves in a legend, and a chart of one series that
 * has no value-axis title takes its series' own name. A scatter or a heat map keeps its spec as it came.
 */
export function drawnChart(spec: ChartSpec): ChartSpec {
  if (spec.kind === 'scatter' || spec.kind === 'heatmap') return spec;
  if (spec.kind === 'pareto') return { ...spec, draw: true };
  if (spec.kind === 'mixed')
    return {
      ...spec,
      draw: true,
      legend: spec.legend ?? spec.bars.length + (spec.line ? 1 : 0) > 1,
    };
  const single = spec.series.length === 1 ? spec.series[0]?.name : undefined;
  return {
    ...spec,
    draw: true,
    legend: spec.legend ?? spec.series.length > 1,
    ...(spec.valueLabel === undefined && single !== undefined ? { valueLabel: single } : {}),
  };
}
