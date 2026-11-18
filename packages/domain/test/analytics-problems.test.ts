import { DEFAULT_PROFILE } from '@uptimo/shared';
import { describe, expect, it } from 'vitest';
import { COMPUTERS, runWith, type EngineData, type FigureResult } from '../src/index.js';
import { formatNumber, formatPercent } from '../src/analytics/format.js';
import { isProduction } from '../src/analytics/machine-facts.js';
import { analyzeProblems, type ProblemAnalysis } from '../src/analytics/problem-analysis.js';
import { OTHER_PROBLEM, PROBLEM_GROUPS } from '../src/analytics/problem-groups.js';
import { problemTraining } from '../src/analytics/problem-suggest.js';
import { effectiveHours, isPm, sourcedReports } from '../src/analytics/rows.js';
import { A10, ENGINE_DATA, type FigureKey, type KeyTable } from './answer-key/fixture.js';

/**
 * The A10 problem analysis core (packet 41d-1): the platform's event list and its four aggregations against the
 * frozen 11 November key — the 24 groups, the nine families with the order of the groups they met, the 15 printed
 * repeat pairs and the 14 words. The key is the authority; N and the total hours are derived from the workbook, so a
 * hard-coded page cannot pass. Table 3 (the unplaced entries) and table 5 (the editor) belong to 41d-2's page.
 */

/** The key's one page; the analysis has no page of its own yet (41d-2 registers it). */
const PAGE = A10.pages[0];
if (PAGE === undefined) throw new Error('the A10 key holds no page');

/** The key's table by position. Its title is 41d-2's; positions 0, 1, 2 and 4 are the analysis' own rows. */
function table(position: number): KeyTable {
  const found = PAGE?.tables[position];
  if (found === undefined) throw new Error(`the A10 key holds no table ${position}`);
  return found;
}

/** The production fleet the analysis reads: CNC machines the plant counts in production data. */
const PRODUCTION = new Set(ENGINE_DATA.machines.filter(isProduction).map((machine) => machine.id));

/** The rows behind the page, from the workbook: N and the recorded-hours total are derived, never literal. */
const ROWS = sourcedReports(ENGINE_DATA).filter(
  (row) => PRODUCTION.has(row.report.machineId) && !isPm(row),
);
const N = ROWS.length;
const TOTAL_HOURS = ROWS.reduce((total, row) => total + effectiveHours(row.report), 0);

const ANALYSIS = analyzeProblems(ENGINE_DATA);

/** One group row as the platform prints it: name, family, count, three shares, hours, hours each, machines. */
function groupRow(analysis: ProblemAnalysis, index: number): string[] {
  const group = analysis.groups[index]!;
  return [
    group.name,
    group.family,
    String(group.count),
    formatPercent(group.count / analysis.totalCount),
    formatNumber(group.hours, 1),
    formatPercent(group.hours / analysis.totalHours),
    formatNumber(group.hours / group.count, 2),
    String(group.machineIds.length),
    formatPercent(group.quick / group.count),
  ];
}

/** One family row: name, count, two shares, hours, and the groups inside in their encounter order. */
function familyRow(analysis: ProblemAnalysis, index: number): string[] {
  const family = analysis.families[index]!;
  return [
    family.name,
    String(family.count),
    formatPercent(family.count / analysis.totalCount),
    formatNumber(family.hours, 1),
    formatPercent(family.hours / analysis.totalHours),
    family.groups.join('; '),
  ];
}

/** One printed repeat row: machine code, category, group, times and hours. */
function repeatRow(analysis: ProblemAnalysis, index: number): string[] {
  const repeat = analysis.repeats[index]!;
  return [
    repeat.machineCode,
    repeat.category,
    repeat.group,
    String(repeat.count),
    formatNumber(repeat.hours, 1),
  ];
}

/** One word row's four analysis cells; the fifth (the add-to-group select) is 41d-2's page. */
function wordRow(analysis: ProblemAnalysis, index: number): string[] {
  const word = analysis.words[index]!;
  return [word.word, String(word.count), formatNumber(word.hours, 1), word.example];
}

