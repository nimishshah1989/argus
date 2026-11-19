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
   * A figure whose value carries rows of more than one kind, so its one drill can name only the rows it can open.
   * The data checklist is the only one: machine-record items have no ticket to drill to, and the screen renders
   * those items from the value itself.
   */
  mixed?: true;
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
export const FIGURES: readonly FigureDef[] = [
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
  dashboard('breakdown-free', 'Breakdown-free machines', 'machine'),
  dashboard('costliest-problems', 'Problems costing the most downtime', 'ticket'),
  dashboard('bubble-chart', 'Bubble chart', 'machine'),
  dashboard('expansion-timeline', 'Expansion timeline', 'machine'),
  dashboard('fleet-availability', 'Fleet availability', 'machine'),
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
  screen(43, 'team-focus', 'Team Focus', 'machine'),
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
  tile(48, 'shift-kpis', 'breakdown-map', 'Pareto and heat grids by machine, cell, code and shift'),
  // Ticket 67's reliability fit and critical spares: a second key on the machine page, never a screen of its own
  // (R11). Its value is per machine and per category, so the figure's own drill is the production fleet.
  {
    key: 'reliability',
    screen: 'machine-page',
    owner: 67,
    label: 'Reliability and critical spares',
    drill: 'machine',
  },
];

export const FIGURE_KEYS: readonly string[] = FIGURES.map((figure) => figure.key);
