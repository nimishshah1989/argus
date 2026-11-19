import { observedDays, type Period } from './availability.js';
import { formatInr, formatPercent, normalizeLabel } from './format.js';
import { isProduction } from './machine-facts.js';
import { effectiveHours, isPm, sourcedReports, type SourcedReport } from './rows.js';
import type { Computer, EngineData, FigureValue, MachineRow } from './types.js';

/**
 * A9, the risk core (ticket 42, packet 42a): the bottleneck page's first four KPIs and its three risk and capacity
 * tables, whole against the 11 November key. The fleet is production data, hours are effective hours (a NO-DT row
 * counts as a breakdown with 0 h) and PM is never a breakdown. The period is 1 January of the earliest breakdown
 * year to the latest breakdown date, each machine observed from the later of that and its purchase date. Packets
 * 42b and 42c fill the page's other slots — tables 1–2 and 5–8, the KPIs after 3 and the two charts — left null here.
 */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const KPI_SLOTS = 14;
const TABLE_SLOTS = 9;
const CHART_SLOTS = 2;
const TOP_ROWS = 20;

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

type Rating = 'Critical' | 'High' | 'Watch' | 'Low';

/** One production machine's risk facts from the first pass; the fleet totals decide the rating in the second. */
export interface BottleneckFact {
  machine: MachineRow;
  category: string;
  cell: string;
  hours: number;
  count: number;
  longest: number;
  days: number;
  avail: number;
  unav: number;
  a: number;
  mttr: number;
  perYear: number;
}

export interface BottleneckRisk extends BottleneckFact {
  peers: number;
  capLeft: number;
  score: number;
  rating: Rating;
}

/** The risk core 42b and 42c build on: the rated fleet and the window the fleet totals came from. */
export interface BottleneckCore {
  fleet: BottleneckRisk[];
  from: string;
  to: string;
  fleetUnav: number;
  /** The months inside the window the plant recorded nothing in; absent when the run named no span. */
  noRecords?: readonly string[];
}

/** The days the plant itself is observed: the core's window less the months it recorded nothing in. */
export const coreDays = (core: BottleneckCore): number =>
  observedDays(core.from, core.to, { from: core.from, to: core.to, noRecords: core.noRecords });

/** A category's or a cell's capacity numbers, shared by the two grids. */
interface Capacity {
  count: number;
  effective: number;
  hours: number;
  avail: number;
  weakest: BottleneckRisk;
}

type HoursProfile = { prodHrsPerDay: number; workDaysPerYear: number };

const sum = (values: readonly number[]): number =>
  values.reduce((total, value) => total + value, 0);

/**
 * The platform prints through `toLocaleString`, which rounds the shortest decimal that names the double, halves
 * away from zero. `formatInr`'s multiply can tip a value that only looks like a half: the key's TC-7 double is
 * 134.84999999999999 (a shortest form of 134.85) and prints 134.9, while TC-13's 117.44999999999999 prints 117.4.
 */
export function printed(value: number, decimals: number): number {
  if (!Number.isFinite(value)) return value;
  const text = Math.abs(value).toString();
  if (text.includes('e')) return Number(value.toFixed(decimals));
  const [whole = '0', fraction = ''] = text.split('.');
  const kept = fraction.slice(0, decimals).padEnd(decimals, '0');
  const next = fraction.charAt(decimals);
  const digits = BigInt(whole + kept) + (next >= '5' ? 1n : 0n);
  const rounded = Number(digits) / 10 ** decimals;
  return value < 0 ? -rounded : rounded;
}

const inr = (value: number, decimals: number): string =>
  formatInr(printed(value, decimals), decimals);

const plantDateLabel = (date: string): string => {
  const [year = '', month = '', day = ''] = date.split('-');
  return `${day} ${MONTHS[Number(month) - 1] ?? month} ${year}`;
};

/** The production breakdown rows: the fleet's, never PM (a NO-DT row still counts, with 0 h). */
function productionRows(data: EngineData): SourcedReport[] {
  const fleet = new Set(data.machines.filter(isProduction).map((machine) => machine.id));
  return sourcedReports(data).filter((row) => fleet.has(row.report.machineId) && !isPm(row));
}

/** 1 January of the earliest breakdown year to the latest breakdown date, both from the rows read. */
function periodOf(rows: readonly SourcedReport[]): Period | null {
  const dates = rows.map((row) => row.report.date).sort();
  const first = dates[0];
  const last = dates.at(-1);
  if (first === undefined || last === undefined) return null;
  return { from: `${first.slice(0, 4)}-01-01`, to: last };
}

interface Hours {
  hours: number;
  count: number;
  longest: number;
}

