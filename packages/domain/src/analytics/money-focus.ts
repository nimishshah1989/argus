import type { BottleneckCore } from './a9-bottleneck.js';
import { fleetRows, type ForecastModel } from './a9-forecast-sim.js';
import type { Health } from './money-health.js';
import { dayNumber } from './plant-date.js';
import type { ProblemAnalysis } from './problem-analysis.js';
import { OTHER_PROBLEM } from './problem-groups.js';
import { effectiveHours, isPm, sourcedReports } from './rows.js';
import type { EngineData, ReportRow } from './types.js';

/**
 * The hours at stake in the open Team Focus actions (ticket 43, packet 43c): Money Matters prices them at a year
 * of the throughput value. The five lanes are the platform's own (Guide sections 20 and 30): the forecast's
 * machines to inspect, the repeat-fault and biggest-group problems, the poor machines to overhaul, the long
 * breakdowns with no Why-Why, and the spares to keep ready. A plant with no saved Team Focus status keeps every
 * action open, which is this key's state.
 *
 * The file split follows the hard 400-line budget, the same reason 42b and 42d split their own work.
 */

/** Team Focus keeps the best few of each lane; money only needs their stakes. */
const FOCUS_ROWS = 5;
const INSPECT_ROWS = 8;
/** The platform's "one job" window: entries on the same machine and group within three days are one occasion. */
const OCCASION_GAP = 3;

/** The problem groups the Team Focus problem lane skips: PM logged as a breakdown, Other and installation. */
const TF_SKIP: ReadonlySet<string> = new Set([
  'PM logged as a breakdown',
  OTHER_PROBLEM,
  'Installation / relocation / trial',
]);

/** The repeat pairs: four or more entries and three or more separate occasions for one machine and group. */
function repeatPairs(problems: ProblemAnalysis): ReadonlySet<string> {
  const pairs = new Set<string>();
  for (const repeat of problems.repeats) {
    const days = problems.events
      .filter((event) => event.machineId === repeat.machineId && event.group === repeat.group)
      .map((event) => dayNumber(event.date))
      .filter((day): day is number => day !== null)
      .sort((left, right) => left - right);
    let occasions = days.length > 0 ? 1 : 0;
    for (let index = 1; index < days.length; index += 1) {
      if ((days[index] ?? 0) - (days[index - 1] ?? 0) > OCCASION_GAP) occasions += 1;
    }
    if (occasions >= 3) pairs.add(repeat.machineId + '|' + repeat.group);
  }
  return pairs;
}

export interface Lever {
  name: string;
  detail: string;
  hours: number;
  machines: Set<string>;
}

export interface LeverRules {
  threshold: number;
  succ: number;
}

export interface LeverResult {
  list: Lever[];
  combined: number;
}

/** The four opportunity levers, with the sentence each row prints under its name. */
function leverDefs(threshold: number): Lever[] {
  return [
    {
      name: 'Fix repeat problems for good',
      detail:
        'The same problem on the same machine four or more times (Problem Analysis). A permanent fix removes these.',
      hours: 0,
      machines: new Set(),
    },
    {
      name: 'Bring poor machines back to normal',
      detail:
        'Hours lost beyond what is expected for the machine’s age and category (health score).',
      hours: 0,
      machines: new Set(),
    },
    {
      name: 'Stop long breakdowns at the Why-Why limit',
      detail:
        'Hours beyond ' +
        threshold +
        ' hrs on a single breakdown. Root-cause work and ready spares cut these.',
      hours: 0,
      machines: new Set(),
    },
    {
      name: 'Repair faster on slow machines',
      detail: 'Machines whose average repair time is longer than their category’s (MTTR).',
      hours: 0,
      machines: new Set(),
    },
  ];
}

/** Each machine's share of the poor-machine and slow-repair levers, from its excess and repair time. */
function leverShares(health: readonly Health[]): Map<string, { f2: number; f4: number }> {
  const categories = new Map<string, { n: number; h: number }>();
  for (const row of health) {
    if (row.n === 0) continue;
    const tally = categories.get(row.category) ?? { n: 0, h: 0 };
    tally.n += row.n;
    tally.h += row.hours;
    categories.set(row.category, tally);
  }
  return new Map(
    health.map((row) => {
      const tally = categories.get(row.category);
      const mean = tally !== undefined && tally.n > 0 ? tally.h / tally.n : 0;
      const mttr = row.n >= 3 ? row.hours / row.n : 0;
      const excess = Math.max(0, row.hours - row.expH);
      const f2 = row.hours > 0 ? Math.min(1, excess / row.hours) : 0;
      const f4 = mttr > 0 && mean > 0 ? Math.max(0, 1 - mean / mttr) : 0;
      return [row.machineId, { f2, f4 }];
    }),
  );
}

/** The four levers: each event's share of one lever, and their overlap-free combination (Guide section 30). */
export function levers(
  problems: ProblemAnalysis,
  health: readonly Health[],
  rules: LeverRules,
): LeverResult {
  const pairs = repeatPairs(problems);
  const shares = leverShares(health);
  const list = leverDefs(rules.threshold);
  let combined = 0;
  for (const event of problems.events) {
    const own = shares.get(event.machineId) ?? { f2: 0, f4: 0 };
    const factors = [
      pairs.has(event.machineId + '|' + event.group) ? 1 : 0,
      own.f2,
      event.hours > rules.threshold ? (event.hours - rules.threshold) / event.hours : 0,
      own.f4,
    ];
    let keep = 1;
    factors.forEach((factor, index) => {
      if (factor > 0 && event.hours > 0) {
        const lever = list[index]!;
        lever.hours += event.hours * factor * rules.succ;
        lever.machines.add(event.machineId);
      }
      keep *= 1 - rules.succ * factor;
    });
    combined += event.hours * (1 - keep);
  }
  return { list, combined };
}

