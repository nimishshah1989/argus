import type { AnalyticsProfile } from '@uptimo/shared';
import { cellAt } from './hours.js';
import { isProduction } from './machine-facts.js';
import { dayNumber } from './plant-date.js';
import { effectiveHours, sourcedReports } from './rows.js';
import type { ComputeInput, EngineData, MachineRow, ReportRow } from './types.js';

/**
 * The Action Center's shared seam (ticket 44, packet 44a): the rule and severity types, the platform's 16 type
 * labels, the nudge key builder, the profile's 26 thresholds and the window/context the rules read. Every window
 * counts back from the run date (`asOf`); the plant's own limits come from the analytics profile, not a copy.
 *
 * The platform's `getMachine` reads the CNC machine master only, so every report lookup here is a report whose
 * machine has `segment === 'CNC'` (the Robot and excluded machines included). Production is the narrower set the
 * plant-wide rules read: CNC and not excluded from production.
 */

/** The 16 rules, in the order the platform raises them. */
export type ActionRule =
  | 'recur'
  | 'freq'
  | 'rise'
  | 'cell'
  | 'long'
  | 'spike'
  | 'good'
  | 'mttr'
  | 'hum'
  | 'shift'
  | 'team'
  | 'newm'
  | 'spares'
  | 'age'
  | 'amc'
  | 'legal';

export type NudgeSeverity = 'high' | 'med' | 'low' | 'info';

/** One nudge as the key holds it: the six fields of the figure's record, and nothing else. */
export interface ActionCenterNudge {
  key: string;
  rule: ActionRule;
  sev: NudgeSeverity;
  title: string;
  machines: string[];
  entries: number;
}

/** The platform's severity weights: the figure's sort and its risk score both read them. */
export const SEVERITY_WEIGHT: Readonly<Record<NudgeSeverity, number>> = {
  high: 3,
  med: 2,
  low: 1,
  info: 0,
};

/** The 16 type labels, verbatim from the key. */
export const ACTION_CENTER_TYPES: Readonly<Record<ActionRule, string>> = {
  recur: 'Recurring fault',
  freq: 'Frequent breakdowns',
  rise: 'Worsening machine',
  cell: 'Same cause in a cell',
  long: 'Long breakdown',
  spike: 'Plant trend',
  good: 'Good news',
  mttr: 'Slow repairs',
  hum: 'Human mistakes',
  shift: 'Shift pattern',
  team: 'Team workload',
  newm: 'New machine',
  spares: 'Spares spend',
  age: 'Ageing machines',
  amc: 'AMC / warranty ending',
  legal: 'Legal compliance due',
};

/** The profile keys the Action Center reads, in the legacy `ac` object's own order (plus its three inert keys). */
export const ACTION_CENTER_THRESHOLD_KEYS = [
  'repeatDays',
  'repeatMinDays',
  'freqDays',
  'freqMin',
  'cellDays',
  'cellMin',
  'longDays',
  'spikePct',
  'spikeMinHrs',
  'mttrMult',
  'mttrMin',
  'mttrDays',
  'humShare',
  'shiftShare',
  'teamShare',
  'newMachDays',
  'newMachMin',
  'spareDays',
  'spareShare',
  'riseMult',
  'riseMin',
  'oldAge',
  'snoozeDays',
  'pmDays',
  'noCodePct',
  'gapDays',
] as const;

export type ActionCenterThresholdKey = (typeof ACTION_CENTER_THRESHOLD_KEYS)[number];
export type ActionCenterThresholds = Record<ActionCenterThresholdKey, number>;

/** The plant's 26 limits, as the figure's `extra.thresholds` holds them (the key equals the profile defaults). */
export function actionCenterThresholds(profile: AnalyticsProfile): ActionCenterThresholds {
  const thresholds = {} as ActionCenterThresholds;
  for (const key of ACTION_CENTER_THRESHOLD_KEYS) thresholds[key] = profile[key];
  return thresholds;
}

/** The platform's nudge key, in one place: the persisted acknowledgement is stored under it (packet 44c). */
export const actionCenterKey = {
  recur: (machineId: string, code: string): string => `recur|${machineId}|${code}`,
  freq: (machineId: string): string => `freq|${machineId}`,
  rise: (machineId: string): string => `rise|${machineId}`,
  cell: (cell: string, code: string): string => `cell|${cell}|${code}`,
  long: (reportId: string): string => `long|${reportId}`,
  spike: (): string => 'spike|hrs',
  good: (): string => 'good|hrs',
  mttr: (machineId: string): string => `mttr|${machineId}`,
  hum: (): string => 'hum|all',
  shift: (shift: string): string => `shift|${shift}`,
  team: (name: string): string => `team|${name}`,
  newm: (machineId: string): string => `newm|${machineId}`,
  spares: (machineId: string): string => `spares|${machineId}`,
  age: (): string => 'age|all',
  amc: (lineId: string, end: string): string => `amc|${lineId}|${end}`,
  legal: (lineId: string, due: string): string => `legal|${lineId}|${due}`,
} as const;

