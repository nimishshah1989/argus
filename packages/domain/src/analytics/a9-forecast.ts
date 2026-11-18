import {
  a9BottleneckFigure,
  a9RiskCore,
  printed,
  type BottleneckCore,
  type BottleneckRisk,
} from './a9-bottleneck.js';
import {
  FC_PRIOR_DAYS,
  FC_RUNS,
  FC_WINDOW,
  episodesOf,
  fleetRows,
  forecastBoard,
  quantile,
  type ForecastModel,
  type Month,
} from './a9-forecast-sim.js';
import { formatInr, formatPercent } from './format.js';
import { dayNumber, dmy } from './plant-date.js';
import { effectiveHours, type SourcedReport } from './rows.js';
import type { Computer, EngineData, FigureValue } from './types.js';

/**
 * A9, the what-if and the planning forecast (ticket 42, packet 42b): KPIs 4–13, tables 1, 2 and 5, and the trend
 * helpers 42c imports. The what-if reads the first risk machine's raw entries; the forecast prints the simulated
 * next full calendar month. Episodes, the M0 rate and the draw order live in `a9-forecast-sim.ts`.
 */

const SCREEN = 'a9-bottleneck-forecast';
const KPI_SLOTS = 14;
const TABLE_SLOTS = 9;
const TOP_ROWS = 25;
const COVER_ROWS = 8;
const PROBLEM_CHARS = 48;
const TREND_MIN = 8;
const TREND_FLAG = 1.96;
const FORECAST_HEADER =
  '#,Machine,Category,Cell,Expected breakdowns,Chance of at least 1,Expected hrs,Plan for (80%),Worst case (90%),Chance of a 8+ hr one,Band,Confidence,Note'.split(
    ',',
  );

type Kpi = { label: string; value: string; sub: string };

type Table = { title: string; header: string[]; rows: string[][]; rowCount: number };

type HoursProfile = { prodHrsPerDay: number; workDaysPerYear: number };

type Page = {
  page: string;
  title: string;
  kpis: Array<Kpi | null>;
  tables: Array<Table | null>;
  charts: unknown[];
};

const kpi = (label: string, value: string, sub: string): Kpi => ({ label, value, sub });

const table = (title: string, header: string[], rows: string[][]): Table => ({
  title,
  header,
  rows,
  rowCount: rows.length,
});

const sum = (values: readonly number[]): number =>
  values.reduce((total, value) => total + value, 0);

/** 42a's platform rounding: the shortest decimal the double names, then the key's own grouping. */
const inr = (value: number, decimals: number): string =>
  formatInr(printed(value, decimals), decimals);

/** KPIs 4–8: what the first risk machine's next outage costs its category, its cell and its year. */
function whatIfKpis(risk: BottleneckRisk, cellN: number, profile: HoursProfile): Kpi[] {
  const hours = risk.mttr;
  const peers = risk.peers;
  const perDay = profile.prodHrsPerDay;
  const monthHours = (peers * perDay * profile.workDaysPerYear) / 12;
  const cell = risk.cell === '' ? 'No cell assigned' : `Cell ${risk.cell}`;
  const paces = `${formatInr(hours / perDay, 1)} production days of ${perDay} hrs`;
  const pace = `at this machine's pace so far (${formatInr(risk.perYear / perDay, 1)} production days)`;
  return [
    kpi('Outage length', `${formatInr(hours, 1)} hrs`, paces),
    kpi(
      `${risk.category} capacity left`,
      formatPercent((peers - 1) / peers),
      `${peers - 1} of ${peers} machines still running`,
    ),
    kpi(
      `${cell} capacity left`,
      formatPercent((cellN - 1) / cellN),
      `${cellN - 1} of ${cellN} machines in the cell`,
    ),
    kpi(
      'Category capacity lost',
      formatPercent(monthHours > 0 ? hours / monthHours : 0),
      "of one month of this category's machine hours",
    ),
    kpi('Expected downtime next 12 months', `${formatInr(risk.perYear, 0)} hrs`, pace),
  ];
}

/** Table 1: the five longest raw entries behind the what-if. */
function longestTable(rows: readonly SourcedReport[]): Table {
  const hours = (row: SourcedReport): number => effectiveHours(row.report);
  const longest = [...rows].sort((left, right) => hours(right) - hours(left)).slice(0, 5);
  return table(
    'What if it goes down?',
    ['Date', 'Problem', 'Code', 'Hrs'],
    longest.map((row) => [
      dmy(row.report.date),
      row.report.problem.slice(0, PROBLEM_CHARS),
      row.report.maintCode ?? '',
      formatInr(hours(row), 1),
    ]),
  );
}

/** Table 2: the machines that cover the what-if, availability asc; a sole machine has no cover at all. */
function coverTable(risk: BottleneckRisk, fleet: readonly BottleneckRisk[]): Table {
  const peers = fleet
    .filter((peer) => peer.category === risk.category && peer.machine.id !== risk.machine.id)
    .sort((left, right) => left.a - right.a)
    .slice(0, COVER_ROWS);
  const covering =
    risk.peers === 1
      ? [['None — this is the only machine of its kind']]
      : peers.map((peer) => [
          peer.machine.code,
          peer.cell,
          formatPercent(peer.a),
          formatInr(peer.hours, 1),
        ]);
  return table('What if it goes down?', ['Machine', 'Cell', 'Availability', 'BD hrs'], covering);
}

