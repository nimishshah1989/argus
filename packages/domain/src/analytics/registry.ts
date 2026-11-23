import type { DrillType } from '@uptimo/shared';

/**
 * Every figure the analytics face can show, with the ticket that computes it and the kind of row it drills to.
 * A figure with no drill type does not compile, and `registry.test.ts` fails on a registered figure that loses
 * one. Engines 38 to 45 add their computations in `computers.ts` under the same keys.
 *
 * Owners 43 and 44 split the money tiles of a mixed screen into their own `money` keys, as `compare.spares-cost`,
 * `team-focus.cost` and `action-center.spares-spend` are here. Owner 45 does the same for the monthly and annual
 * reports if they carry cost (not checked yet).
 */
export interface FigureDef {
  key: string;
  screen: string;
  owner: number;
  label: string;
  drill: DrillType;
  /**
   * Shown only to heads and admin (DOMAIN section 3: money). Set per figure, never per screen: a screen that mixes
   * money and other numbers keeps the other numbers under its own key and puts each money number under its own
   * `money` key (see `compare.spares-cost`).
   */
  money?: true;
  /**
   * A figure whose one drill cannot name every row its value stands on: the value carries rows of more than one
   * kind, or its counts can be honestly zero with no row behind them. The data checklist is the first (machine
   * records have no ticket to drill to); `pm-compliance` is the second (a window with no planned work order still
   * has a true answer, and no ticket to open); `dashboard.breakdown-free` is the third (a plant where every machine
   * broke down in the last 30 days answers "0 of N" and has no breakdown-free machine to open); Team Focus is the
   * fourth (its data-lane actions name no machine, so they travel in the value).
   */
  mixed?: true;
  /**
   * What the figure is a function of (ticket 76). Absent: the span the run names, cut to it by the engine. `asOf`: the
   * plant at the run date, never cut. `history`: every record up to the run date, never cut, learning across years.
   */
  reads?: 'asOf' | 'history';
}

const dashboard = (name: string, label: string, drill: DrillType): FigureDef => ({
  key: `dashboard.${name}`,
  screen: 'dashboard',
  owner: 38,
  label,
  drill,
});

/** One figure family per screen: the owning ticket may split it into the screen's own tiles (`screen.tile`). */
const screen = (owner: number, id: string, label: string, drill: DrillType): FigureDef => ({
  key: id,
  screen: id,
  owner,
  label,
  drill,
});

const moneyTile = (owner: number, id: string, tile: string, label: string): FigureDef => ({
  key: `${id}.${tile}`,
  screen: id,
  owner,
  label,
  drill: 'ticket',
  money: true,
});

/** One figure of a multi-figure screen: the screen id is the tile family, the figure its own key (ticket 48). */
const tile = (owner: number, screenId: string, name: string, label: string): FigureDef => ({
  key: `${screenId}.${name}`,
  screen: screenId,
  owner,
  label,
  drill: 'ticket',
});

/**
 * The kept screens of `docs/plan/m4a-triage.md` that an engine ticket computes. Left out on purpose: the PM,
 * AMC, legal and PM report registers (loaded by M4b tickets 49 and 51, no rows on main to drill to yet), the
 * Guide, the settings and the workbook export (not figures), and OEM analytics (deferred).
 */
