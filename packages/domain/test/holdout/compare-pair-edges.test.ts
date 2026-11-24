import { DEFAULT_PROFILE } from '@uptimo/shared';
import { describe, expect, it } from 'vitest';
import { compareMachines, historyRows } from '../../src/analytics/compare-score.js';
import { pairYear } from '../../src/analytics/compare-year.js';
import { effectiveHours, isPm, type SourcedReport } from '../../src/analytics/rows.js';
import { comparePair, type ComparePairResult, type EngineData } from '../../src/index.js';
import { ENGINE_DATA } from '../answer-key/fixture.js';

/** Ticket 584, hidden: the edges a pair and a year so far must get right. */

const AS_OF = '2026-11-11';
const INPUT = { data: ENGINE_DATA, asOf: AS_OF, profile: DEFAULT_PROFILE };
const PER_DAY = (DEFAULT_PROFILE.prodHrsPerDay * DEFAULT_PROFILE.workDaysPerYear) / 365;

function pageOf(result: ComparePairResult) {
  if (result.kind !== 'page') throw new Error(`expected a page, got ${result.kind}`);
  return result;
}

describe('comparePair, hidden edges', () => {
  it('refuses machine B of another category, and names a first when both are wrong', () => {
    expect(comparePair(INPUT, { a: 'VC-28', b: 'TC-3' })).toEqual({ kind: 'unknown', field: 'b' });
    expect(comparePair(INPUT, { a: 'NOPE', b: 'ALSO-NOPE' })).toEqual({
      kind: 'unknown',
      field: 'a',
    });
  });

  it('refuses a machine outside the compare list (not CNC)', () => {
    expect(comparePair(INPUT, { a: 'BS-01', b: 'BS-02' })).toEqual({ kind: 'unknown', field: 'a' });
  });

  it('a pair of another category offers that category, A first in its own column', () => {
    const result = pageOf(comparePair(INPUT, { a: 'TC-5', b: 'TC-3' }));
    const turning = compareMachines(ENGINE_DATA).filter((m) => m.category === 'Turning Center');
    expect(new Set(result.options)).toEqual(new Set(turning.map((m) => m.code)));
    expect(result.options).toHaveLength(38);
    const tables = (result.value as { pages: { tables: { title: string; header: string[] }[] }[] })
      .pages[0]!.tables;
    expect(tables.find((t) => t.title === 'By shift')!.header[1]).toBe('TC-5 breakdowns');
  });

  it('an empty plant has no comparison', () => {
    const empty: EngineData = { ...ENGINE_DATA, machines: [], reports: [], tickets: [], tasks: [] };
    expect(comparePair({ ...INPUT, data: empty })).toEqual({ kind: 'none' });
    expect(comparePair({ ...INPUT, data: empty }, { a: 'VC-28', b: 'VC-22' })).toEqual({
      kind: 'none',
    });
  });

  it('each year is the machine’s own history rows, PM left out, at compareFigure’s planned hours a day', () => {
    const result = pageOf(comparePair(INPUT));
    const machine = ENGINE_DATA.machines.find((m) => m.code === result.pair.a)!;
    const mine = historyRows(ENGINE_DATA).filter(
      (row) =>
        row.report.machineId === machine.id &&
        !isPm(row) &&
        row.report.date >= '2026-01-01' &&
        row.report.date <= AS_OF,
    );
    const [a] = result.years;
    expect(a.count).toBe(mine.length);
    expect(a.hours).toBeCloseTo(
      mine.reduce((sum, row) => sum + effectiveHours(row.report), 0),
      9,
    );
    expect(a.plannedHours).toBeCloseTo(315 * PER_DAY, 9);
    expect(a.weekly).toHaveLength(12);
  });
});

describe('pairYear, hidden edges', () => {
  const machine = ENGINE_DATA.machines.find((m) => m.code === 'VC-22')!;
  const row = (
    date: string,
    minutes: number,
    maintCode: string | null = 'ATC',
    recordedHours: number | null = null,
  ): SourcedReport =>
    ({
      report: { machineId: machine.id, date, maintCode, downtimeMin: minutes, recordedHours },
      ticket: { source: 'history' },
    }) as unknown as SourcedReport;

  it('a NO DT entry is a breakdown with no hours; recorded hours win over minutes', () => {
    const year = pairYear(
      machine,
      [row('2026-05-01', 120, 'NO DT'), row('2026-05-02', 60, 'ATC', 2.5)],
      AS_OF,
      10,
    );
    expect(year.count).toBe(2);
    expect(year.hours).toBe(2.5);
    expect(year.causes).toEqual([
      { code: 'ATC', count: 1, hours: 2.5 },
      { code: 'NO DT', count: 1, hours: 0 },
    ]);
  });

  it('weeks are the 7 days ending asOf, back 84 days, across 1 January', () => {
    const asOf = '2026-01-05';
    const year = pairYear(
      machine,
      [
        row('2025-12-30', 60),
        row('2025-12-29', 120),
        row('2025-10-14', 180),
        row('2025-10-13', 600),
      ],
      asOf,
      10,
    );
    expect(year.weekly).toEqual([3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 1]);
    expect(year.count).toBe(0);
    expect(year.hours).toBe(0);
    expect(year.plannedHours).toBe(50);
    expect(year.causes).toEqual([]);
  });

  it('29 February looks back to 28 February of the year before', () => {
    const year = pairYear(
      machine,
      [row('2023-02-28', 60), row('2023-03-01', 60), row('2022-12-31', 60)],
      '2024-02-29',
      10,
    );
    expect(year.last).toEqual({ count: 1, hours: 1 });
    expect(year.plannedHours).toBe(60 * 10);
  });

  it('orders causes by hours, then breakdowns, then code; a blank code is none', () => {
    const year = pairYear(
      machine,
      [
        row('2026-02-01', 60, 'ZED'),
        row('2026-02-02', 30, 'ABC'),
        row('2026-02-03', 30, 'ABC'),
        row('2026-02-04', 60, 'MID'),
        row('2026-02-05', 30, '  '),
      ],
      AS_OF,
      10,
    );
    expect(year.causes.map((cause) => cause.code)).toEqual(['ABC', 'MID', 'ZED', '—']);
  });
});
