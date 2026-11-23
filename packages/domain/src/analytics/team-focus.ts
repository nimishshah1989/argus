import { a9RiskCore, coreDays } from './a9-bottleneck.js';
import {
  episodesOf,
  fleetRows,
  forecastBoard,
  FC_RUNS,
  type ForecastModel,
} from './a9-forecast-sim.js';
import { formatNumber } from './format.js';
import {
  analyzeProblems,
  type ProblemEvent,
  type ProblemGroupStat,
  type ProblemRepeat,
} from './problem-analysis.js';
import { dayNumber, dmy } from './plant-date.js';
import { effectiveHours } from './rows.js';
import { healthRowsOf, type HealthRow } from './team-focus-health.js';
import { hasPart, laneD } from './team-focus-spares.js';
import type { Computer, EngineData, FigureValue } from './types.js';

/**
 * Team Focus (ticket 43, packet 43b): the page's three KPI tiles and the month's ranked actions with the hours at
 * stake, whole against the 11 November key. The actions are the platform's six lanes in its own order: before next
 * month (the forecast), fix for good (repeat faults and the biggest problem groups), overhaul or replace (the
 * age-adjusted health score), Why-Why due (long breakdowns), spares to keep ready and the record's own gaps.
 *
 * A saved status, owner and note are not this figure's: the engine has no persistence, so every action prints the
 * platform's defaults (open, no owner, no note). The server packet stores them per `focus:<period>|<action>`.
 *
 * The legacy workbook keeps three spare columns and three cost columns. The engine's report row carries the live
 * app's single spare; a test seam supplies the other two and the costs, read as optional legacy columns here.
 */

type Lane = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';

/** The action as the lane builders make it; the printed row drops the internal machine when there is none. */
interface Action {
  readonly key: string;
  readonly lane: Lane;
  readonly mid?: string;
  readonly title: string;
  readonly stake: number;
}

/** The month the forecast covers, and the key its actions carry. */
interface FocusMonth {
  readonly key: string;
  readonly label: string;
}

/** The groups Team Focus never ranks as work: PM logged as a breakdown, the unplaced entries and installation work. */
const SKIP_GROUPS: ReadonlySet<string> = new Set([
  'PM logged as a breakdown',
  'Other / unclear',
  'Installation / relocation / trial',
]);

/** The page's own caps: eight forecast machines, six repeat pairs, three groups, five decisions, five Why-Why. */
const FORECAST_LIMIT = 8;
const REPEAT_LIMIT = 6;
const GROUP_LIMIT = 3;
const OVERHAUL_LIMIT = 5;
const WHY_WHY_LIMIT = 5;
/** The forecast's 90-day trend window and its band thresholds. */
const TREND_WINDOW = 90;
const BAND_HOT = 6;
const BAND_LIKELY = 3;
const BAND_WATCH = 1;

const round2 = (value: number): number => Math.round(value * 100) / 100;

const action = (key: string, lane: Lane, title: string, stake: number): Action => ({
  key,
  lane,
  title,
  stake,
});

/** One action with the machine its card can open; spares and record gaps name no machine. */
const withMid = (item: Action, mid: string | undefined): Action =>
  mid === undefined ? item : { ...item, mid };

/** The forecast band for one machine's expected hours. */
const bandOfHours = (hours: number): 'Hot' | 'Likely' | 'Watch' | 'Stable' =>
  hours >= BAND_HOT
    ? 'Hot'
    : hours >= BAND_LIKELY
      ? 'Likely'
      : hours >= BAND_WATCH
        ? 'Watch'
        : 'Stable';

/** The first full calendar month after the period end: the platform's own 1st-of-month arithmetic. */
function focusMonthOf(end: string, label: string): FocusMonth {
  const [year = 0, month = 1] = end.split('-').map(Number);
  const index = month === 12 ? 1 : month + 1;
  const years = month === 12 ? year + 1 : year;
  return { key: `${years}-${String(index).padStart(2, '0')}`, label };
}

/** A machine's own entries' days, in the platform's plant-day numbers. */
function eventDays(events: readonly ProblemEvent[]): number[] {
  return events
    .map((event) => dayNumber(event.date))
    .filter((day): day is number => day !== null)
    .sort((left, right) => left - right);
}

/** The platform's separate occurrences: a repair logged on nearby days is one job, not many. */
function occurrences(events: readonly ProblemEvent[]): number {
  const days = eventDays(events);
  let count = days.length > 0 ? 1 : 0;
  for (let index = 1; index < days.length; index += 1) {
    if ((days[index] ?? 0) - (days[index - 1] ?? 0) > 3) count += 1;
  }
  return count;
}