/** A forecast row's hours band, as the planning table reads it. */
const hoursBand = (expH: number): string =>
  expH >= 6 ? 'Hot' : expH >= 3 ? 'Likely' : expH >= 1 ? 'Watch' : 'Stable';

/** The forecast lane: the machines to inspect before next month, hours at stake. */
function forecastStake(models: readonly ForecastModel[]): number {
  return models
    .filter((model) => {
      const band = hoursBand(model.expH);
      const rising = model.n90 >= 3 && model.n90 >= 2 * model.lam * 90;
      return band === 'Hot' || band === 'Likely' || (rising && band !== 'Stable');
    })
    .slice(0, INSPECT_ROWS)
    .reduce((total, model) => total + model.expH, 0);
}

/** The problem lane: the repeat faults and the biggest groups, hours a month at stake. */
function problemStake(problems: ProblemAnalysis, months: number): number {
  const pairs = repeatPairs(problems);
  const repeats = problems.repeats
    .filter((repeat) => pairs.has(repeat.machineId + '|' + repeat.group))
    .slice(0, 6);
  const groups = problems.groups.filter((group) => !TF_SKIP.has(group.name)).slice(0, 3);
  return (
    repeats.reduce((total, repeat) => total + repeat.hours / months, 0) +
    groups.reduce((total, group) => total + group.hours / months, 0)
  );
}

/** The overhaul lane: the poor and critical machines ranked by excess hours a month. */
function healthStake(health: readonly Health[]): number {
  const excess = (row: Health): number => (row.hours - row.expH) / Math.max(1, row.days / 30.44);
  return health
    .filter((row) => (row.label === 'Critical' || row.label === 'Poor') && row.hours - row.expH > 0)
    .sort((left, right) => excess(right) - excess(left))
    .slice(0, FOCUS_ROWS)
    .reduce((total, row) => total + excess(row), 0);
}

/** The Why-Why lane: the long breakdowns of the last sixty days that no saved record has answered. */
function whyWhyStake(data: EngineData, core: BottleneckCore, rules: WhyWhyRules): number {
  const asOfDay = dayNumber(rules.asOf) ?? dayNumber(core.to) ?? 0;
  const cnc = new Set(
    data.machines.filter((machine) => machine.segment === 'CNC').map((machine) => machine.id),
  );
  const solved = new Set((data.whyWhy ?? []).map((record) => record.ticketId));
  const rows = sourcedReports(data)
    .filter((row) => cnc.has(row.report.machineId) && !isPm(row))
    .filter((row) => row.ticket.id === null || !solved.has(row.ticket.id))
    .map((row) => ({ hours: effectiveHours(row.report), day: dayNumber(row.report.date) }))
    .filter(
      (row): row is { hours: number; day: number } =>
        row.day !== null &&
        row.day <= asOfDay &&
        row.day > asOfDay - 60 &&
        row.hours > rules.threshold,
    );
  const severity = (row: { hours: number }): number => (row.hours >= 2 * rules.threshold ? 1 : 0);
  return rows
    .sort((left, right) => severity(right) - severity(left) || right.day - left.day)
    .slice(0, FOCUS_ROWS)
    .reduce((total, row) => total + row.hours / rules.months, 0);
}

/** A spare's key: its lowercased words, with the platform's own stop list dropped. */
const PART_STOP: ReadonlySet<string> = new Set(
  'no any nil na none nos pcs pc mm kg x c a the of and set new old'.split(' '),
);

const partKey = (name: string): string => {
  const words = name
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length >= 2 && !PART_STOP.has(word));
  return words.length > 0 ? [...new Set(words)].sort().join(' ') : '';
};

/** The spares a report names: every field it has, or its one `spareUsed` where the older seam wrote only one. */
const sparesOf = (report: ReportRow): readonly string[] =>
  report.spares ??
  (report.spareUsed === null || report.spareUsed.trim() === '' ? [] : [report.spareUsed]);

/** The spares lane: parts used three or more times on two or more machines, hours at stake. */
function spareStake(rows: readonly ReportRow[], months: number): number {
  const parts = new Map<string, { n: number; machines: Set<string>; hours: number }>();
  for (const row of rows) {
    for (const name of sparesOf(row)) {
      const key = partKey(name);
      if (key === '') continue;
      const part = parts.get(key) ?? { n: 0, machines: new Set<string>(), hours: 0 };
      part.n += 1;
      part.machines.add(row.machineId);
      part.hours += effectiveHours(row);
      parts.set(key, part);
    }
  }
  return [...parts.values()]
    .filter((part) => part.n >= 3 && part.machines.size >= 2)
    .sort((left, right) => right.n - left.n)
    .slice(0, FOCUS_ROWS)
    .reduce((total, part) => total + part.hours / months, 0);
}

interface WhyWhyRules {
  asOf: string;
  months: number;
  threshold: number;
}

/** What the five lanes read beside the rows: the fleet's analyses, the next month and the plant's own limits. */
export interface FocusContext {
  problems: ProblemAnalysis;
  health: readonly Health[];
  models: readonly ForecastModel[];
  months: number;
  asOf: string;
  threshold: number;
}

/** The open actions' hours a month: the five lanes' stakes, summed in the page's own lane order. */
export function stakeHours(data: EngineData, core: BottleneckCore, context: FocusContext): number {
  const rows = fleetRows(data).map((row) => row.report);
  return (
    forecastStake(context.models) +
    problemStake(context.problems, context.months) +
    healthStake(context.health) +
    whyWhyStake(data, core, context) +
    spareStake(rows, context.months)
  );
}