const DEFS: readonly FigureDef[] = [
  dashboard('total-machines', 'Total machines', 'machine'),
  dashboard('utilities', 'Utilities', 'machine'),
  dashboard('dg-sets', 'DG sets', 'machine'),
  dashboard('cnc-machines', 'CNC machines', 'machine'),
  dashboard('conventional-machines', 'Conventional machines', 'machine'),
  dashboard('process-machines', 'Process machines', 'machine'),
  dashboard('total-breakdowns', 'Total breakdowns', 'ticket'),
  dashboard('total-downtime-hours', 'Total downtime', 'ticket'),
  dashboard('pm-hours', 'PM hours', 'ticket'),
  dashboard('no-downtime-hours', 'Breakdown hours with no downtime', 'ticket'),
  // The two Dashboard cards the platform drew as figures but the face had not registered (Revision 2 R3).
  // Mixed: "0 of N machines are breakdown-free" is a true answer with no machine behind it to open.
  { ...dashboard('breakdown-free', 'Breakdown-free machines', 'machine'), mixed: true },
  dashboard('costliest-problems', 'Problems costing the most downtime', 'ticket'),
  dashboard('bubble-chart', 'Bubble chart', 'machine'),
  dashboard('expansion-timeline', 'Expansion timeline', 'machine'),
  dashboard('fleet-availability', 'Fleet availability', 'machine'),
  // Ticket 91: power and air failures, machine-hours lost; its own figure so a reader never mistakes them for breakdowns.
  dashboard('plant-events', 'Plant events: machine-hours lost to power and air failures', 'ticket'),
  dashboard('plant-bd-pct', 'Plant breakdown percent', 'ticket'),
  dashboard('avg-complaints-per-day', 'Average complaints per day', 'ticket'),
  dashboard('avg-bd-hours-per-day', 'Average breakdown hours per day', 'ticket'),
  dashboard('avg-bd-hours-per-machine', 'Average breakdown hours per machine', 'ticket'),
  // R2: the checklist's breakdown items drill to tickets; its machine items travel in the value (see `mixed`).
  { ...screen(38, 'data-checklist', 'Data checklist', 'ticket'), mixed: true },
  screen(39, 'registers', 'Registers and splits', 'machine'),
  screen(39, 'cell-change-log', 'Cell change log', 'move'),
  screen(39, 'a7-footprint', 'A7 footprint', 'machine'),
  screen(39, 'a8-age', 'A8 age analysis', 'machine'),
  screen(39, 'machine-page', 'Machine page', 'machine'),
  screen(40, 'breakdown-log', 'Breakdown log', 'ticket'),
  screen(40, 'a1-bd-pm', 'A1 breakdown percent and PM split', 'ticket'),
  screen(40, 'a2-category-cell', 'A2 category and cell', 'ticket'),
  screen(40, 'a3-mttr-mtbf', 'A3 MTTR and MTBF', 'ticket'),
  screen(41, 'a4-manpower', 'A4 manpower', 'ticket'),
  screen(41, 'a5-energy', 'A5 energy heatmap', 'machine'),
  screen(41, 'a6-why-why', 'A6 Why-Why', 'ticket'),
  screen(41, 'a10-problems', 'A10 problem analysis', 'ticket'),
  screen(42, 'a9-bottleneck-forecast', 'A9 bottleneck and forecast', 'machine'),
  screen(42, 'forecast-lab', 'Forecast Lab', 'machine'),
  screen(43, 'compare', 'Compare machines and health score', 'machine'),
  moneyTile(43, 'compare', 'spares-cost', 'Compare: spares cost'),
  { ...screen(43, 'team-focus', 'Team Focus', 'machine'), mixed: true },
  moneyTile(43, 'team-focus', 'cost', 'Team Focus: cost'),
  { ...screen(43, 'money-matters', 'Money Matters', 'ticket'), money: true },
  screen(43, 'fix-finder', 'Fix Finder', 'ticket'),
  screen(44, 'action-center', 'Action Center', 'machine'),
  moneyTile(44, 'action-center', 'spares-spend', 'Action Center: spares spend nudge'),
  screen(45, 'monthly-report', 'Monthly report', 'ticket'),
  screen(45, 'annual-report', 'Annual report', 'ticket'),
  // Ticket 48's second definition of five measures: four figures on one screen, the comparison first (R12).
  tile(48, 'shift-kpis', 'compare', 'Platform basis beside the working-hour basis'),
  tile(48, 'shift-kpis', 'shift-split', 'Breakdowns, hours and MTTR by shift'),
  tile(48, 'shift-kpis', 'backlog', 'Open breakdowns by working-hour age'),
  // Ticket 50's two compliance figures: one key on the PM calendar's screen, owned with the calendar (50 R8).
  {
    key: 'pm-compliance',
    screen: 'pm-calendar',
    owner: 50,
    label: 'PM compliance and schedule compliance',
    drill: 'ticket',
    mixed: true,
  },
  tile(48, 'shift-kpis', 'breakdown-map', 'Pareto and heat grids by machine, cell, code and shift'), // Ticket 67's reliability fit and critical spares: a second key on the machine page, never a screen of its own
  // (R11). Its value is per machine and per category, so the figure's own drill is the production fleet.
  {
    key: 'reliability',
    screen: 'machine-page',
    owner: 67,
    label: 'Reliability and critical spares',
    drill: 'machine',
  },
];

const dashboardKeys = (...names: string[]): string[] => names.map((name) => `dashboard.${name}`);

/** The figures that read the run date: the machine counts, the registers, the energy map, the reports and the page. */
const AS_OF_KEYS: ReadonlySet<string> = new Set([
  ...dashboardKeys(
    'total-machines',
    'utilities',
    'dg-sets',
    'cnc-machines',
    'conventional-machines',
  ),
  ...dashboardKeys('process-machines', 'breakdown-free', 'expansion-timeline'),
  ...['registers', 'cell-change-log', 'a7-footprint', 'a5-energy', 'action-center'],
  ...['action-center.spares-spend', 'shift-kpis.backlog', 'monthly-report', 'annual-report'],
  'machine-page',
]);

/** The figures that learn from every year the plant recorded, gaps left out. */
const HISTORY_KEYS: ReadonlySet<string> = new Set([
  ...['a9-bottleneck-forecast', 'forecast-lab', 'compare', 'compare.spares-cost'],
  ...['team-focus', 'team-focus.cost', 'money-matters', 'fix-finder', 'data-checklist'],
]);

export const FIGURES: readonly FigureDef[] = DEFS.map((def): FigureDef => {
  if (AS_OF_KEYS.has(def.key)) return { ...def, reads: 'asOf' };
  return HISTORY_KEYS.has(def.key) ? { ...def, reads: 'history' } : def;
});

export const FIGURE_KEYS: readonly string[] = FIGURES.map((figure) => figure.key);
