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

const tilesOf = (result: ReturnType<typeof run>): unknown[] =>
  TILES.map((tile) => result.figures.find((figure) => figure.key === tile)?.value);
const tiles = (key: SpanKey): unknown[] => tilesOf(results[key]);

/** The figures that read the run date or the whole history, never the span, whole (value and drill). */
const fixedFigures = (key: SpanKey) =>
  results[key].figures.filter(
    (figure) =>
      figure.key !== 'machine-page' &&
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
    // The machine page is the one as-of figure whose breakdown, PM and drill block follows the span (packet 76o); it
    // is held to hand values per span in `many-years-a10-machine.test.ts`, so the other 26 are compared here.
    expect(fixedFigures('2025')).toEqual(fixedFigures('2026'));
    expect(fixedFigures('both')).toEqual(fixedFigures('2026'));
    expect(fixedFigures('2026')).toHaveLength(26);
  });

  it('marks which figures read the span, the run date and the whole history, by key', () => {
    const marked = (reads: 'asOf' | 'history' | undefined) =>
      FIGURES.filter((def) => def.reads === reads)
        .map((def) => def.key)
        .sort();
    expect({ span: marked(undefined), asOf: marked('asOf'), history: marked('history') }).toEqual({
      span: [
        'a1-bd-pm',
        'a10-problems',
        'a2-category-cell',
        'a3-mttr-mtbf',
        'a4-manpower',
        'a6-why-why',
        'a8-age',
        'breakdown-log',
        'dashboard.avg-bd-hours-per-day',
        'dashboard.avg-bd-hours-per-machine',
        'dashboard.avg-complaints-per-day',
        'dashboard.bubble-chart',
        'dashboard.costliest-problems',
        'dashboard.fleet-availability',
        'dashboard.no-downtime-hours',
        'dashboard.plant-bd-pct',
        'dashboard.plant-events',
        'dashboard.pm-hours',
        'dashboard.total-breakdowns',
        'dashboard.total-downtime-hours',
        'pm-compliance',
        'reliability',
        'shift-kpis.breakdown-map',
        'shift-kpis.compare',
        'shift-kpis.shift-split',
      ],
      asOf: [
        'a5-energy',
        'a7-footprint',
        'action-center',
        'action-center.spares-spend',
        'annual-report',
        'cell-change-log',
        'dashboard.breakdown-free',
        'dashboard.cnc-machines',
        'dashboard.conventional-machines',
        'dashboard.dg-sets',
        'dashboard.expansion-timeline',
        'dashboard.process-machines',
        'dashboard.total-machines',
        'dashboard.utilities',
        'machine-page',
        'monthly-report',
        'registers',
        'shift-kpis.backlog',
      ],
      history: [
        'a9-bottleneck-forecast',
        'compare',
        'compare.spares-cost',
        'data-checklist',
        'fix-finder',
        'forecast-lab',
        'money-matters',
        'team-focus',
        'team-focus.cost',
      ],
    });
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

  it('does not count the years before the first record as available hours', () => {
    const early = run(MANY_YEARS, AS_OF_ENGINE, DEFAULT_PROFILE, {
      from: '2020-01-01',
      to: '2025-12-31',
    });
    expect({ period: early.period, tiles: tilesOf(early) }).toEqual({
      period: { ...results['2025'].period, requestedFrom: '2020-01-01' },
      tiles: tiles('2025'),
    });
    expect(results['2025'].period).not.toHaveProperty('requestedFrom');
  });

  it('refuses a date the calendar does not have', () => {
    for (const span of [
      { from: '2026-02-30', to: '2026-03-31' },
      { from: '2026-01-01', to: '2026-13-01' },
    ]) {
      expect(() => only(AS_OF_ENGINE, span)).toThrow(RangeError);
    }
    expect(() => only('2027-02-29', named('2025'))).toThrow(RangeError);
  });
});