/** Lane A: the machines the forecast expects to be Hot or Likely (or rising out of Watch), top eight. */
function laneA(models: readonly ForecastModel[], month: FocusMonth): Action[] {
  const sorted = [...models].sort((left, right) => right.expH - left.expH || right.p80 - left.p80);
  return sorted
    .filter((model) => {
      const band = bandOfHours(model.expH);
      const rising = model.n90 >= 3 && model.n90 >= 2 * model.lam * TREND_WINDOW;
      return band === 'Hot' || band === 'Likely' || (rising && band !== 'Stable');
    })
    .slice(0, FORECAST_LIMIT)
    .map((model) => {
      const machine = model.risk.machine;
      return withMid(
        action(
          `fc|${machine.id}|${month.key}`,
          'A',
          `${machine.code} (${machine.category ?? '—'}): inspect before ${month.label}`,
          model.expH,
        ),
        machine.id,
      );
    });
}

/** Lane B, first half: the machine and problem pairs that came back on four or more separate occasions (Guide 29). */
function laneBRepeats(
  events: readonly ProblemEvent[],
  repeats: readonly ProblemRepeat[],
  months: number,
): Action[] {
  return repeats
    .map((repeat) => ({
      repeat,
      occ: occurrences(
        events.filter(
          (event) => event.machineId === repeat.machineId && event.group === repeat.group,
        ),
      ),
    }))
    .filter(({ occ }) => occ >= 4)
    .slice(0, REPEAT_LIMIT)
    .map(({ repeat, occ }) =>
      withMid(
        action(
          `fixm|${repeat.machineId}|${repeat.group}`,
          'B',
          `${repeat.machineCode}: ${repeat.group.toLowerCase()} has come back ${occ} times`,
          repeat.hours / months,
        ),
        repeat.machineId,
      ),
    );
}

/** The machine a group hits most often; a tie keeps the first the events met. */
function topMachineOf(events: readonly ProblemEvent[], group: string): string | undefined {
  const counts = new Map<string, number>();
  for (const event of events) {
    if (event.group !== group) continue;
    counts.set(event.machineId, (counts.get(event.machineId) ?? 0) + 1);
  }
  let best: string | undefined;
  let bestCount = 0;
  for (const [machineId, count] of counts) {
    if (count > bestCount) {
      best = machineId;
      bestCount = count;
    }
  }
  return best;
}

/** Lane B, second half: the three problem groups that lost the most hours. */
function laneBGroups(
  groups: readonly ProblemGroupStat[],
  events: readonly ProblemEvent[],
  months: number,
): Action[] {
  return groups
    .filter((group) => !SKIP_GROUPS.has(group.name))
    .slice(0, GROUP_LIMIT)
    .map((group) =>
      withMid(
        action(
          `fixg|${group.name}`,
          'B',
          `${group.name}: one of the biggest losses`,
          group.hours / months,
        ),
        topMachineOf(events, group.name),
      ),
    );
}

/** Lane C: the Poor or Critical machines losing more hours than their age and category expect, top five. */
function laneC(rows: readonly HealthRow[]): Action[] {
  return rows
    .filter(
      (row) =>
        row.days > 0 && (row.label === 'Critical' || row.label === 'Poor') && row.h - row.expH > 0,
    )
    .map((row) => ({ row, excess: (row.h - row.expH) / Math.max(1, row.days / 30.44) }))
    .sort((left, right) => right.excess - left.excess)
    .slice(0, OVERHAUL_LIMIT)
    .map(({ row, excess }) =>
      withMid(
        action(
          `ovh|${row.risk.machine.id}`,
          'C',
          `${row.risk.machine.code} (${row.risk.machine.category ?? '—'}): decide on overhaul or replacement`,
          excess,
        ),
        row.risk.machine.id,
      ),
    );
}

/** Lane F: long breakdowns in the Why-Why window that still have no saved root-cause record. */
function laneF(
  data: EngineData,
  options: { asOf: string; months: number; threshold: number; windowDays: number },
): Action[] {
  const end = dayNumber(options.asOf) ?? 0;
  const completed = new Set((data.whyWhy ?? []).map((record) => record.ticketId));
  const codes = new Map(data.machines.map((machine) => [machine.id, machine.code]));
  return fleetRows(data)
    .filter((row) => {
      const day = dayNumber(row.report.date);
      const age = day === null ? -1 : end - day;
      return (
        age >= 0 &&
        age < options.windowDays &&
        effectiveHours(row.report) > options.threshold &&
        !completed.has(row.ticket.id)
      );
    })
    .sort((left, right) => right.report.date.localeCompare(left.report.date))
    .slice(0, WHY_WHY_LIMIT)
    .map((row) => {
      const hours = effectiveHours(row.report);
      return withMid(
        action(
          `long|${row.report.id}`,
          'F',
          `${codes.get(row.report.machineId) ?? row.report.machineId}: ${formatNumber(hours, 1)} hrs breakdown on ${dmy(row.report.date)} — Why-Why not done`,
          hours / options.months,
        ),
        row.report.machineId,
      );
    });
}