/** One machine's hours, row count and longest single breakdown, from its own rows. */
function machineHours(rows: readonly SourcedReport[]): Hours {
  let hours = 0;
  let longest = 0;
  for (const row of rows) {
    const value = effectiveHours(row.report);
    hours += value;
    if (value > longest) longest = value;
  }
  return { hours, count: rows.length, longest };
}

/** The first pass: every production machine's own numbers, before the fleet decides its rating. */
function factsOf(
  data: EngineData,
  rows: readonly SourcedReport[],
  period: Period,
  perDay: number,
): BottleneckFact[] {
  const byMachine = new Map<string, SourcedReport[]>();
  for (const row of rows) {
    const list = byMachine.get(row.report.machineId) ?? [];
    list.push(row);
    byMachine.set(row.report.machineId, list);
  }
  return data.machines.filter(isProduction).map((machine) => {
    const { hours, count, longest } = machineHours(byMachine.get(machine.id) ?? []);
    const days = observedDays(period.from, period.to, period, machine.purchasedOn?.slice(0, 10));
    const avail = days * perDay;
    const unav = avail > 0 ? Math.min(1, hours / avail) : 0;
    return {
      machine,
      category: normalizeLabel(machine.category ?? ''),
      cell: normalizeLabel(machine.cell ?? ''),
      hours,
      count,
      longest,
      days,
      avail,
      unav,
      a: 1 - unav,
      mttr: count > 0 ? hours / count : 0,
      perYear: days > 0 ? (hours / days) * 365 : 0,
    };
  });
}

