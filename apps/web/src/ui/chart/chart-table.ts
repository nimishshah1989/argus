import { paretoRows, type ChartSpec } from './chart-spec.js';

export interface TableView {
  categoryLabel: string;
  categories: string[];
  series: { name: string; values: (number | undefined)[] }[];
}

/** The one table every kind shares ("Show the numbers"): categories down, series across. */
export function tableView(spec: ChartSpec): TableView {
  switch (spec.kind) {
    case 'scatter':
      return {
        categoryLabel: spec.machineLabel,
        categories: spec.points.map((point) => point.label),
        series: [
          { name: spec.xLabel, values: spec.points.map((point) => point.x) },
          // A labelled lane axis (A9's map) is a category, not a number to read down the table.
          ...(spec.yTickLabels === undefined
            ? [{ name: spec.yLabel, values: spec.points.map((point) => point.y) }]
            : []),
          { name: spec.mttrLabel, values: spec.points.map((point) => point.mttr) },
        ],
      };
    case 'mixed':
      return {
        categoryLabel: spec.categoryLabel,
        categories: spec.categories,
        series: [...spec.bars, ...(spec.line === undefined ? [] : [spec.line])],
      };
    case 'pareto': {
      const rows = paretoRows(spec);
      return {
        categoryLabel: spec.categoryLabel,
        categories: rows.map((row) => row.category),
        series: [
          { name: spec.series[0].name, values: rows.map((row) => row.value) },
          { name: spec.cumulativeLabel, values: rows.map((row) => row.share) },
        ],
      };
    }
    default:
      return {
        categoryLabel: spec.categoryLabel,
        categories: spec.categories,
        series: spec.series,
      };
  }
}
