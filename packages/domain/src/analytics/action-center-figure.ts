import {
  ACTION_CENTER_TYPES,
  SEVERITY_WEIGHT,
  actionCenterThresholds,
} from './action-center-model.js';
import type {
  ActionCenterNudge,
  ActionCenterRecord,
  ActionRule,
  NudgeSeverity,
} from './action-center-model.js';
import { actionCenterRecords } from './action-center-rules.js';
import { dayNumber } from './plant-date.js';
import { plantDay } from './plant-day.js';
import type { ComputeInput, Computer, EngineData, FigureValue, NudgeAck } from './types.js';

/**
 * The Action Center figure (ticket 44, packet 44b): the status every stored ack gives its nudge, the
 * "Machines needing attention" table, the key's one page and the whole figure value, and the board the screen
 * reads. The figure and the board are cut from one core (the engine's record list plus the statuses), so the page's
 * table and the board's risk rows cannot drift.
 *
 * The platform's status rules are ported as the plan states them: an ack is stored by the full nudge key; one saved
 * in the future did not exist yet; a snooze holds while its day is after the run date and has no reopened flag; a
 * nudge whose evidence day is after the ack's day reopens; a done ack resolves and an ack acknowledges.
 */

const DAY_MS = 86_400_000;
/** The page's risk table holds the platform's top eight machines. */
const RISK_LIMIT = 8;

/** The four statuses a card (and the board) can carry. */
export type NudgeStatus = 'open' | 'ack' | 'snoozed' | 'resolved';

/** One board card: the key's six fields plus the status, the evidence, the exclusion and the stored ack. */
export interface BoardNudge extends ActionCenterNudge {
  status: NudgeStatus;
  reopened: boolean;
  /** The latest entry's plant date (`YYYY-MM-DD`), or null when the nudge has no evidence (AMC, legal). */
  ev: string | null;
  /** True when the nudge names machines and every one of them is excluded from production data. */
  excluded: boolean;
  ack: NudgeAck | null;
}

/** One "Machines needing attention" row: the machine, its model, its score and the rules that added to it. */
export interface RiskRow {
  machine: string;
  model: string;
  score: number;
  why: string;
}

/** The screen's read model (packet 44c's routes return it; packet 44d renders it). Not a registered figure. */
export interface ActionCenterBoard {
  asOf: string;
  snoozeDays: number;
  types: Record<ActionRule, string>;
  nudges: BoardNudge[];
  counts: Record<NudgeStatus, number>;
  bySeverity: Record<NudgeSeverity, number>;
  risk: RiskRow[];
}

/** The status one current nudge's stored ack gives it, with a future-dated ack treated as absent. */
interface StatusInfo {
  status: NudgeStatus;
  reopened: boolean;
  ack: NudgeAck | null;
}

/** The shared core: the engine's records, their statuses and the risk rows cut from the open ones. */
interface Core {
  records: ActionCenterRecord[];
  statuses: StatusInfo[];
  risk: RiskRow[];
}

/** A whole day number as the plant date the board carries. */
const plantDateOf = (day: number): string => new Date(day * DAY_MS).toISOString().slice(0, 10);

/** The six fields the figure prints and the key holds. */
const sixFields = (record: ActionCenterRecord): ActionCenterNudge => ({
  key: record.key,
  rule: record.rule,
  sev: record.sev,
  title: record.title,
  machines: record.machines,
  entries: record.entries,
});

/**
 * The status of one nudge from its stored ack. A snooze holds while its `until` plant day is after the run date;
 * otherwise newer evidence reopens the nudge, a done ack resolves it and an ack acknowledges it.
 */
function statusOf(
  record: ActionCenterRecord,
  ack: NudgeAck | null,
  asOfDay: number,
  timeZone: string,
): StatusInfo {
  if (ack === null) return { status: 'open', reopened: false, ack: null };
  const ackDay = dayNumber(plantDay(ack.at, timeZone));
  if (ackDay === null || ackDay > asOfDay) return { status: 'open', reopened: false, ack };
  if (ack.status === 'snooze') {
    const until = ack.until === undefined ? null : dayNumber(plantDay(ack.until, timeZone));
    return {
      status: until !== null && until > asOfDay ? 'snoozed' : 'open',
      reopened: false,
      ack,
    };
  }
  if (record.ev !== null && record.ev > ackDay) return { status: 'open', reopened: true, ack };
  return { status: ack.status === 'done' ? 'resolved' : 'ack', reopened: false, ack };
}

/** The score one open, non-info, non-reminder nudge adds to each machine it names (the platform's weights). */
function riskWeight(record: ActionCenterRecord): number {
  return record.agg === true ? 1 : SEVERITY_WEIGHT[record.sev];
}

/**
 * The risk table: every open non-info nudge without `noRisk` adds to each machine it names, a stable score sort
 * keeps the platform's order, and the top eight print. The `why` joins the rule labels in the order they first
 * counted, with `xN` when one rule counted more than once.
 */
