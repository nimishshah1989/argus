import type { FigureMeaning, Unit, Direction } from './types.js';

const f = (unit: Unit, better: Direction): FigureMeaning => ({ unit, better });
const count = f('count', 'neither');
const nothing = f('none', 'neither');

/**
 * The unit and good direction of every registry figure (`FIGURE_KEYS`; `meaning.test.ts` fails when a key has no
 * entry here). Down is good for breakdowns, downtime, repair time and the share of time lost; up is good for
 * availability, time between failures, compliance and breakdown-free machines; a count of machines, registers or
 * logs, and anything that is a picture rather than a number, has no good direction.
 * The judgement calls (`neither` where an owner could argue) are listed in `JUDGEMENT_KEYS`.
 */
export const FIGURE_MEANING: Readonly<Record<string, FigureMeaning>> = {
  'dashboard.total-machines': count,
  'dashboard.utilities': count,
  'dashboard.dg-sets': count,
  'dashboard.cnc-machines': count,
  'dashboard.conventional-machines': count,
  'dashboard.process-machines': count,
  'dashboard.total-breakdowns': f('count', 'down'),
  'dashboard.total-downtime-hours': f('hours', 'down'),
  'dashboard.pm-hours': f('hours', 'neither'),
  'dashboard.no-downtime-hours': f('hours', 'neither'),
  'dashboard.breakdown-free': f('count', 'up'),
  'dashboard.costliest-problems': f('hours', 'down'),
  'dashboard.bubble-chart': nothing,
  'dashboard.expansion-timeline': nothing,
  'dashboard.plant-events': f('hours', 'down'),
  'dashboard.fleet-availability': f('percent', 'up'),
  'dashboard.plant-bd-pct': f('percent', 'down'),
  'dashboard.avg-complaints-per-day': f('perDay', 'down'),
  'dashboard.avg-bd-hours-per-day': f('hoursPerDay', 'down'),
  'dashboard.avg-bd-hours-per-machine': f('hoursPerMachine', 'down'),
  'data-checklist': nothing,
  registers: count,
  'cell-change-log': count,
  'a7-footprint': nothing,
  'a8-age': f('years', 'neither'),
  'oem-analytics': nothing,
  'machine-page': nothing,
  'breakdown-log': count,
  'a1-bd-pm': {
    ...f('percent', 'down'),
    parts: { breakdown: f('percent', 'down'), pm: f('percent', 'neither') },
  },
  'a2-category-cell': f('count', 'down'),
  'a3-mttr-mtbf': {
    ...f('hours', 'neither'),
    parts: { mttr: f('hours', 'down'), mtbf: f('hours', 'up') },
  },
  'a4-manpower': f('hours', 'neither'),
  'a5-energy': nothing,
  'a6-why-why': count,
  'a10-problems': f('hours', 'down'),
  'a9-bottleneck-forecast': nothing,
  'forecast-lab': nothing,
  compare: f('score', 'up'),
  'compare.spares-cost': f('money', 'neither'),
  'team-focus': count,
  'team-focus.cost': f('money', 'neither'),
  'money-matters': f('money', 'neither'),
  'fix-finder': nothing,
  'action-center': count,
  'action-center.spares-spend': f('money', 'neither'),
  'monthly-report': nothing,
  'annual-report': nothing,
  'shift-kpis.compare': nothing,
  'shift-kpis.shift-split': {
    ...count,
    parts: { breakdowns: f('count', 'down'), hours: f('hours', 'down'), mttr: f('hours', 'down') },
  },
  'shift-kpis.backlog': f('count', 'down'),
  'pm-compliance': f('percent', 'up'),
  'shift-kpis.breakdown-map': nothing,
  reliability: nothing,
};

/** Where `neither` is a call for the product owner, not a fact of the domain (listed in the PR body). `key#part` names one measure of a figure. */
export const JUDGEMENT_KEYS: readonly string[] = [
  'dashboard.pm-hours',
  'a1-bd-pm#pm',
  'dashboard.no-downtime-hours',
  'a4-manpower',
  'compare.spares-cost',
  'team-focus.cost',
  'money-matters',
  'action-center.spares-spend',
  'data-checklist',
];