/** The what-if's five KPIs and its two tables, for the first risk machine. */
function whatIfSlots(core: BottleneckCore, rows: readonly SourcedReport[], profile: HoursProfile) {
  const risk = [...core.fleet].sort(
    (left, right) => right.score - left.score || right.hours - left.hours,
  )[0]!;
  const cellN = core.fleet.filter((peer) => peer.cell === risk.cell).length;
  const own = rows.filter((row) => row.report.machineId === risk.machine.id);
  return {
    kpis: whatIfKpis(risk, cellN, profile),
    tables: [longestTable(own), coverTable(risk, core.fleet)],
  };
}

/** The plan's confidence: history length and episode count, never the simulated spread. */
const confidenceOf = (n: number, days: number): string =>
  n >= 6 && days >= 150 ? 'High' : n >= 2 && days >= 90 ? 'Medium' : 'Low';

/** The plan's band, from the expected hours. */
const bandOf = (expH: number): string =>
  expH >= 6 ? 'Hot' : expH >= 3 ? 'Likely' : expH >= 1 ? 'Watch' : 'Stable';

/** A trend verdict's own words. */
export type TrendVerdict = 'more frequent' | 'less frequent' | 'steady' | 'Too little data';

/** The trend test's numbers, for the page's Note here and 42c's two trend tables. */
export type TrendSummary = {
  n: number;
  n90: number;
  u: number;
  before: number | null;
  recent: number;
  verdict: TrendVerdict;
};

/** The Laplace statistic: each episode's place in the window, centred and scaled by its own count. */
export function trLaplace(days: readonly number[], start: number, window: number): number {
  if (days.length === 0 || window <= 0) return 0;
  const centred = days.reduce((total, day) => {
    const x = Math.min(1, Math.max(0, (day - start + 0.5) / window));
    return total + x - 0.5;
  }, 0);
  return centred / Math.sqrt(days.length / 12);
}

/** The verdict the ±1.96 flag gives, or "Too little data" under the caller's minimum. */
const verdictOf = (n: number, u: number, minN: number): TrendVerdict =>
  n < minN
    ? 'Too little data'
    : u >= TREND_FLAG
      ? 'more frequent'
      : u <= -TREND_FLAG
        ? 'less frequent'
        : 'steady';

/** What the trend test reads: the episodes' days, the window they sit in and the minimum that gates them. */
export type TrendInput = {
  days: readonly number[];
  start: number;
  window: number;
  endDay: number;
  minN?: number;
};

/** The trend verdict and the before/recent rate, at the plan's ±1.96 and its minimum episode count. */
export function trSummary(input: TrendInput): TrendSummary {
  const { days, start, window, endDay, minN = TREND_MIN } = input;
  const n = days.length;
  const n90 = days.filter((day) => day > endDay - FC_WINDOW).length;
  const beforeWindow = window - Math.min(FC_WINDOW, window);
  return {
    n,
    n90,
    u: trLaplace(days, start, window),
    before: beforeWindow >= 30 ? ((n - n90) / beforeWindow) * 30 : null,
    recent: (n90 / Math.min(FC_WINDOW, window)) * 30,
    verdict: verdictOf(n, trLaplace(days, start, window), minN),
  };
}

/** The trend verdict's printed form; a steady machine prints nothing. */
const TREND_TEXT: Record<string, string> = {
  'more frequent': 'Trend: more frequent',
  'less frequent': 'Trend: less frequent',
};

/** The Note cell: the rising or quiet remark and the trend verdict, joined with no separator, as the key prints. */
function noteOf(model: ForecastModel, start: number, endDay: number): string {
  const rising = model.n90 >= 3 && model.n90 >= 2 * model.lam * FC_WINDOW;
  const quiet = model.n >= 4 && model.n90 === 0 && model.risk.days > FC_PRIOR_DAYS;
  const remark = rising
    ? `Rising: ${model.n90} in ${FC_WINDOW} days`
    : quiet
      ? `Quiet for ${FC_WINDOW} days`
      : confidenceOf(model.n, model.risk.days) === 'Low'
        ? 'Little history'
        : '';
  const days = model.episodes.map((episode) => episode.first);
  const trend = trSummary({ days, start, window: model.risk.days, endDay });
  return remark + (TREND_TEXT[trend.verdict] ?? '');
}

/** Table 5, one row: the forecast and the two percentiles the simulation pins. */
const forecastRow = (
  model: ForecastModel,
  index: number,
  start: number,
  endDay: number,
): string[] => [
  String(index + 1),
  model.risk.machine.code,
  model.risk.category,
  model.risk.cell,
  inr(model.expN, 2),
  formatPercent(model.p1),
  inr(model.expH, 1),
  inr(model.p80, 1),
  inr(model.p90, 1),
  formatPercent(model.pLong),
  bandOf(model.expH),
  confidenceOf(model.n, model.risk.days),
  noteOf(model, start, endDay),
];

