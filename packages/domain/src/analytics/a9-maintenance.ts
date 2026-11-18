import {
  a9BottleneckForecastFigure,
  trSummary,
  type TrendSummary,
  type TrendVerdict,
} from './a9-forecast.js';
import { a9RiskCore, printed, type BottleneckCore, type BottleneckRisk } from './a9-bottleneck.js';
import {
  FC_RUNS,
  FC_WINDOW,
  episodesOf,
  fleetRows,
  forecastBoard,
  type Episode,
} from './a9-forecast-sim.js';
import { formatInr, normalizeLabel } from './format.js';
import { dayNumber } from './plant-date.js';
import { repeatItems, type RepeatItem } from './a9-repeat.js';
import type { Computer, EngineData, FigureValue } from './types.js';

/**
 * A9's maintenance half (ticket 42, packet 42c): the two trend tables, the repeat-fault table and the page's two
 * charts, composed over 42a's risk core and 42b's forecast. A trend places each merged episode at its last day in
 * the machine's own observation window; a repeat fault is either a merged episode on three or more days or a greedy
 * run of three code episodes inside 30 days. Both charts print the platform's data objects, not its drawing options.
 */

const SCREEN = 'a9-bottleneck-forecast';
const TABLE_SLOTS = 9;
const TR_MIN_CATEGORY = 15;
const TR_MIN_MACHINE = 8;
const TR_Z = 1.96;
const PROBLEM_CHARS = 70;
const FC_TOP = 15;

const CATEGORY_HEADER = [
  'Category',
  'Machines',
  'Breakdowns',
  'Per machine per month before → last 90 days',
  'Test score',
  'Verdict',
];
const MACHINE_HEADER = [
  'Machine',
  'Category',
  'Breakdowns',
  'Per month before → last 90 days',
  'Test score',
  'Verdict',
];
const REPEAT_HEADER = [
  '#',
  'Machine',
  'Category',
  'Type',
  'Code',
  'How often',
  'From – to',
  'Downtime (hrs)',
  'Latest problem logged',
];

const VERDICT_TEXT: Record<TrendVerdict, string> = {
  'more frequent': 'More frequent',
  'less frequent': 'Less frequent',
  steady: 'No clear trend',
  'Too little data': 'Too little data',
};

type Kpi = { label: string; value: string; sub: string };
type Table = { title: string; header: string[]; rows: string[][]; rowCount: number };
type Chart = {
  id: string;
  type: string;
  axes: Record<string, string>;
  tickLabels: Record<string, string[]>;
  labels: string[];
  datasets: unknown[];
};
type Page = {
  page: string;
  title: string;
  kpis: Array<Kpi | null>;
  tables: Array<Table | null>;
  charts: Chart[];
};

const sum = (values: readonly number[]): number =>
  values.reduce((total, value) => total + value, 0);

/** 42a's platform rounding: the shortest decimal the double names, then the key's own grouping. */
const inr = (value: number, decimals: number): string =>
  formatInr(printed(value, decimals), decimals);

const table = (title: string, header: string[], rows: string[][]): Table => ({
  title,
  header,
  rows,
  rowCount: rows.length,
});

type Trend = {
  n: number;
  u: number;
  before: number | null;
  recent: number;
  verdict: TrendVerdict;
};

/** The platform's two-number rate cell: a dash where the before window is too short. */
const rateText = (trend: Trend): string =>
  `${trend.before === null ? '—' : inr(trend.before, 2)} → ${inr(trend.recent, 2)}`;

type MachineTrend = { risk: BottleneckRisk; summary: TrendSummary };

/** Each machine's trend, every episode placed at its last day in the machine's own observation window. */
function machineTrends(core: BottleneckCore, episodes: Map<string, Episode[]>): MachineTrend[] {
  const endDay = dayNumber(core.to) ?? 0;
  return core.fleet.map((risk) => {
    const window = Math.max(1, risk.days);
    const days = (episodes.get(risk.machine.id) ?? []).map((episode) => episode.last);
    const summary = trSummary({
      days,
      start: endDay - window + 1,
      window,
      endDay,
      minN: TR_MIN_MACHINE,
    });
    return { risk, summary };
  });
}

type CategoryTrend = { key: string; machines: number; summary: Trend };

