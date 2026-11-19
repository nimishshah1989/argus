import type { Palette } from './chart-palette.js';
import type { Option } from './chart-parts.js';
import type { ChartSpec } from './chart-spec.js';
import { barOption, mixedOption, paretoOption } from './option-bars.js';
import { lineOption } from './option-lines.js';
import { heatmapOption, scatterOption } from './option-points.js';

/** The ECharts option for a spec; the one exported builder the node tests pin. */
export function chartOption(spec: ChartSpec, p: Palette): Option {
  switch (spec.kind) {
    case 'bar':
      return barOption(spec, p);
    case 'line':
      return lineOption(spec, p);
    case 'scatter':
      return scatterOption(spec, p);
    case 'mixed':
      return mixedOption(spec, p);
    case 'heatmap':
      return heatmapOption(spec, p);
    case 'pareto':
      return paretoOption(spec, p);
  }
}
