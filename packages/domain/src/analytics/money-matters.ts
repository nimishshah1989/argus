import type { AnalyticsProfile } from '@uptimo/shared';
import { a9RiskCore, coreDays, printed, type BottleneckCore } from './a9-bottleneck.js';
import {
  FC_RUNS,
  episodesOf,
  fleetRows,
  forecastBoard,
  quantile,
  type ForecastModel,
  type Month,
} from './a9-forecast-sim.js';
import { formatNumber } from './format.js';
import { healthRows, type Health } from './money-health.js';
import { levers, stakeHours, type FocusContext, type LeverResult } from './money-focus.js';
import { analyzeProblems, type ProblemAnalysis } from './problem-analysis.js';
import type { Computer, EngineData, FigureValue } from './types.js';

/**
 * Money Matters (ticket 43, packet 43c): the whole `mm` page against the 11 November key - ten money KPIs, the
 * four opportunity levers and the group table behind them, the ch-mm chart, and a drill to the tickets. The
 * platform's money model is Guide section 30: every lost machine-hour is worth the throughput per machine-hour
 * (Rs 1,800 by default) times the share counted as lost sales (100%), and each lever multiplies the avoidable
 * hours by the share the team can remove. The page reads the fleet's own analyses rather than copying them:
 * A10's events and repeats for the problem levers, the Compare health model for the age-and-category
 * expectation, A9's forecast for the planning KPIs, and the Team Focus lanes' hours at stake for the last KPI.
 *
 * The file split follows the hard 400-line budget, the same reason 42b and 42d split their own work: the health
 * model is `money-health.ts` and the Team Focus stakes are `money-focus.ts`.
 */

/** The chart's bars: the twelve problem groups that lost the most hours. */
const CHART_ROWS = 12;
interface Kpi {
  label: string;
  value: string;
  sub: string;
}

interface Table {
  title: string;
  header: string[];
  rows: string[][];
  rowCount: number;
}

interface Chart {
  id: string;
  type: string;
  axes: { x: string; y: string };
  tickLabels: { x: string[]; y: string[] };
  labels: string[];
  datasets: Array<{ label: string; data: number[] }>;
}

interface Page {
  page: string;
  title: string;
  kpis: Kpi[];
  tables: Table[];
  charts: Chart[];
}

/** The money page's whole arithmetic for one run, so its builders share one set of numbers. */
interface Money {
  core: BottleneckCore;
  problems: ProblemAnalysis;
  health: Health[];
  models: ForecastModel[];
  plant: number[];
  month: Month;
  throughput: number;
  succ: number;
  rate: number;
  days: number;
  months: number;
  ann: number;
  threshold: number;
}

/** The three money totals the page prints beside its inputs. */
interface Totals {
  lost: number;
  stake: number;
}

const sum = (values: readonly number[]): number =>
  values.reduce((total, value) => total + value, 0);

/** The platform's `fmtNum`: grouped, fixed decimals, rounded from the shortest decimal the double prints. */
const num = (value: number, decimals: number): string =>
  formatNumber(printed(value, decimals), decimals);

/** `mmRs`: the platform's money text - crore, lakh, then whole rupees. */
function mmRs(value: number): string {
  const amount = Math.abs(value);
  if (amount >= 1e7) return '₹ ' + num(value / 1e7, 2) + ' cr';
  if (amount >= 1e5) return '₹ ' + num(value / 1e5, 2) + ' lakh';
  return '₹ ' + num(value, 0);
}

/** The page's arithmetic once: the fleet, its health, the events, the forecast and the money numbers. */
function moneyOf(data: EngineData, profile: AnalyticsProfile): Money | null {
  const core = a9RiskCore(data, profile);
  if (core === null) return null;
  const threshold = profile.whyWhyThresholdHours;
  const days = coreDays(core);
  const board = forecastBoard(core, episodesOf(fleetRows(data)), FC_RUNS);
  const throughput = profile.mmThroughput > 0 ? profile.mmThroughput : 1800;
  return {
    core,
    problems: analyzeProblems(data),
    health: healthRows(data, core, threshold),
    models: [...board.models].sort((left, right) => right.expH - left.expH || right.p80 - left.p80),
    plant: board.plant,
    month: board.month,
    throughput,
    rate: throughput,
    succ: Math.max(0, Math.min(100, profile.mmSucc)) / 100,
    days,
    months: Math.max(1, (days - 1) / 30.44),
    ann: 365 / days,
    threshold,
  };
}