/** One category's pooled trend: the episodes of every machine in it, each in its own window. */
function categoryTrend(
  key: string,
  machines: readonly BottleneckRisk[],
  episodes: Map<string, Episode[]>,
  endDay: number,
): CategoryTrend {
  let n = 0;
  let centred = 0;
  let n90 = 0;
  let d90 = 0;
  let nB = 0;
  let dB = 0;
  for (const risk of machines) {
    const window = Math.max(1, risk.days);
    const start = endDay - window + 1;
    const own = episodes.get(risk.machine.id) ?? [];
    for (const episode of own) {
      const x = Math.min(1, Math.max(0, (episode.last - start + 0.5) / window));
      centred += x - 0.5;
      n += 1;
    }
    const recent = own.filter((episode) => episode.last > endDay - FC_WINDOW).length;
    const w = Math.min(FC_WINDOW, window);
    n90 += recent;
    d90 += w;
    nB += own.length - recent;
    dB += window - w;
  }
  const u = n > 0 ? centred / Math.sqrt(n / 12) : 0;
  const verdict: TrendVerdict =
    n < TR_MIN_CATEGORY
      ? 'Too little data'
      : u >= TR_Z
        ? 'more frequent'
        : u <= -TR_Z
          ? 'less frequent'
          : 'steady';
  return {
    key,
    machines: machines.length,
    summary: {
      n,
      u,
      before: dB >= 30 ? (nB / dB) * 30 : null,
      recent: d90 > 0 ? (n90 / d90) * 30 : 0,
      verdict,
    },
  };
}

/** Table 6's rows: the categories with enough breakdowns, worse-looking first. */
function categoryTrends(core: BottleneckCore, episodes: Map<string, Episode[]>): CategoryTrend[] {
  const endDay = dayNumber(core.to) ?? 0;
  const groups = new Map<string, BottleneckRisk[]>();
  for (const risk of core.fleet) {
    const key = normalizeLabel(risk.machine.category ?? '');
    groups.set(key, [...(groups.get(key) ?? []), risk]);
  }
  return [...groups]
    .map(([key, machines]) => categoryTrend(key, machines, episodes, endDay))
    .filter((trend) => trend.summary.verdict !== 'Too little data')
    .sort((left, right) => Math.abs(right.summary.u) - Math.abs(left.summary.u));
}

/** Table 6: a category's pool, its rate before the last 90 days and the test's own verdict. */
function categoryTable(trends: readonly CategoryTrend[]): Table {
  const rows = trends.map((trend) => [
    trend.key,
    String(trend.machines),
    String(trend.summary.n),
    rateText(trend.summary),
    inr(trend.summary.u, 2),
    VERDICT_TEXT[trend.summary.verdict],
  ]);
  return table('For Maintenance: is it getting worse or better?', CATEGORY_HEADER, rows);
}

/** Table 7: only the machines whose trend is clear, worst-looking first. */
function machineTable(trends: readonly MachineTrend[]): Table {
  const clear = trends
    .filter(
      (trend) =>
        trend.summary.verdict === 'more frequent' || trend.summary.verdict === 'less frequent',
    )
    .sort((left, right) => Math.abs(right.summary.u) - Math.abs(left.summary.u));
  const rows = clear.map((trend) => [
    trend.risk.machine.code,
    normalizeLabel(trend.risk.machine.category ?? ''),
    String(trend.summary.n),
    rateText(trend.summary),
    inr(trend.summary.u, 2),
    VERDICT_TEXT[trend.summary.verdict],
  ]);
  return table('For Maintenance: is it getting worse or better?', MACHINE_HEADER, rows);
}

const SHORT_DATE = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  timeZone: 'UTC',
});

const shortDate = (day: number): string => SHORT_DATE.format(new Date(day * 86_400_000));

/** Table 8: the repeat faults with their code meaning, span and last problem. */
function repeatTable(items: readonly RepeatItem[], data: EngineData): Table {
  const descriptions = new Map(
    (data.lists.maint_code ?? []).map((item) => [item.code, item.label ?? '']),
  );
  const rows = items.map((item, index) => [
    String(index + 1),
    item.machineId,
    item.category,
    item.type,
    item.code === '—' ? 'No code' : item.code + (descriptions.get(item.code) ?? ''),
    item.type === 'Recurring'
      ? `${item.n} separate times in ${item.last - item.first + 1} days`
      : `down on ${item.n} days in a row`,
    `${shortDate(item.first)} – ${shortDate(item.last)}`,
    inr(item.hours, 1),
    normalizeLabel(item.problem).slice(0, PROBLEM_CHARS),
  ]);
  return table('For Maintenance: faults that keep coming back', REPEAT_HEADER, rows);
}

type Lane = { key: string; machines: number; average: number };