/** How many machines share each key, in first-seen order (the tie order a stable sort keeps). */
function countsOf(facts: readonly BottleneckFact[], keyOf: (fact: BottleneckFact) => string) {
  const counts = new Map<string, number>();
  for (const fact of facts) {
    const key = keyOf(fact);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

/** The platform's score and rating for one machine, given its peers and the plant's own unavailability. */
function rate(fact: BottleneckFact, peers: number, fleetUnav: number): BottleneckRisk {
  const loss = fleetUnav > 0 ? Math.min(1, fact.unav / fleetUnav / 4) : 0;
  const crowd = 1 / Math.sqrt(peers);
  const score = Math.round(100 * (0.5 * loss + 0.5 * crowd));
  const critical = (peers === 1 && fact.unav > fleetUnav) || (score >= 55 && peers <= 10);
  const rating: Rating = critical
    ? 'Critical'
    : score >= 40
      ? 'High'
      : score >= 30
        ? 'Watch'
        : 'Low';
  return { ...fact, peers, capLeft: (peers - 1) / peers, score, rating };
}

/** The whole risk core, or null when the plant has no production breakdown to observe. */
export function a9RiskCore(data: EngineData, profile: HoursProfile): BottleneckCore | null {
  const rows = productionRows(data);
  const span = periodOf(rows);
  if (span === null) return null;
  const period = { ...span, noRecords: data.gaps };
  const perDay = (profile.prodHrsPerDay * profile.workDaysPerYear) / 365;
  const facts = factsOf(data, rows, period, perDay);
  if (facts.length === 0) return null;
  const totalAvail = sum(facts.map((fact) => fact.avail));
  if (!(totalAvail > 0)) return null;
  const fleetUnav = sum(facts.map((fact) => fact.hours)) / totalAvail;
  const peers = countsOf(facts, (fact) => fact.category);
  const fleet = facts.map((fact) => rate(fact, peers.get(fact.category) ?? 1, fleetUnav));
  return { fleet, from: period.from, to: period.to, fleetUnav, noRecords: data.gaps };
}

/** KPIs 0–3: the two rating counts, the sole-of-kind count and the plant's availability. */
function kpisOf(core: BottleneckCore): Kpi[] {
  const critical = core.fleet.filter((risk) => risk.rating === 'Critical').length;
  const high = core.fleet.filter((risk) => risk.rating === 'High').length;
  const sole = core.fleet.filter((risk) => risk.peers === 1).length;
  return [
    { label: 'Critical', value: String(critical), sub: 'machines that could stall production' },
    { label: 'High', value: String(high), sub: 'machines to watch closely' },
    { label: 'Only one of their kind', value: String(sole), sub: 'no backup machine in the plant' },
    {
      label: 'Plant availability',
      value: formatPercent(1 - core.fleetUnav),
      sub: `machine hours up, ${plantDateLabel(core.from)} to ${plantDateLabel(core.to)}`,
    },
  ];
}

/** Table 0: the riskiest machines, score desc then hours desc, top 20. */
function riskTable(fleet: readonly BottleneckRisk[]): Table {
  const sorted = [...fleet].sort((a, b) => b.score - a.score || b.hours - a.hours);
  const rows = sorted
    .slice(0, TOP_ROWS)
    .map((risk, index) => [
      String(index + 1),
      risk.machine.code,
      risk.category,
      risk.cell,
      String(risk.peers),
      formatPercent(risk.a),
      inr(risk.hours, 1),
      String(risk.count),
      `${inr(risk.longest, 1)} h`,
      formatPercent(risk.capLeft),
      String(risk.score),
      risk.rating,
    ]);
  return {
    title: 'Highest-risk machines',
    header: [
      '#',
      'Machine',
      'Category',
      'Cell',
      'Same kind',
      'Available',
      'BD hrs',
      'Breakdowns',
      'Longest',
      'Capacity left if down',
      'Score',
      'Rating',
    ],
    rows,
    rowCount: rows.length,
  };
}

/** The machine with the lowest availability; the fleet's own order breaks a tie, as a stable reduce does. */
function weakestOf(fleet: readonly BottleneckRisk[]): BottleneckRisk {
  return fleet.reduce((weakest, risk) => (risk.a < weakest.a ? risk : weakest));
}

const weakestLabel = (risk: BottleneckRisk): string =>
  `${risk.machine.code} (${formatPercent(risk.a)})`;

function capacityOf(fleet: readonly BottleneckRisk[]): Capacity {
  return {
    count: fleet.length,
    effective: sum(fleet.map((risk) => risk.a)),
    hours: sum(fleet.map((risk) => risk.hours)),
    avail: sum(fleet.map((risk) => risk.avail)),
    weakest: weakestOf(fleet),
  };
}

/** Table 3: capacity by category, machine count asc then average availability asc. */
function categoryTable(fleet: readonly BottleneckRisk[]): Table {
  const groups = new Map<string, BottleneckRisk[]>();
  for (const risk of fleet) {
    const list = groups.get(risk.category) ?? [];
    list.push(risk);
    groups.set(risk.category, list);
  }
  const rows = [...groups.entries()]
    .map(([category, group]) => {
      const capacity = capacityOf(group);
      return {
        row: [
          category,
          String(capacity.count),
          inr(capacity.effective, 1),
          formatPercent(capacity.effective / capacity.count),
          inr(capacity.hours, 0),
          weakestLabel(capacity.weakest),
          formatPercent((capacity.count - 1) / capacity.count),
        ],
        count: capacity.count,
        average: capacity.effective / capacity.count,
      };
    })
    .sort((left, right) => left.count - right.count || left.average - right.average)
    .map((entry) => entry.row);
  return {
    title: 'Capacity by machine category',
    header: [
      'Category',
      'Machines',
      'Effective machines',
      'Avg availability',
      'BD hrs',
      'Weakest machine',
      'Capacity left if it stops',
    ],
    rows,
    rowCount: rows.length,
  };
}

/** Table 4: capacity by cell, average availability asc; a blank cell prints the platform's own label. */
function cellTable(fleet: readonly BottleneckRisk[]): Table {
  const groups = new Map<string, BottleneckRisk[]>();
  for (const risk of fleet) {
    const list = groups.get(risk.cell) ?? [];
    list.push(risk);
    groups.set(risk.cell, list);
  }
  const rows = [...groups.entries()]
    .map(([cell, group]) => {
      const capacity = capacityOf(group);
      return {
        row: [
          cell === '' ? 'No cell assigned' : `Cell ${cell}`,
          String(capacity.count),
          formatPercent(capacity.effective / capacity.count),
          inr(capacity.hours, 0),
          formatPercent(capacity.avail > 0 ? capacity.hours / capacity.avail : 0),
          weakestLabel(capacity.weakest),
        ],
        average: capacity.effective / capacity.count,
      };
    })
    .sort((left, right) => left.average - right.average)
    .map((entry) => entry.row);
  return {
    title: 'Capacity by cell',
    header: ['Cell', 'Machines', 'Avg availability', 'BD hrs', 'BD %', 'Weakest machine'],
    rows,
    rowCount: rows.length,
  };
}

/** The A9 figure's risk core; an empty plant prints no page. The drill is every production machine. */
export const a9BottleneckFigure: Computer = ({ data, asOf, profile }) => {
  const core = a9RiskCore(data, profile);
  if (core === null) return { value: null, drillIds: [] };
  const kpis: Array<Kpi | null> = Array.from({ length: KPI_SLOTS }, () => null);
  kpis.splice(0, 4, ...kpisOf(core));
  const tables: Array<Table | null> = Array.from({ length: TABLE_SLOTS }, () => null);
  tables[0] = riskTable(core.fleet);
  tables[3] = categoryTable(core.fleet);
  tables[4] = cellTable(core.fleet);
  const page = {
    page: 'a9',
    title: 'Bottleneck Analysis',
    kpis,
    tables,
    charts: Array.from({ length: CHART_SLOTS }, () => null),
  };
  const value = { screen: 'a9-bottleneck-forecast', asOf, pages: [page] };
  return {
    value: value as unknown as FigureValue,
    drillIds: core.fleet.map((risk) => risk.machine.id),
  };
};
