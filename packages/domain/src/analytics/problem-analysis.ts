import { normalizeLabel } from './format.js';
import { isProduction } from './machine-facts.js';
import {
  OTHER_PROBLEM,
  PROBLEM_GROUPS,
  problemGroupOf,
  type ProblemGroup,
} from './problem-groups.js';
import { effectiveHours, isPm, sourcedReports, type SourcedReport } from './rows.js';
import type { EngineData, MachineRow } from './types.js';

/**
 * A10's analysis core (ticket 41, packet 41d-1): the platform's event list and the four aggregations the Problem
 * Analysis page prints — its groups, families, repeat pairs and leftover words. This packet registers no figure; the
 * page and its two charts land in 41d-2, and both read the shapes below.
 *
 * Every production breakdown is one event: the page's merge switch is off on this key, so two entries with the same
 * event key stay two events and the key only decides the sort. Every sum accumulates in that sorted order because
 * float addition order is visible in the key's hours (the shared rule for A10).
 */

/** The platform's event key carries the first 30 characters of the normalised problem text. */
const KEY_CHARS = 30;
/** A "quick stop" is half an hour or less, the group table's own column. */
const QUICK_HOURS = 0.5;
/** A repeat is the same machine meeting the same group this many times or more. */
const REPEAT_MIN = 4;
/** The words table keeps three-letter-and-up words and shows its first 14. */
const WORD_MIN = 3;
const WORD_LIMIT = 14;
/** The platform files a group's entries under its family; the entries it cannot place are "Other". */
const OTHER_FAMILY = 'Other';

/**
 * The words table's stop set, the platform's own `PW_STOP`: generic words that say nothing about a kind of problem.
 * It is not 41d-2's classifier stop set; the two lists are different and both exact.
 */
export const PW_STOP: ReadonlySet<string> = new Set(
  `the and for with from that this was were are not has had have its due got get ok okay
done machine mc problem issue issues check checked found now then again also new old set all one two change changed
changes replace replaced replacing get when while after before into onto out off over under per but can could would
will shall may must than too very just only some any other same such here there their them they you your our out
about above below between through during without within against along among since until upon whether which who whom
whose why how what where each every both either neither few more most less least many much own so these those been
being did does doing done had having were was is it in on at to of by as an a or if be no yes we he she him her his
hers ours ok normal working work run running start started starting stop stopped open opened close closed fix fixed fixing
repair repaired repairing clean cleaned cleaning remove removed removing put puted attach attached attaching tighten
tightened handover hand over ok`.split(/\s+/),
);

/** One breakdown as the analysis reads it: the platform's event key and group, the plant date and the hours. */
export interface ProblemEvent {
  /** `machineId|normalised problem` (lowercase, non-alphanumerics stripped, first 30 characters). */
  readonly key: string;
  readonly reportId: string;
  readonly ticketId: string;
  readonly machineId: string;
  readonly date: string;
  /** The problem text as the row carries it; callers that print it collapse its whitespace. */
  readonly problem: string;
  readonly correctiveAction: string;
  readonly group: string;
  /** The effective recorded hours: a NO-DT entry contributes zero, as every A10 total reads. */
  readonly hours: number;
}

/** One row of "All problem groups": the group's platform family, its count, hours, machines and quick stops. */
export interface ProblemGroupStat {
  readonly name: string;
  readonly family: string;
  readonly count: number;
  readonly hours: number;
  /** The distinct machines, in the order the events met them. */
  readonly machineIds: readonly string[];
  /** The events at half an hour or less; the table prints it as a share of the count. */
  readonly quick: number;
}

/** One row of "Families of problems": its groups in the order the events met them, as the platform's Set holds them. */
export interface ProblemFamilyStat {
  readonly name: string;
  readonly count: number;
  readonly hours: number;
  readonly groups: readonly string[];
}

/** One repeat pair: the same machine met the same group four or more times. */
export interface ProblemRepeat {
  readonly machineId: string;
  /** The machine code the page prints (the row's id is a database id, never a label). */
  readonly machineCode: string;
  readonly category: string;
  readonly group: string;
  readonly count: number;
  readonly hours: number;
}

/** One row of "Words not yet recognised": a word the Other / unclear entries share, with an example problem. */
export interface ProblemWord {
  readonly word: string;
  readonly count: number;
  readonly hours: number;
  readonly example: string;
}