/** KPIs 9–13: the plant's month, its two planning percentiles and the machines at each band. */
function forecastKpis(
  models: readonly ForecastModel[],
  plant: readonly number[],
  month: Month,
  core: BottleneckCore,
): Kpi[] {
  const sorted = [...models].sort((left, right) => right.expH - left.expH || right.p80 - left.p80);
  const expTotal = sum(models.map((model) => model.expH));
  const expN = sum(models.map((model) => model.expN));
  const periodDays = Math.max(1, (dayNumber(core.to) ?? 0) - (dayNumber(core.from) ?? 0) + 1);
  const hist = (sum(core.fleet.map((risk) => risk.hours)) / periodDays) * month.days;
  const hot = sorted.filter((model) => bandOf(model.expH) === 'Hot');
  const likely = sorted.filter((model) => bandOf(model.expH) === 'Likely');
  const low = Math.floor(Math.min(...likely.map((model) => model.expH)));
  const high = Math.ceil(Math.max(...likely.map((model) => model.expH)));
  const past = `Past months averaged ${formatInr(hist, 0)} hrs including long ones`;
  return [
    kpi(
      'Expected routine downtime',
      `${formatInr(expTotal, 1)} hrs`,
      `${month.label}, ${core.fleet.length} machines, about ${Math.round(expN)} breakdowns. ${past}`,
    ),
    kpi(
      'Plan for (80%)',
      `${formatInr(quantile(plant, 0.8), 1)} hrs`,
      'Plant total stays below this in 4 months out of 5, long breakdowns included',
    ),
    kpi(
      'Worst case (90%)',
      `${formatInr(quantile(plant, 0.9), 1)} hrs`,
      '9 months out of 10 stay below this',
    ),
    kpi('Hot machines', String(hot.length), hot.map((model) => model.risk.machine.code).join(', ')),
    kpi(
      'Likely machines',
      String(likely.length),
      likely.length === 0
        ? 'none expected between 3 and 6 hrs'
        : `${low} to ${high} hrs expected each`,
    ),
  ];
}

/** KPIs 9–13 and table 5, the planning forecast for the first full month after the period end. */
function forecastSlots(core: BottleneckCore, rows: readonly SourcedReport[]) {
  const { month, models, plant } = forecastBoard(core, episodesOf(rows), FC_RUNS);
  const sorted = [...models].sort((left, right) => right.expH - left.expH || right.p80 - left.p80);
  const start = dayNumber(core.from) ?? 0;
  const printed = sorted
    .slice(0, TOP_ROWS)
    .map((model, index) => forecastRow(model, index, start, dayNumber(core.to) ?? 0));
  return {
    kpis: forecastKpis(sorted, plant, month, core),
    table: table('Downtime forecast for Planning', FORECAST_HEADER, printed),
  };
}

/** The A9 page's own slots 4–13 and tables 1, 2 and 5, for the packets that compose the page. */
export function a9ForecastSlots(
  core: BottleneckCore,
  data: EngineData,
  profile: HoursProfile,
): { kpis: Array<Kpi | null>; tables: Array<Table | null> } {
  const rows = fleetRows(data);
  const whatIf = whatIfSlots(core, rows, profile);
  const forecast = forecastSlots(core, rows);
  const kpis: Array<Kpi | null> = Array.from({ length: KPI_SLOTS }, () => null);
  kpis.splice(4, whatIf.kpis.length, ...whatIf.kpis);
  kpis.splice(9, forecast.kpis.length, ...forecast.kpis);
  const tables: Array<Table | null> = Array.from({ length: TABLE_SLOTS }, () => null);
  tables[1] = whatIf.tables[0] ?? null;
  tables[2] = whatIf.tables[1] ?? null;
  tables[5] = forecast.table;
  return { kpis, tables };
}

/**
 * The A9 figure with 42b's slots filled: 42a's page and drill are kept whole, and this packet's five KPIs and three
 * tables take their own indices. A plant with no production breakdown keeps 42a's null page.
 */
export const a9BottleneckForecastFigure: Computer = (input) => {
  const base = a9BottleneckFigure(input);
  const core = a9RiskCore(input.data, input.profile);
  if (base.value === null || core === null) return base;
  const slots = a9ForecastSlots(core, input.data, input.profile);
  const page = (base.value as unknown as { pages: Array<Page> }).pages[0];
  if (page === undefined) return base;
  const filled: Page = {
    ...page,
    kpis: page.kpis.map((kpiValue, index) => slots.kpis[index] ?? kpiValue),
    tables: page.tables.map((tableValue, index) => slots.tables[index] ?? tableValue),
  };
  const value = { screen: SCREEN, asOf: input.asOf, pages: [filled] };
  return { value: value as unknown as FigureValue, drillIds: base.drillIds };
};
