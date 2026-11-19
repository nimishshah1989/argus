/** A design token a series or point can be drawn in; absent keeps the kit's series colour. */
export type ChartTone = 'danger' | 'warning' | 'info' | 'hold' | 'moved' | 'ok' | 'muted';

export interface ChartSeries {
  name: string; // translated; end label, table header
  values: (number | undefined)[]; // one per category; a gap where the plant had no value
  /** The series' own tone (the Lab's actual line, the forecast's plan); absent keeps its palette slot. */
  tone?: ChartTone;
  /** One tone per category (a bar coloured by band); absent keeps the series colour. */
  tones?: (ChartTone | undefined)[];
}
export interface ScatterPoint {
  x: number;
  y: number;
  r: number; // bubble radius
  label: string; // the machine, data not copy
  mttr?: number;
  /** The point's rating tone (A9's map); absent keeps the series colour. */
  tone?: ChartTone;
  /** Whether the point prints its label; A9 labels only High and Critical. */
  showLabel?: boolean;
}

/**
 * `legend` forces the legend on or off; absent keeps each kind's default (stacked bars and Pareto show one). A
 * caller drawing several series with no end labels (side-by-side bars, mixed) must pass `legend: true`.
 */
export interface LegendChoice {
  legend?: boolean;
  /** Draw the chart in once, in 700 ms (ease-out), when it first appears; never under reduced motion. Absent: no animation. */
  draw?: true;
}
export type ChartSpec =
  | ({
      kind: 'bar';
      title: string;
      categoryLabel: string;
      categories: string[];
      series: ChartSeries[];
      /** The value axis title; absent leaves the axis unnamed. */
      valueLabel?: string;
      /** Draw the bars horizontally (long machine labels, the planning chart). */
      horizontal?: true;
      /** Stack the series into one bar per category. */
      stacked?: true;
    } & LegendChoice)
  | ({
      kind: 'line';
      title: string;
      categoryLabel: string;
      categories: string[];
      series: ChartSeries[];
      /** Two series on two axes: the first on the left, the second on the right. */
      secondAxis?: boolean;
      /** The value axis title. */
      valueLabel?: string;
    } & LegendChoice)
  | {
      kind: 'scatter';
      title: string;
      machineLabel: string;
      xLabel: string;
      yLabel: string;
      mttrLabel: string;
      points: ScatterPoint[];
      /** The raw category per lane (A9's map); the y axis reads these instead of numbers. */
      yTickLabels?: string[];
    }
  | ({
      kind: 'mixed';
      title: string;
      categoryLabel: string;
      categories: string[];
      bars: ChartSeries[];
      line?: ChartSeries;
    } & LegendChoice)
  | {
      /** Two dimensions: one row per category, one series per column; a cell's depth of colour is its value. */
      kind: 'heatmap';
      title: string;
      categoryLabel: string;
      categories: string[]; // rows
      series: ChartSeries[]; // columns: `name` heads the column, `values` run down the rows
    }
  | ({
      /** Bars in falling order of one measure, with the running share of the total as a line (0 to 100 %). */
      kind: 'pareto';
      title: string;
      categoryLabel: string;
      categories: string[];
      series: [ChartSeries];
      cumulativeLabel: string; // translated; the line's name and the table header
    } & LegendChoice);

export type ChartState = 'loading' | 'ready' | 'error';

export type BarSpec = Extract<ChartSpec, { kind: 'bar' }>;
export type LineSpec = Extract<ChartSpec, { kind: 'line' }>;
export type ScatterSpec = Extract<ChartSpec, { kind: 'scatter' }>;
export type MixedSpec = Extract<ChartSpec, { kind: 'mixed' }>;
export type HeatmapSpec = Extract<ChartSpec, { kind: 'heatmap' }>;
export type ParetoSpec = Extract<ChartSpec, { kind: 'pareto' }>;

/**
 * A Pareto spec in falling order with the cumulative share of each step; the option and the table share it. A
 * category with no value (a gap) is left out: it is neither a bar nor a zero in the total.
 */
export function paretoRows(spec: ParetoSpec): { category: string; value: number; share: number }[] {
  const rows = spec.categories
    .flatMap((category, at) => {
      const value = spec.series[0].values[at];
      return value === undefined ? [] : [{ category, value }];
    })
    .sort((a, b) => b.value - a.value);
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  let running = 0;
  return rows.map((row) => {
    running += row.value;
    return { ...row, share: total === 0 ? 0 : Math.round((running / total) * 1000) / 10 };
  });
}