/** The ten KPIs, in the page's card order. */
function kpisOf(money: Money, totals: Totals, combined: number): Kpi[] {
  const { problems, month, plant, rate, days, ann } = money;
  const total = problems.totalHours;
  const lostAnn = totals.lost * ann;
  const recovered = combined * rate * ann;
  const q = (share: number): number => (plant.length > 0 ? quantile(plant, share) : 0);
  const p50 = q(0.5);
  const p80 = q(0.8);
  const p90 = q(0.9);
  return [
    {
      label: 'Throughput per machine-hour',
      value: '₹ ' + num(money.throughput, 0),
      sub: 'the same on all ' + money.core.fleet.length + ' machines, set in the box above',
    },
    { label: 'Value of one lost hour', value: '₹ ' + num(rate, 0), sub: 'full throughput counted' },
    {
      label: 'Money lost to breakdowns',
      value: mmRs(totals.lost),
      sub: num(total, 0) + ' hrs in ' + num(days, 0) + ' days',
    },
    { label: 'Same, per year', value: mmRs(lostAnn), sub: num(total * ann, 0) + ' hrs a year' },
    {
      label: 'Could have been added',
      value: mmRs(recovered) + ' a year',
      sub: num(combined, 0) + ' hrs in the period',
    },
    {
      label: 'Next month, expected',
      value: mmRs(p50 * rate),
      sub: num(p50, 0) + ' hrs in ' + month.label,
    },
    { label: 'Plan for (80%)', value: mmRs(p80 * rate), sub: num(p80, 0) + ' hrs' },
    { label: 'Worst case (90%)', value: mmRs(p90 * rate), sub: num(p90, 0) + ' hrs' },
    {
      label: 'Average month so far',
      value: mmRs(totals.lost / Math.max(1, days / 30.44)),
      sub: 'money lost per month',
    },
    {
      label: 'Open Team Focus actions',
      value: mmRs(totals.stake * 12 * rate) + ' a year',
      sub: num(totals.stake, 0) + ' hrs a month at stake',
    },
  ];
}

/** The first table: each lever's hours and money, then the combined row that removes the double count. */
function leversTable(result: LeverResult, rate: number, ann: number): Table {
  const rows = result.list.map((lever) => [
    lever.name + lever.detail,
    String(lever.machines.size),
    num(lever.hours, 0),
    mmRs(lever.hours * rate),
    mmRs(lever.hours * rate * ann),
    'Open',
  ]);
  rows.push([
    'All four together, without counting any hour twice',
    '—',
    num(result.combined, 0),
    mmRs(result.combined * rate),
    mmRs(result.combined * rate * ann),
    '',
  ]);
  return {
    title: 'Where the money could have been more',
    header: ['Lever', 'Machines', 'Hours (period)', 'Money (period)', 'Money per year', ''],
    rows,
    rowCount: rows.length,
  };
}

/** The second table: the lost hours by problem group, most hours first. */
function lostTable(problems: ProblemAnalysis, rate: number, ann: number): Table {
  const total = sum(problems.groups.map((group) => group.hours)) || 1;
  const rows = problems.groups.map((group) => [
    group.name,
    String(group.count),
    num(group.hours, 1),
    mmRs(group.hours * rate),
    mmRs(group.hours * rate * ann),
    num((group.hours / total) * 100, 1) + '%',
  ]);
  return {
    title: 'Where the money was lost',
    header: ['Problem', 'Breakdowns', 'Hours', 'Money (period)', 'Money per year', 'Share'],
    rows,
    rowCount: rows.length,
  };
}

/** The ch-mm chart: the twelve biggest groups, in lakhs of the period's money. */
function chartOf(problems: ProblemAnalysis, rate: number): Chart {
  const top = problems.groups.slice(0, CHART_ROWS);
  return {
    id: 'ch-mm',
    type: 'bar',
    axes: { x: 'Money lost in the period (₹ lakh)', y: '' },
    tickLabels: { x: [], y: [] },
    labels: top.map((group) => group.name),
    datasets: [
      {
        label: '',
        data: top.map((group) => Math.round(((group.hours * rate) / 1e5) * 100) / 100),
      },
    ],
  };
}

/** The whole page, as the key froze it. */
function pageOf(money: Money, totals: Totals): Page {
  const levered = levers(money.problems, money.health, {
    threshold: money.threshold,
    succ: money.succ,
  });
  return {
    page: 'mm',
    title: 'Money Matters',
    kpis: kpisOf(money, totals, levered.combined),
    tables: [
      leversTable(levered, money.rate, money.ann),
      lostTable(money.problems, money.rate, money.ann),
    ],
    charts: [chartOf(money.problems, money.rate)],
  };
}

/**
 * The Money Matters figure: the whole `mm` page and the tickets its rows came from. A plant with no production
 * breakdown has nothing to price, so the page is null; its drill is empty too.
 */
export const moneyMattersFigure: Computer = ({ data, asOf, profile }) => {
  const money = moneyOf(data, profile);
  if (money === null) return { value: null, drillIds: [] };
  const context: FocusContext = {
    problems: money.problems,
    health: money.health,
    models: money.models,
    months: money.months,
    asOf,
    threshold: money.threshold,
  };
  const totals: Totals = {
    lost: money.problems.totalHours * money.rate,
    stake: stakeHours(data, money.core, context),
  };
  const value = { screen: 'money-matters', asOf, pages: [pageOf(money, totals)] };
  return {
    value: value as unknown as FigureValue,
    drillIds: fleetRows(data).map((row) => row.ticket.id),
  };
};
