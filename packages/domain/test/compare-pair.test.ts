import { DEFAULT_PROFILE } from '@uptimo/shared';
import { describe, expect, it } from 'vitest';
import { machineAge } from '../src/analytics/machine-facts.js';
import { pairYear } from '../src/analytics/compare-year.js';
import type { SourcedReport } from '../src/analytics/rows.js';
import { comparePair, type ComparePairResult } from '../src/index.js';
import { ENGINE_DATA, read, type FigureKey } from './answer-key/fixture.js';

/**
 * Ticket 584 (ADR 0021 §1–2): Compare any two machines of one category, and each machine's year so far. The frozen
 * 11 November plant: the engine's own pair is VC-28 and VC-22 of the Vertical Machining Center category (52 machines).
 */

const AS_OF = '2026-11-11';
const INPUT = { data: ENGINE_DATA, asOf: AS_OF, profile: DEFAULT_PROFILE };
const COMPARE = read<FigureKey>('compare.json');

type Table = { title: string; header: string[]; rows: string[][] };
const tablesOf = (value: unknown): Table[] =>
  (value as { pages: { tables: Table[] }[] }).pages[0]!.tables;
const tableOf = (value: unknown, title: string): Table =>
  tablesOf(value).find((table) => table.title === title)!;

function pageOf(result: ComparePairResult) {
  if (result.kind !== 'page') throw new Error(`expected a page, got ${result.kind}`);
  return result;
}

const idOf = (code: string): string => ENGINE_DATA.machines.find((m) => m.code === code)!.id;

describe('comparePair', () => {
  it('with no pair is the engine’s own pair and exactly the frozen page', () => {
    const result = pageOf(comparePair(INPUT));
    expect(result.value).toEqual(COMPARE);
    expect(result.pair).toEqual({ a: 'VC-28', b: 'VC-22' });
    expect(result.drillIds).toEqual([idOf('VC-28'), idOf('VC-22')]);
    expect(result.options.slice(0, 2)).toEqual(['VC-28', 'VC-22']);
    expect(result.options).toHaveLength(52);
    expect(new Set(result.options).size).toBe(52);
  });

  it('prints a chosen pair with machine A first in every table, drill and year', () => {
    const result = pageOf(comparePair(INPUT, { a: 'VC-18', b: 'VC-28' }));
    expect(result.pair).toEqual({ a: 'VC-18', b: 'VC-28' });
    expect(tablesOf(result.value).map((table) => table.title)).toEqual([
      'Health scorecard (0–10, adjusted for age)',
      'Health checkup',
      'Specifications',
      'VC-18 — longest breakdowns',
      'VC-28 — longest breakdowns',
      'By shift',
    ]);
    expect(tableOf(result.value, 'Health checkup').header).toEqual([
      'Parameter',
      'VC-18',
      'VC-28',
      'Category average',
    ]);
    expect(result.drillIds).toEqual([idOf('VC-18'), idOf('VC-28')]);
    expect(result.years.map((year) => year.code)).toEqual(['VC-18', 'VC-28']);
    expect(result.options).toContain('VC-18');
  });

  it('the engine’s pair asked the other way round swaps the two columns and nothing else', () => {
    const engine = tableOf(COMPARE, 'Health checkup');
    const swapped = tableOf(
      pageOf(comparePair(INPUT, { a: 'VC-22', b: 'VC-28' })).value,
      'Health checkup',
    );
    expect(swapped.rows).toEqual(engine.rows.map((row) => [row[0], row[2], row[1], row[3]]));
  });

  it('names the field to correct when the pair cannot be compared', () => {
    expect(comparePair(INPUT, { a: 'NOT-A-MACHINE', b: 'VC-28' })).toEqual({
      kind: 'unknown',
      field: 'a',
    });
    expect(comparePair(INPUT, { a: 'VC-28', b: 'NOT-A-MACHINE' })).toEqual({
      kind: 'unknown',
      field: 'b',
    });
    expect(comparePair(INPUT, { a: 'VC-28', b: 'VC-28' })).toEqual({
      kind: 'unknown',
      field: 'b',
    });
  });
});

describe('pairYear', () => {
  const machine = ENGINE_DATA.machines.find((m) => m.code === 'VC-28')!;
  const row = (date: string, hours: number, maintCode: string | null = 'ATC'): SourcedReport =>
    ({
      report: {
        machineId: machine.id,
        date,
        maintCode,
        downtimeMin: hours * 60,
        recordedHours: null,
      },
      ticket: { source: 'history' },
    }) as unknown as SourcedReport;

  it('adds up 1 January to asOf, by code, by week, and the same window a year earlier', () => {
    const rows = [
      row('2026-11-11', 2),
      row('2026-11-05', 1),
      row('2026-11-04', 0.5, 'LIK'),
      row('2026-01-01', 4, null),
      row('2026-03-03', 5, 'PM'),
      row('2026-11-12', 9),
      row('2025-12-31', 3),
      row('2025-06-01', 1.5),
    ];
    const year = pairYear(machine, rows, AS_OF, 20);
    expect(year).toEqual({
      machineId: machine.id,
      code: 'VC-28',
      category: machine.category,
      cell: machine.cell,
      age: machineAge(machine, AS_OF),
      count: 4,
      hours: 7.5,
      plannedHours: 315 * 20,
      causes: [
        { code: '—', count: 1, hours: 4 },
        { code: 'ATC', count: 2, hours: 3 },
        { code: 'LIK', count: 1, hours: 0.5 },
      ],
      weekly: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.5, 3],
      last: { count: 1, hours: 1.5 },
    });
  });
});