/** Everything the A10 page reads from the platform's problem analysis, before it formats a single cell. */
export interface ProblemAnalysis {
  readonly events: readonly ProblemEvent[];
  readonly groups: readonly ProblemGroupStat[];
  readonly families: readonly ProblemFamilyStat[];
  readonly repeats: readonly ProblemRepeat[];
  readonly words: readonly ProblemWord[];
  readonly totalCount: number;
  readonly totalHours: number;
}

/** The plant's edited group list when it holds one, else the platform default (R7); an empty list is never an edit. */
function groupListOf(data: EngineData): readonly ProblemGroup[] {
  const edited = data.settings?.problemGroups;
  return edited !== undefined && edited.length > 0 ? edited : PROBLEM_GROUPS;
}

/** The platform's normalised problem text: lowercased with every non-alphanumeric run removed. */
const normaliseProblem = (problem: string): string =>
  problem
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, KEY_CHARS);

/**
 * One sourced row as an event: its ticket, its machine, the effective hours and the group the classifier chose. The
 * key leads with the machine's code (the platform's "machine ID"), so the sort is the plant's order, never an id's.
 */
function eventOf(row: SourcedReport, group: string, code: string): ProblemEvent {
  const { report, ticket } = row;
  return {
    key: `${code}|${normaliseProblem(report.problem)}`,
    reportId: report.id,
    ticketId: ticket.id,
    machineId: report.machineId,
    date: report.date,
    problem: report.problem,
    correctiveAction: report.correctiveAction ?? '',
    group,
    hours: effectiveHours(report),
  };
}

/** The platform's order: the event key ascending, then the plant date; a tie keeps the log order (stable sort). */
function compareEvents(left: ProblemEvent, right: ProblemEvent): number {
  if (left.key !== right.key) return left.key < right.key ? -1 : 1;
  if (left.date !== right.date) return left.date < right.date ? -1 : 1;
  return 0;
}

/** Every production, non-PM breakdown as one event, in the platform's key-then-date order. */
function problemEvents(data: EngineData): ProblemEvent[] {
  const production = new Map(
    data.machines.filter(isProduction).map((machine) => [machine.id, machine.code]),
  );
  const fixes = data.settings?.problemFixes ?? {};
  const groups = groupListOf(data);
  const events: ProblemEvent[] = [];
  for (const row of sourcedReports(data)) {
    const code = production.get(row.report.machineId);
    if (code === undefined || isPm(row)) continue;
    events.push(eventOf(row, problemGroupOf(row.report, fixes, groups), code));
  }
  return events.sort(compareEvents);
}

interface GroupTally {
  count: number;
  hours: number;
  machineIds: string[];
  seen: Set<string>;
  quick: number;
}

/** The groups in the order their first event met them, with the counts and hours accumulated in event order. */
function tallyGroups(events: readonly ProblemEvent[]): Map<string, GroupTally> {
  const tallies = new Map<string, GroupTally>();
  for (const event of events) {
    const tally = tallies.get(event.group) ?? {
      count: 0,
      hours: 0,
      machineIds: [],
      seen: new Set<string>(),
      quick: 0,
    };
    tally.count += 1;
    tally.hours += event.hours;
    if (!tally.seen.has(event.machineId)) {
      tally.seen.add(event.machineId);
      tally.machineIds.push(event.machineId);
    }
    if (event.hours <= QUICK_HOURS) tally.quick += 1;
    tallies.set(event.group, tally);
  }
  return tallies;
}

/** The family each group name belongs to, as the plant's list (or the default) files it. */
const familyIndex = (groups: readonly ProblemGroup[]): Map<string, string> =>
  new Map(groups.map((group) => [group.name, group.family]));

/** The group table's rows, most hours first; the platform's other/unclear entries are in the "Other" family. */
function groupStats(
  events: readonly ProblemEvent[],
  groups: readonly ProblemGroup[],
): ProblemGroupStat[] {
  const families = familyIndex(groups);
  return [...tallyGroups(events)]
    .map(([name, tally]) => ({
      name,
      family: families.get(name) ?? OTHER_FAMILY,
      count: tally.count,
      hours: tally.hours,
      machineIds: tally.machineIds,
      quick: tally.quick,
    }))
    .sort((left, right) => right.hours - left.hours);
}

interface FamilyTally {
  count: number;
  hours: number;
  groups: string[];
  seen: Set<string>;
}