/** Lane E: the two data gaps this key's log has, with no hours at stake. */
function laneE(data: EngineData, events: readonly ProblemEvent[]): Action[] {
  const pairs = new Map<string, { n: number; h: number }>();
  for (const event of events) {
    const pair = pairs.get(event.key) ?? { n: 0, h: 0 };
    pair.n += 1;
    pair.h += event.hours;
    pairs.set(event.key, pair);
  }
  const multi = [...pairs.values()].filter(
    (pair) => pair.n >= 4 || (pair.n >= 3 && pair.h >= 20),
  ).length;
  const costless = fleetRows(data).filter((row) => hasPart(row.report)).length;
  const found: Action[] = [];
  if (multi > 0) {
    found.push(
      action(
        'data|multi',
        'E',
        `${multi} machine and problem pairs are logged four or more times`,
        0,
      ),
    );
  }
  if (costless >= 20) {
    found.push(
      action('data|cost', 'E', `Spare cost is blank on ${costless} breakdowns that used spares`, 0),
    );
  }
  return found;
}

/** The three KPI tiles: every action is open in this figure, so done and progress are zero. */
function kpisOf(actions: readonly Action[]): FigureValue {
  return [
    {
      label: 'Actions',
      value: String(actions.length),
      sub: `${actions.length} not started, 0 in progress`,
    },
    { label: 'Done', value: '0', sub: '0 marked not needed' },
    { label: 'Progress', value: '0%', sub: 'of actions done or not needed' },
  ];
}

/** One action as the key prints it: its computed text and stake, and the untouched status, owner and note. */
function printedAction(item: Action, codes: ReadonlyMap<string, string>): FigureValue {
  return {
    key: item.key,
    lane: item.lane,
    // `machine` is the row the card opens (an id); `machineCode` is what the card prints.
    ...(item.mid === undefined
      ? {}
      : { machine: item.mid, machineCode: codes.get(item.mid) ?? item.mid }),
    title: item.title,
    stake: round2(item.stake),
    status: 'open',
    owner: '',
    note: '',
  };
}

/**
 * The Team Focus figure: the page's three KPIs and the six lanes in the platform's order. A plant with no production
 * breakdown has nothing to plan, so the value is null rather than a fabricated empty page. The drill names the
 * machines the actions themselves name; spares and record gaps drill nowhere and are left out.
 */
export const teamFocusFigure: Computer = ({ data, asOf, profile }) => {
  const core = a9RiskCore(data, profile);
  if (core === null) return { value: null, drillIds: [] };
  const board = forecastBoard(core, episodesOf(fleetRows(data)), FC_RUNS);
  const analysis = analyzeProblems(data);
  // The platform's day difference (to - from) over 30.44, less the days of a month the plant recorded nothing in.
  const months = Math.max(1, (coreDays(core) - 1) / 30.44);
  const month = focusMonthOf(core.to, board.month.label);
  const codes = new Map(data.machines.map((machine) => [machine.id, machine.code]));
  const actions = [
    ...laneA(board.models, month),
    ...laneBRepeats(analysis.events, analysis.repeats, months),
    ...laneBGroups(analysis.groups, analysis.events, months),
    ...laneC(healthRowsOf(core, data, profile.whyWhyThresholdHours)),
    ...laneF(data, {
      asOf,
      months,
      threshold: profile.whyWhyThresholdHours,
      windowDays: profile.longDays,
    }),
    ...laneD(data, months),
    ...laneE(data, analysis.events),
  ];
  if (actions.length === 0) return { value: null, drillIds: [] };
  const page = {
    page: 'tf',
    title: 'Team Focus',
    kpis: kpisOf(actions),
    tables: [],
    charts: [],
  };
  const value = {
    screen: 'team-focus',
    asOf,
    period: month.key,
    pages: [page],
    extra: actions.map((item) => printedAction(item, codes)),
  };
  return {
    value: value as unknown as FigureValue,
    drillIds: [...new Set(actions.flatMap((item) => (item.mid === undefined ? [] : [item.mid])))],
  };
};