describe('the A10 problem analysis', () => {
  it("groups every breakdown into the key's 24 groups, over N and hours derived from the workbook", () => {
    // Red first: the analysis module did not exist, so this file failed to load.
    expect(ANALYSIS.totalCount).toBe(N);
    expect(ANALYSIS.totalHours).toBeCloseTo(TOTAL_HOURS, 9);
    expect(ANALYSIS.groups.map((_, index) => groupRow(ANALYSIS, index))).toEqual(table(0).rows);
    expect(ANALYSIS.groups).toHaveLength(table(0).rows.length);
    // Hours decide the order: the group that costs the most time comes first.
    const hours = ANALYSIS.groups.map((group) => group.hours);
    expect(hours).toEqual([...hours].sort((left, right) => right - left));
  });

  it("rolls the groups into the key's nine families, in the order the groups were met", () => {
    expect(ANALYSIS.families.map((_, index) => familyRow(ANALYSIS, index))).toEqual(table(1).rows);
    expect(ANALYSIS.families).toHaveLength(table(1).rows.length);
    const hours = ANALYSIS.families.map((family) => family.hours);
    expect(hours).toEqual([...hours].sort((left, right) => right - left));
  });

  it('lists the machine-and-group repeats of four or more entries, the largest hours first', () => {
    expect(ANALYSIS.repeats.length).toBeGreaterThan(table(2).rows.length);
    const printed = ANALYSIS.repeats
      .slice(0, table(2).rows.length)
      .map((_, index) => repeatRow(ANALYSIS, index));
    expect(printed).toEqual(table(2).rows);
    // The 74 pairs are derived from the events: a pair counts when the same machine met the same group 4+ times.
    const pairs = new Map<string, number>();
    for (const event of ANALYSIS.events) {
      const key = `${event.machineId}|${event.group}`;
      pairs.set(key, (pairs.get(key) ?? 0) + 1);
    }
    expect(ANALYSIS.repeats).toHaveLength([...pairs.values()].filter((count) => count >= 4).length);
    expect(ANALYSIS.repeats.every((repeat) => repeat.count >= 4)).toBe(true);
    const hours = ANALYSIS.repeats.map((repeat) => repeat.hours);
    expect(hours).toEqual([...hours].sort((left, right) => right - left));
  });

  it("lists the 14 words the Other / unclear entries share, with the key's example problems", () => {
    expect(ANALYSIS.words.map((_, index) => wordRow(ANALYSIS, index))).toEqual(
      table(4).rows.map((row) => row.slice(0, 4)),
    );
    expect(ANALYSIS.words).toHaveLength(14);
    expect(table(4).rows).toHaveLength(14);
  });

  it('counts one event per breakdown, sorted by key then date with merging off', () => {
    expect(ANALYSIS.events).toHaveLength(N);
    expect(new Set(ANALYSIS.events.map((event) => event.ticketId)).size).toBe(N);
    for (let index = 1; index < ANALYSIS.events.length; index += 1) {
      const previous = ANALYSIS.events[index - 1]!;
      const current = ANALYSIS.events[index]!;
      const ordered =
        previous.key < current.key ||
        (previous.key === current.key && previous.date <= current.date);
      expect(
        ordered,
        `${previous.key} ${previous.date} before ${current.key} ${current.date}`,
      ).toBe(true);
    }
    // 1,279 events share 1,059 keys: two entries with one key stay two events, because merging is off.
    const keys = ANALYSIS.events.map((event) => event.key);
    expect(new Set(keys).size).toBeLessThan(keys.length);
  });

  it('lets a manual fix win over the keywords: the three plant fixes place three unmatched entries', () => {
    const fixed = ENGINE_DATA.settings?.problemFixes ?? {};
    const fixes = Object.entries(fixed);
    expect(fixes).toHaveLength(3);
    const without = analyzeProblems({
      ...ENGINE_DATA,
      settings: { ...ENGINE_DATA.settings!, problemFixes: {} },
    });
    const count = (analysis: ProblemAnalysis, name: string): number =>
      analysis.groups.find((group) => group.name === name)?.count ?? 0;
    expect(count(without, OTHER_PROBLEM)).toBe(count(ANALYSIS, OTHER_PROBLEM) + fixes.length);
    for (const [, name] of fixes) {
      expect(count(without, name)).toBe(count(ANALYSIS, name) - 1);
    }
  });

  it("reads the plant's edited group list, where a fix naming a removed group no longer applies", () => {
    const fixes = Object.entries(ENGINE_DATA.settings?.problemFixes ?? {});
    const [reportId, removed] = fixes[0]!;
    const edited = analyzeProblems({
      ...ENGINE_DATA,
      settings: {
        ...ENGINE_DATA.settings!,
        problemGroups: PROBLEM_GROUPS.filter((group) => group.name !== removed),
      },
    });
    expect(edited.groups.some((group) => group.name === removed)).toBe(false);
    expect(edited.events.find((event) => event.reportId === reportId)?.group).toBe(OTHER_PROBLEM);
  });
});

const AS_OF = '2026-11-11';