/** The map's lanes: one per raw category, fewest machines first then lowest average availability. */
function mapLanes(core: BottleneckCore): Lane[] {
  const groups = new Map<string, BottleneckRisk[]>();
  for (const risk of core.fleet) {
    const key = risk.machine.category ?? '—';
    groups.set(key, [...(groups.get(key) ?? []), risk]);
  }
  return [...groups]
    .map(([key, group]) => ({
      key,
      machines: group.length,
      average: sum(group.map((risk) => risk.a)) / group.length,
    }))
    .sort((left, right) => left.machines - right.machines || left.average - right.average);
}

/** The platform's deterministic id hash, which places a dot inside its lane. */
function jitterOf(risk: BottleneckRisk): number {
  let hash = 0;
  for (const character of risk.machine.id) hash = (hash * 31 + character.charCodeAt(0)) % 997;
  return risk.peers > 1 ? ((hash % 100) / 100 - 0.5) * 0.62 : 0;
}

/** ch-a9-map: one dot per machine, lane + jitter on y, unavailability percent on x, one series per rating. */
function mapChart(core: BottleneckCore): Chart {
  const lanes = mapLanes(core);
  const laneOf = new Map(lanes.map((lane, index) => [lane.key, index]));
  const ranked = [...core.fleet].sort(
    (left, right) => right.score - left.score || right.hours - left.hours,
  );
  const datasets = ['Low', 'Watch', 'High', 'Critical'].map((rating) => ({
    label: rating,
    data: ranked
      .filter((risk) => risk.rating === rating)
      .map((risk) => ({
        x: Math.round(risk.unav * 1000) / 10,
        y: (laneOf.get(risk.machine.category ?? '—') ?? 0) + jitterOf(risk),
        id: risk.machine.id,
        cat: risk.machine.category ?? '—',
        h: risk.hours,
        a: risk.a,
        n: risk.peers,
      })),
  }));
  return {
    id: 'ch-a9-map',
    type: 'scatter',
    axes: { x: 'Unavailable (% of machine hours) — further right = more downtime', y: '' },
    tickLabels: { x: [], y: lanes.map((lane) => `${lane.key} (${lane.machines})`) },
    labels: [],
    datasets,
  };
}

/** ch-fc: the 15 machines with the most expected hours, their expected and 80% planning bars. */
function forecastChart(core: BottleneckCore, episodes: Map<string, Episode[]>): Chart {
  const { month, models } = forecastBoard(core, episodes, FC_RUNS);
  const top = [...models]
    .sort((left, right) => right.expH - left.expH || right.p80 - left.p80)
    .slice(0, FC_TOP);
  return {
    id: 'ch-fc',
    type: 'bar',
    axes: { x: `Hours of downtime expected in ${month.label}`, y: '' },
    tickLabels: { x: [], y: [] },
    labels: top.map((model) => `${model.risk.machine.code} · ${model.risk.machine.category ?? ''}`),
    datasets: [
      { label: 'Expected routine hrs', data: top.map((model) => Math.round(model.expH * 10) / 10) },
      { label: 'Plan for (80%)', data: top.map((model) => Math.round(model.p80 * 10) / 10) },
    ],
  };
}

/** 42c's page slots: tables 6 to 8 and the two charts, over the same fleet and episodes 42a and 42b read. */
export function a9MaintenanceSlots(core: BottleneckCore, data: EngineData) {
  const episodes = episodesOf(fleetRows(data));
  const tables: Array<Table | null> = Array.from({ length: TABLE_SLOTS }, () => null);
  tables[6] = categoryTable(categoryTrends(core, episodes));
  tables[7] = machineTable(machineTrends(core, episodes));
  tables[8] = repeatTable(repeatItems(data, core), data);
  return { tables, charts: [mapChart(core), forecastChart(core, episodes)] };
}

/**
 * The A9 figure with 42c's slots filled: 42a's and 42b's page and drill stay whole, and this packet's three tables
 * and two charts take their own indices. A plant with no production breakdown keeps the earlier figure's null page.
 */
export const a9BottleneckTrendsFigure: Computer = (input) => {
  const base = a9BottleneckForecastFigure(input);
  const core = a9RiskCore(input.data, input.profile);
  if (base.value === null || core === null) return base;
  const page = (base.value as unknown as { pages: Array<Page> }).pages[0];
  if (page === undefined) return base;
  const slots = a9MaintenanceSlots(core, input.data);
  const filled: Page = {
    ...page,
    tables: page.tables.map((value, index) => slots.tables[index] ?? value),
    charts: slots.charts,
  };
  const value = { screen: SCREEN, asOf: input.asOf, pages: [filled] };
  return { value: value as unknown as FigureValue, drillIds: base.drillIds };
};
