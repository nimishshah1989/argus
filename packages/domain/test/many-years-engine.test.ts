import { DEFAULT_PROFILE } from '@uptimo/shared';
import { describe, expect, it } from 'vitest';
import { FIGURES, run, runWith, type Computer, type EngineData } from '../src/index.js';
import { MANY_YEARS } from './many-years/fixture.js';
import { AS_OF_ENGINE, HAND, SPAN_KEYS, type SpanKey } from './many-years/hand.js';

/**
 * `run` takes a span (ticket 76, packet 76d), read over the two-year plant and held whole against `many-years/hand.ts`.
 * The four additive tiles are the dashboard's breakdown count, its downtime, PM and no-downtime hours. The no-downtime
 * hours are not in `hand.ts`: each `NO DT` row is 30 minutes, once a machine in January (2025: 3 machines, 2026: 4).
 */

const TILES = [
  'dashboard.total-breakdowns',
  'dashboard.total-downtime-hours',
  'dashboard.pm-hours',
  'dashboard.no-downtime-hours',
] as const;

/** `NO DT` hours: 3 × 0.5 = 1.5 in 2025, 4 × 0.5 = 2 in 2026, 1.5 + 2 = 3.5 across both. */
const NO_DOWNTIME_HOURS: Readonly<Record<SpanKey, number>> = { '2025': 1.5, '2026': 2, both: 3.5 };

/** A run that computes no figure, to read the period alone: at these dates `breakdown-free` has no rows (PR #413). */
const only = (asOf: string, span: { from: string; to: string }) =>
  runWith({}, { data: MANY_YEARS, asOf, profile: DEFAULT_PROFILE, span });

const named = (key: SpanKey) => ({ from: HAND[key].from, to: HAND[key].to });
const results = Object.fromEntries(
  SPAN_KEYS.map((key) => [key, run(MANY_YEARS, AS_OF_ENGINE, DEFAULT_PROFILE, named(key))]),
) as Record<SpanKey, ReturnType<typeof run>>;

const tiles = (key: SpanKey): unknown[] =>
  TILES.map((tile) => results[key].figures.find((figure) => figure.key === tile)?.value);

/** The figures that read the run date or the whole history, never the span, whole (value and drill). */
const fixedFigures = (key: SpanKey) =>
  results[key].figures.filter((figure) =>
    FIGURES.some((def) => def.key === figure.key && def.reads !== undefined),
  );

describe('run with a span', () => {
  it('gives each span its own four additive tiles, and 2025 + 2026 is both', () => {
    const hand = (key: SpanKey): unknown[] => [
      HAND[key].failures,
      HAND[key].breakdownHours,
      HAND[key].pmHours,
      NO_DOWNTIME_HOURS[key],
    ];
    expect(SPAN_KEYS.map(tiles)).toEqual(SPAN_KEYS.map(hand));
    const sum = (tiles('2025') as number[]).map(
      (value, index) => value + (tiles('2026')[index] as number),
    );
    expect(sum).toEqual(tiles('both'));
  });

  it('leaves the as-of and history figures identical across spans', () => {
    expect(fixedFigures('2025')).toEqual(fixedFigures('2026'));
    expect(fixedFigures('both')).toEqual(fixedFigures('2026'));
    expect(fixedFigures('2026')).toHaveLength(27);
  });

  it('marks 24 figures as reading the span, 18 the run date and 9 the whole history', () => {
    const count = (reads: 'asOf' | 'history' | undefined) =>
      FIGURES.filter((def) => def.reads === reads).length;
    expect([count(undefined), count('asOf'), count('history')]).toEqual([24, 18, 9]);
  });

  it('hands a period figure the span cut at its end, and a history figure the whole plant', () => {
    const seen: Record<string, { data: EngineData; asOf: string }> = {};
    const spy =
      (key: string): Computer =>
      ({ data, asOf }) => {
        seen[key] = { data, asOf };
        return { value: 0, drillIds: [] };
      };
    runWith(
      {
        'dashboard.total-breakdowns': spy('period'),
        'dashboard.total-machines': spy('asOf'),
        'fix-finder': spy('history'),
      },
      { data: MANY_YEARS, asOf: AS_OF_ENGINE, profile: DEFAULT_PROFILE, span: named('2025') },
    );
    const gaps = ['2025-07', '2027-01'];
    const period = { ...named('2025'), noRecords: ['2025-07'] };
    expect({
      period: [seen.period!.asOf, seen.period!.data.period, seen.period!.data.gaps],
      reports: seen.period!.data.reports.map((report) => report.date.slice(0, 4)),
      machines: seen.period!.data.machines.map((machine) => machine.id),
      tickets: seen.period!.data.tickets.length,
      asOf: [seen.asOf!.asOf, seen.asOf!.data.period, seen.asOf!.data.gaps],
      history: [seen.history!.asOf, seen.history!.data.reports.length, seen.history!.data.gaps],
    }).toEqual({
      period: ['2025-12-31', period, gaps],
      reports: Array(HAND['2025'].failures + 12).fill('2025'),
      machines: ['TC-1', 'VC-1', 'TC-2'],
      tickets: MANY_YEARS.tickets.length,
      asOf: [AS_OF_ENGINE, period, gaps],
      history: [AS_OF_ENGINE, MANY_YEARS.reports.length, gaps],
    });
  });

  it('names the resolved span on the result only when a span was named', () => {
    const plain = run(MANY_YEARS, AS_OF_ENGINE, DEFAULT_PROFILE);
    expect(Object.keys(plain)).not.toContain('period');
    expect(results.both.period).toEqual({ ...named('both'), noRecords: ['2025-07'] });
  });

  it('reads no gap month when no span is named', () => {
    const seen: EngineData[] = [];
    const take: Computer = ({ data }) => {
      seen.push(data);
      return { value: 0, drillIds: [] };
    };
    runWith(
      { 'dashboard.total-breakdowns': take, 'fix-finder': take },
      { data: MANY_YEARS, asOf: AS_OF_ENGINE, profile: DEFAULT_PROFILE },
    );
    expect(seen.map((data) => [data.period, data.gaps])).toEqual([
      [undefined, undefined],
      [undefined, undefined],
    ]);
  });

  it('counts the as-of month as a gap only once it is over', () => {
    const spanOfJanuary = (asOf: string) => only(asOf, { from: '2027-01-01', to: asOf }).period;
    expect([
      spanOfJanuary('2027-01-01'),
      spanOfJanuary('2027-01-15'),
      spanOfJanuary('2027-01-31'),
    ]).toEqual([
      { from: '2027-01-01', to: '2027-01-01', noRecords: [] },
      { from: '2027-01-01', to: '2027-01-15', noRecords: [] },
      { from: '2027-01-01', to: '2027-01-31', noRecords: ['2027-01'] },
    ]);
  });

  it('never reads past the run date, and refuses a span that starts after it', () => {
    expect(only('2026-11-11', named('2026')).period).toEqual({
      from: '2026-01-01',
      to: '2026-11-11',
      noRecords: [],
    });
    expect(() => only('2026-11-11', { from: '2027-01-01', to: '2027-12-31' })).toThrow(RangeError);
    expect(() => only(AS_OF_ENGINE, { from: '2026-12-31', to: '2026-01-01' })).toThrow(RangeError);
  });
});