/** One report the rules read, with the plant day, the effective hours and the trimmed code it carries. */
export interface ActionEntry {
  report: ReportRow;
  ticketId: string;
  machineId: string;
  machine: MachineRow;
  /** The whole UTC day number of the report's plant date. */
  day: number;
  pm: boolean;
  noDt: boolean;
  /** The platform's effective hours: recorded hours where present, minutes otherwise, and zero for a NO-DT entry. */
  hours: number;
  /** The maintenance code as the plant typed it, trimmed; blank when the row has none. */
  code: string;
  /** The same code upper-cased, for the two codes the source compares as words (PM, NO DT, HUM). */
  upperCode: string;
}

/** The rule/severity record a rule builds before the six-field nudge is cut from it. */
export interface ActionCenterRecord extends ActionCenterNudge {
  /** The evidence's plant day number, or null when the rule has no evidence (the AMC/legal reminders). */
  ev: number | null;
  /** True for the rules that count one per machine rather than per severity (the risk table reads it). */
  agg?: boolean;
  /** True for the reminders that add no machine risk. */
  noRisk?: boolean;
}

/**
 * Everything the rules read, built once: the entries in the CNC master, the production subset, the window helpers
 * and the plant labels. A window `(days, offset)` keeps `offset <= age < days + offset`, so the last 7 days are
 * ages 0-6 and the previous 30 are 30-59; a future-dated row is out.
 */
export interface ActionContext {
  data: EngineData;
  asOf: string;
  asOfDay: number;
  profile: AnalyticsProfile;
  thresholds: ActionCenterThresholds;
  /** The long-breakdown limit, the profile's `whyWhyThresholdHours` (not one of the 26). */
  whyWhyThresholdHours: number;
  machines: ReadonlyMap<string, MachineRow>;
  entries: readonly ActionEntry[];
  production: readonly ActionEntry[];
  /** The latest day any entry carries, or null when the plant has no entry at all. */
  lastEntryDay: number | null;
  breakdownsIn(days: number, offset?: number): ActionEntry[];
  productionBreakdownsIn(days: number, offset?: number): ActionEntry[];
  latest(entries: readonly ActionEntry[]): ActionEntry | null;
}

/** The window predicate every rule shares: `offset <= asOf - day < days + offset`. */
function inWindow(entry: ActionEntry, asOfDay: number, days: number, offset: number): boolean {
  const age = asOfDay - entry.day;
  return age >= offset && age < days + offset;
}

/** The cell the machine was in on the report's date, blank becoming the platform's dash. */
export function effectiveCell(entry: ActionEntry, moves: EngineData['moves']): string {
  return cellAt(entry.machine, moves, entry.report.date);
}

/** The machine's maintenance-code label before its em dash, trimmed; blank when the plant has no label. */
function codeLabel(data: EngineData, code: string): string {
  const row = (data.lists['maint_code'] ?? []).find((candidate) => candidate.code === code);
  return row === undefined ? '' : row.label.split('—')[0]!.trim();
}

/** The code as the platform writes it: `ATC (Automatic Tool Changer)`, or the bare code when it has no label. */
export function codeTitle(data: EngineData, code: string): string {
  const label = codeLabel(data, code);
  return label === '' ? code : `${code} (${label})`;
}

/** One CNC report as the rules read it. */
function entryOf(report: ReportRow, machine: MachineRow, ticketId: string): ActionEntry | null {
  const day = dayNumber(report.date);
  if (day === null) return null;
  const code = (report.maintCode ?? '').trim();
  const upperCode = code.toUpperCase();
  const noDt = upperCode === 'NO DT';
  return {
    report,
    ticketId,
    machineId: report.machineId,
    machine,
    day,
    pm: upperCode === 'PM',
    noDt,
    hours: noDt ? 0 : effectiveHours(report),
    code,
    upperCode,
  };
}

/** Build the context from the same `{data, asOf, profile}` every computer already gets. */
export function actionCenterContext(input: ComputeInput): ActionContext {
  const machines = new Map(input.data.machines.map((machine) => [machine.id, machine]));
  const entries: ActionEntry[] = [];
  for (const row of sourcedReports(input.data)) {
    const machine = machines.get(row.report.machineId);
    // The platform's getMachine reads the CNC master only, so a non-CNC report is invisible to every rule.
    if (machine === undefined || machine.segment !== 'CNC') continue;
    const entry = entryOf(row.report, machine, row.ticket.id);
    if (entry !== null) entries.push(entry);
  }
  const production = entries.filter((entry) => isProduction(entry.machine));
  const asOfDay = dayNumber(input.asOf) ?? 0;
  const lastEntryDay = entries.reduce<number | null>(
    (last, entry) => (last === null || entry.day > last ? entry.day : last),
    null,
  );
  const breakdownsIn = (days: number, offset = 0): ActionEntry[] =>
    entries.filter((entry) => !entry.pm && inWindow(entry, asOfDay, days, offset));
  return {
    data: input.data,
    asOf: input.asOf,
    asOfDay,
    profile: input.profile,
    thresholds: actionCenterThresholds(input.profile),
    whyWhyThresholdHours: input.profile.whyWhyThresholdHours,
    machines,
    entries,
    production,
    lastEntryDay,
    breakdownsIn,
    productionBreakdownsIn: (days, offset = 0) =>
      production.filter((entry) => !entry.pm && inWindow(entry, asOfDay, days, offset)),
    latest: (list) =>
      list.reduce<ActionEntry | null>(
        (last, entry) => (last === null || entry.day > last.day ? entry : last),
        null,
      ),
  };
}
