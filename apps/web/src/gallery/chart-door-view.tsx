import { Chart } from '../ui/chart/chart.js';
import type { ChartSpec } from '../ui/chart/use-chart.js';

/** Invented numbers, one chart per kind the door draws (ticket 84); the view is not a gallery section. */
const CAUSES = ['Wear', 'Heat', 'Oil', 'Dust'];
const hours = { name: 'Hours', values: [6, 2, 9, 4] };
const jobs = { name: 'Jobs', values: [3, 5, 1, 2] };

const SPECS: ChartSpec[] = [
  { kind: 'bar', title: 'Bars', categoryLabel: 'Cause', categories: CAUSES, series: [hours] },
  {
    kind: 'bar',
    title: 'Stacked bars',
    categoryLabel: 'Cause',
    categories: CAUSES,
    series: [hours, jobs],
    stacked: true,
  },
  {
    kind: 'bar',
    title: 'Horizontal bars',
    categoryLabel: 'Cause',
    categories: CAUSES,
    series: [hours],
    horizontal: true,
  },
  {
    kind: 'line',
    title: 'Lines',
    categoryLabel: 'Cause',
    categories: CAUSES,
    series: [hours, jobs],
  },
  {
    kind: 'scatter',
    title: 'Scatter',
    machineLabel: 'Machine',
    xLabel: 'Hours',
    yLabel: 'Jobs',
    mttrLabel: 'MTTR',
    points: CAUSES.map((label, at) => ({
      x: hours.values[at]!,
      y: jobs.values[at]!,
      r: 10,
      label,
      mttr: at + 1,
    })),
  },
  {
    kind: 'heatmap',
    title: 'Heat map',
    categoryLabel: 'Cause',
    categories: CAUSES,
    series: [hours, jobs],
  },
  {
    kind: 'pareto',
    title: 'Pareto',
    categoryLabel: 'Cause',
    categories: CAUSES,
    series: [hours],
    cumulativeLabel: 'Cumulative %',
  },
];

export default function ChartDoorView() {
  return (
    <main data-testid="chart-door" className="mx-auto flex max-w-3xl flex-col gap-6 p-4">
      {SPECS.map((spec) => (
        <Chart key={spec.title} spec={spec} />
      ))}
    </main>
  );
}