/** The registered A10 figure through the engine: the same path every screen and the CLI read. */
function compute(data: EngineData = ENGINE_DATA): FigureResult {
  const result = runWith(COMPUTERS, { data, asOf: AS_OF, profile: DEFAULT_PROFILE });
  const found = result.figures.find((candidate) => candidate.key === 'a10-problems');
  if (!found) throw new Error('the engine knows no figure a10-problems');
  return found;
}

/** The page's value, typed as the key is; a null value is a test bug, so it throws. */
function pageValue(data: EngineData = ENGINE_DATA): FigureKey {
  const value = compute(data).value;
  if (value === null) throw new Error('the A10 figure printed no page');
  return value as unknown as FigureKey;
}

/** The unplaced card's table by title prefix: its title carries the count, which the mutation moves. */
function unplacedTable(value: FigureKey): KeyTable {
  const found = value.pages[0]?.tables.find((candidate) =>
    candidate.title.startsWith('Entries the system could not place'),
  );
  if (found === undefined) throw new Error('the A10 page holds no unplaced card');
  return found;
}

/** The three plant fixes of this key: the manual placements the classifier must not need for itself. */
const FIXES = Object.entries(ENGINE_DATA.settings?.problemFixes ?? {});

/** The events the keyword rules place, derived: the classifier's training examples (1,248 on this key). */
const PLACED = ANALYSIS.events.filter((event) => event.group !== OTHER_PROBLEM).length;

describe('the A10 problem analysis page', () => {
  it("equals the key's whole page: the eight KPIs, six tables and two charts", () => {
    const computed = compute();
    // Red first: the page computer had not landed, so the engine answered not_computed.
    expect(computed.status).toBe('ready');
    expect(computed.value).toEqual(A10);
    // The key's own shape, restated so a page that shrinks silently cannot pass: 8 KPIs, 6 tables, 2 charts.
    const page = pageValue().pages[0];
    expect(page?.kpis).toHaveLength(8);
    expect(page?.tables).toHaveLength(6);
    expect(page?.charts).toHaveLength(2);
  });

  it('drills the production breakdown tickets it read, derived from the workbook', () => {
    const computed = compute();
    const known = new Set(
      [...ENGINE_DATA.tickets, ...ENGINE_DATA.tasks].map((ticket) => ticket.id),
    );
    expect(ROWS.length).toBeGreaterThan(0);
    expect(computed.drill.type).toBe('ticket');
    expect(computed.drill.ids).toHaveLength(ROWS.length);
    expect(computed.drill.ids).toEqual([...new Set(ROWS.map((row) => row.ticket.id))].sort());
    expect(computed.drill.ids.every((id) => known.has(id))).toBe(true);
  });

  it('teaches the classifier from the placed events and cross-validates at the key 76%', () => {
    const training = problemTraining(ENGINE_DATA);
    // The training labels are the events the keyword rules or a manual fix placed: 1,248 on this key.
    expect(training.trainedOn).toBe(PLACED);
    expect(training.model).not.toBeNull();
    if (training.accuracy === null) throw new Error('the classifier cross-validated nothing');
    // The platform's 5-fold accuracy, the number its card description prints: 76%.
    expect(Math.round(training.accuracy * 100)).toBe(76);
  });

  it('drops the manual fixes from classification: the unplaced card grows and the page moves', () => {
    expect(FIXES).toHaveLength(3);
    const before = pageValue();
    const mutated = pageValue({
      ...ENGINE_DATA,
      settings: { ...ENGINE_DATA.settings!, problemFixes: {} },
    });
    // The proof: without the fix path those three entries fall back to Other / unclear, so the key page cannot
    // survive. The mutation changes the data (the plant's settings), never the key.
    expect(mutated).not.toEqual(A10);
    expect(before).toEqual(A10);
    const grown = unplacedTable(mutated);
    expect(grown.rows).toHaveLength(unplacedTable(before).rows.length + FIXES.length);
    expect(grown.title).not.toBe(unplacedTable(before).title);
    // Each group the plant had fixed by hand now counts one fewer entry, and Other / unclear carries them all.
    const count = (value: FigureKey, name: string): number => {
      const row = value.pages[0]?.tables[0]?.rows.find((cells) => cells[0] === name);
      return row === undefined ? 0 : Number(row[2]);
    };
    for (const [, name] of FIXES) expect(count(mutated, name)).toBe(count(before, name) - 1);
    expect(count(mutated, OTHER_PROBLEM)).toBe(count(before, OTHER_PROBLEM) + FIXES.length);
  });
});