/** The family table's rows, most hours first, each carrying the groups it met in encounter order. */
function familyStats(
  events: readonly ProblemEvent[],
  groups: readonly ProblemGroup[],
): ProblemFamilyStat[] {
  const families = familyIndex(groups);
  const tallies = new Map<string, FamilyTally>();
  for (const event of events) {
    const name = families.get(event.group) ?? OTHER_FAMILY;
    const tally = tallies.get(name) ?? {
      count: 0,
      hours: 0,
      groups: [],
      seen: new Set<string>(),
    };
    tally.count += 1;
    tally.hours += event.hours;
    if (!tally.seen.has(event.group)) {
      tally.seen.add(event.group);
      tally.groups.push(event.group);
    }
    tallies.set(name, tally);
  }
  return [...tallies]
    .map(([name, tally]) => ({
      name,
      count: tally.count,
      hours: tally.hours,
      groups: tally.groups,
    }))
    .sort((left, right) => right.hours - left.hours);
}

/** Each group's events by machine, in encounter order: the pairs the repeat list is built from. */
function occurrencesOf(events: readonly ProblemEvent[]): Map<string, Map<string, ProblemEvent[]>> {
  const byGroup = new Map<string, Map<string, ProblemEvent[]>>();
  for (const event of events) {
    const occurrences = byGroup.get(event.group) ?? new Map<string, ProblemEvent[]>();
    const own = occurrences.get(event.machineId) ?? [];
    own.push(event);
    occurrences.set(event.machineId, own);
    byGroup.set(event.group, occurrences);
  }
  return byGroup;
}

/**
 * The repeat pairs, most hours first: the platform walks its groups in hours order and each group's machines in
 * encounter order, which is why an equal-hours tie keeps that order rather than the log's.
 */
function repeatStats(
  events: readonly ProblemEvent[],
  groups: readonly ProblemGroupStat[],
  machines: readonly MachineRow[],
): ProblemRepeat[] {
  const byGroup = occurrencesOf(events);
  const listed = new Map(machines.map((machine) => [machine.id, machine]));
  const repeats: ProblemRepeat[] = [];
  for (const group of groups) {
    const occurrences = byGroup.get(group.name);
    if (occurrences === undefined) continue;
    for (const [machineId, own] of occurrences) {
      if (own.length < REPEAT_MIN) continue;
      const machine = listed.get(machineId);
      repeats.push({
        machineId,
        machineCode: machine?.code ?? machineId,
        category: machine?.category ?? '',
        group: group.name,
        count: own.length,
        hours: own.reduce((total, event) => total + event.hours, 0),
      });
    }
  }
  return repeats.sort((left, right) => right.hours - left.hours);
}

/** The words one event offers the words table: lowercased, three letters or more, no numbers, no stop words. */
function wordsOf(event: ProblemEvent): string[] {
  return `${event.problem} ${event.correctiveAction}`
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= WORD_MIN && !/^[0-9]+$/.test(word) && !PW_STOP.has(word));
}

/**
 * The words table: what the Other / unclear entries say most often, each counted and totalled once per entry, most
 * entries first and then most hours. The example is the first event, in event order, that used the word.
 */
function wordStats(events: readonly ProblemEvent[]): ProblemWord[] {
  const tallies = new Map<string, { count: number; hours: number; example: string }>();
  for (const event of events) {
    if (event.group !== OTHER_PROBLEM) continue;
    for (const word of new Set(wordsOf(event))) {
      const tally = tallies.get(word) ?? {
        count: 0,
        hours: 0,
        example: normalizeLabel(event.problem),
      };
      tally.count += 1;
      tally.hours += event.hours;
      tallies.set(word, tally);
    }
  }
  return [...tallies]
    .map(([word, tally]) => ({ word, ...tally }))
    .sort((left, right) => right.count - left.count || right.hours - left.hours)
    .slice(0, WORD_LIMIT);
}

/**
 * The A10 analysis: the event list and the four tables' rows. Pure and deterministic — the same plant answers the
 * same at any time; an empty plant answers zeroes, and 41d-2's page decides that it prints nothing.
 */
export function analyzeProblems(data: EngineData): ProblemAnalysis {
  const events = problemEvents(data);
  const groupList = groupListOf(data);
  const groups = groupStats(events, groupList);
  return {
    events,
    groups,
    families: familyStats(events, groupList),
    repeats: repeatStats(events, groups, data.machines),
    words: wordStats(events),
    totalCount: events.length,
    totalHours: events.reduce((total, event) => total + event.hours, 0),
  };
}