function riskRows(
  records: readonly ActionCenterRecord[],
  statuses: readonly StatusInfo[],
  data: EngineData,
): RiskRow[] {
  const tallies = new Map<
    string,
    { machine: string; score: number; rules: Map<ActionRule, number> }
  >();
  records.forEach((record, index) => {
    if (statuses[index]!.status !== 'open' || record.sev === 'info' || record.noRisk === true)
      return;
    const weight = riskWeight(record);
    for (const machine of record.machines) {
      const tally = tallies.get(machine) ?? { machine, score: 0, rules: new Map() };
      tally.score += weight;
      tally.rules.set(record.rule, (tally.rules.get(record.rule) ?? 0) + 1);
      tallies.set(machine, tally);
    }
  });
  const models = new Map(data.machines.map((machine) => [machine.id, machine.model]));
  return [...tallies.values()]
    .sort((left, right) => right.score - left.score)
    .slice(0, RISK_LIMIT)
    .map((tally) => ({
      machine: tally.machine,
      model: models.get(tally.machine) ?? '',
      score: tally.score,
      why: [...tally.rules]
        .map(([rule, count]) => `${ACTION_CENTER_TYPES[rule]}${count > 1 ? ` x${count}` : ''}`)
        .join(' '),
    }));
}

/** Build the one core both the figure and the board read. */
function coreOf(input: ComputeInput): Core {
  const records = actionCenterRecords(input);
  const acks = input.data.settings?.nudgeAcks ?? {};
  const asOfDay = dayNumber(input.asOf) ?? 0;
  const statuses = records.map((record) =>
    statusOf(record, acks[record.key] ?? null, asOfDay, input.data.timeZone),
  );
  return { records, statuses, risk: riskRows(records, statuses, input.data) };
}

/** The page's one table: the risk rows, the machine cell a space and the model. */
function nudgeTable(risk: readonly RiskRow[], data: EngineData) {
  const codes = new Map(data.machines.map((machine) => [machine.id, machine.code]));
  const rows = risk.map((row) => [
    `${codes.get(row.machine) ?? row.machine} ${row.model}`.trim(),
    String(row.score),
    row.why,
  ]);
  return {
    title: 'Machines needing attention',
    header: ['Machine', 'Score', 'Why'],
    rows,
    rowCount: rows.length,
  };
}

/**
 * The figure: the key's one page and its extra payload, with the drill naming every machine the nudges name. A
 * plant with no nudge, or no nudge that names a machine, prints null: the engine refuses a value that names no row.
 * The board still lists such nudges; only the parity figure is null.
 */
export const actionCenterFigure: Computer = (input) => {
  const core = coreOf(input);
  const drillIds = [...new Set(core.records.flatMap((record) => record.machines))];
  if (core.records.length === 0 || drillIds.length === 0) return { value: null, drillIds: [] };
  const value = {
    screen: 'action-center',
    asOf: input.asOf,
    pages: [
      {
        page: 'ac',
        title: 'Action Center',
        kpis: [],
        tables: [nudgeTable(core.risk, input.data)],
        charts: [],
      },
    ],
    extra: {
      types: { ...ACTION_CENTER_TYPES },
      thresholds: actionCenterThresholds(input.profile),
      acks: input.data.settings?.nudgeAcks ?? {},
      nudges: core.records.map(sixFields),
    },
  };
  return { value: value as unknown as FigureValue, drillIds };
};

/**
 * The screen's board: every current nudge with its status, its evidence, whether it is wholly outside production
 * data and the stored ack, plus the status and severity counts and the same risk rows the page prints.
 */
export function actionCenterBoard(input: ComputeInput): ActionCenterBoard {
  const core = coreOf(input);
  const excluded = new Set(
    input.data.machines
      .filter((machine) => machine.excludedFromProduction)
      .map((machine) => machine.id),
  );
  const counts: Record<NudgeStatus, number> = { open: 0, ack: 0, snoozed: 0, resolved: 0 };
  const bySeverity: Record<NudgeSeverity, number> = { high: 0, med: 0, low: 0, info: 0 };
  const nudges = core.records.map((record, index): BoardNudge => {
    const info = core.statuses[index]!;
    counts[info.status] += 1;
    if (info.status === 'open') bySeverity[record.sev] += 1;
    return {
      ...sixFields(record),
      status: info.status,
      reopened: info.reopened,
      ev: record.ev === null ? null : plantDateOf(record.ev),
      excluded:
        record.machines.length > 0 && record.machines.every((machine) => excluded.has(machine)),
      ack: info.ack,
    };
  });
  return {
    asOf: input.asOf,
    snoozeDays: input.profile.snoozeDays,
    types: { ...ACTION_CENTER_TYPES },
    nudges,
    counts,
    bySeverity,
    risk: core.risk,
  };
}
