import { describe, expect, it } from 'vitest';
import { en } from '@uptimo/shared/i18n';
import { TREND_WORDS, drillLinkOf, reliabilityOf } from './reliability-values.js';

/**
 * The machine page's reliability block (ticket 67, packet 67c) reads the stored `reliability` figure: one
 * `MachineReliability` per machine, exactly as packet 67b keeps it in `kpi_snapshot`. The reader is total — a
 * block with a number missing returns nothing rather than a zero — and the drill link is the house link below
 * the 200-id cap, the Breakdown log above it.
 */

const FULL_ID = '10000000-0000-4000-8000-0000000000f1';
const PARTIAL_ID = '10000000-0000-4000-8000-0000000000f2';

/** A stored `ReliabilityValue`, in the shape the engine writes and the run keeps. */
const VALUE = {
  asOf: '2026-11-11',
  windowStart: '2026-01-01',
  minimumEvents: 5,
  machines: {
    [FULL_ID]: {
      fit: {
        status: 'fitted',
        basis: 'machine',
        category: 'Horizontal Machining Center',
        ownEvents: 43,
        shape: 0.879204344,
        scale: 107.012214493,
        meanHours: 114.085658462,
        events: 43,
        completeIntervals: 42,
        censoredHours: 70,
        quartiles: { q25: 18.75, median: 51.370967742, q75: 135.483870968 },
        trend: { beta: 1.73491878, n: 43, label: 'worsening' },
      },
      spares: {
        rows: [
          {
            name: 'Rectifier O/P 440V AC and I/P 190V DC',
            uses: 1,
            downtimeHours: 4,
            lastOn: '2026-09-16',
          },
          {
            name: 'Rectifier 440 O/P and I/P 190 VDC',
            uses: 1,
            downtimeHours: 3,
            lastOn: '2026-07-18',
          },
          { name: 'Break Rectifier 2 amp', uses: 1, downtimeHours: 0, lastOn: '2026-10-03' },
          { name: 'Brake hub', uses: 1, downtimeHours: 0, lastOn: '2026-10-03' },
        ],
        total: 4,
      },
      drill: {
        fit: ['10000000-0000-4000-8000-0000000000a1', '10000000-0000-4000-8000-0000000000a2'],
        spares: ['10000000-0000-4000-8000-0000000000a3'],
      },
    },
    [PARTIAL_ID]: {
      fit: {
        status: 'insufficient',
        ownEvents: 4,
        category: 'Turning Center',
        categoryEvents: 3,
        minimum: 5,
      },
      spares: { rows: [], total: 0 },
      drill: { fit: [], spares: [] },
    },
  },
  categories: {},
};

describe('the stored reliability block', () => {
  it('reads one machine’s own fit, its sample and its two checks', () => {
    const view = reliabilityOf(VALUE, FULL_ID);
    expect(view?.fit).toEqual({
      status: 'fitted',
      basis: 'machine',
      category: 'Horizontal Machining Center',
      ownEvents: 43,
      shape: 0.879204344,
      scale: 107.012214493,
      meanHours: 114.085658462,
      events: 43,
      completeIntervals: 42,
      censoredHours: 70,
      quartiles: { q25: 18.75, median: 51.370967742, q75: 135.483870968 },
      trend: { beta: 1.73491878, n: 43, word: 'worsening' },
    });
  });

  it('reads the machine’s four parts, their uses, hours and last day, and both drills', () => {
    const view = reliabilityOf(VALUE, FULL_ID);
    expect(view?.spares.total).toBe(4);
    expect(
      view?.spares.rows.map((row) => [row.name, row.uses, row.downtimeHours, row.lastOn]),
    ).toEqual([
      ['Rectifier O/P 440V AC and I/P 190V DC', 1, 4, '2026-09-16'],
      ['Rectifier 440 O/P and I/P 190 VDC', 1, 3, '2026-07-18'],
      ['Break Rectifier 2 amp', 1, 0, '2026-10-03'],
      ['Brake hub', 1, 0, '2026-10-03'],
    ]);
    expect(view?.drill.fit).toEqual([
      '10000000-0000-4000-8000-0000000000a1',
      '10000000-0000-4000-8000-0000000000a2',
    ]);
    expect(view?.drill.spares).toEqual(['10000000-0000-4000-8000-0000000000a3']);
  });

  it('reads a category fallback with the machine’s own event count', () => {
    const view = reliabilityOf(
      {
        ...VALUE,
        machines: {
          [PARTIAL_ID]: {
            fit: {
              status: 'fitted',
              basis: 'category',
              category: 'Turning Center',
              ownEvents: 4,
              shape: 0.812341247,
              scale: 493.425375085,
              meanHours: 553.062708887,
              events: 260,
              completeIntervals: 225,
              censoredHours: 1234.5,
              quartiles: { q25: 101.612903, median: 274.354839, q75: 701.129032 },
              trend: { beta: 1.114657295, n: 260, label: 'no_clear_trend' },
            },
            spares: { rows: [], total: 0 },
            drill: { fit: ['10000000-0000-4000-8000-0000000000a4'], spares: [] },
          },
        },
      },
      PARTIAL_ID,
    );
    expect(view?.fit).toMatchObject({
      status: 'fitted',
      basis: 'category',
      category: 'Turning Center',
      ownEvents: 4,
      events: 260,
      completeIntervals: 225,
    });
    expect(view?.spares).toEqual({ rows: [], total: 0 });
    expect(view?.drill).toEqual({ fit: ['10000000-0000-4000-8000-0000000000a4'], spares: [] });
  });

  it('reads “not enough history” with the machine’s count, its category’s count and the minimum', () => {
    expect(reliabilityOf(VALUE, PARTIAL_ID)?.fit).toEqual({
      status: 'insufficient',
      ownEvents: 4,
      category: 'Turning Center',
      categoryEvents: 3,
      minimum: 5,
    });
  });

  it('reads a plant with no shift windows as its own state', () => {
    const noBasis = {
      ...VALUE,
      machines: { [FULL_ID]: { ...VALUE.machines[FULL_ID], fit: { status: 'no_basis' } } },
    };
    expect(reliabilityOf(noBasis, FULL_ID)?.fit).toEqual({ status: 'no_basis' });
  });

  it('keeps a missing total unknown rather than counting the rows it can see', () => {
    const missing = {
      ...VALUE,
      machines: {
        [FULL_ID]: {
          ...VALUE.machines[FULL_ID],
          spares: { rows: VALUE.machines[FULL_ID].spares.rows, total: null },
        },
      },
    };
    expect(reliabilityOf(missing, FULL_ID)?.spares.total).toBeNull();
  });

  it('drops a spare row with no name or no count instead of printing a made-up part', () => {
    const damaged = {
      ...VALUE,
      machines: {
        [FULL_ID]: {
          ...VALUE.machines[FULL_ID],
          spares: {
            rows: [
              { name: 'Seal 20422243', uses: 2, downtimeHours: 13.2833, lastOn: '2026-10-13' },
              { uses: 2, downtimeHours: 6.0833, lastOn: '2026-07-16' },
              { name: '80086622 Seal', uses: null, downtimeHours: 9, lastOn: '2026-10-13' },
            ],
            total: 15,
          },
        },
      },
    };
    const view = reliabilityOf(damaged, FULL_ID);
    expect(view?.spares.rows.map((row) => row.name)).toEqual(['Seal 20422243']);
    expect(view?.spares.total).toBe(15);
  });

  it('does not claim a trend the stored word does not name', () => {
    const odd = {
      ...VALUE,
      machines: {
        [FULL_ID]: {
          ...VALUE.machines[FULL_ID],
          fit: {
            ...VALUE.machines[FULL_ID].fit,
            trend: { beta: 1.2, n: 44, label: 'sideways' },
          },
        },
      },
    };
    const view = reliabilityOf(odd, FULL_ID);
    expect(view?.fit.status === 'fitted' && view.fit.trend.word).toBe('no_clear_trend');
  });

  it('returns nothing for a machine the figure does not hold, or a fitted block missing a number', () => {
    expect(reliabilityOf(VALUE, '10000000-0000-4000-8000-0000000000ff')).toBeNull();
    expect(reliabilityOf(null, FULL_ID)).toBeNull();
    const broken = {
      ...VALUE,
      machines: {
        [FULL_ID]: {
          ...VALUE.machines[FULL_ID],
          fit: { ...VALUE.machines[FULL_ID].fit, meanHours: null },
        },
      },
    };
    expect(reliabilityOf(broken, FULL_ID)).toBeNull();
  });
});

describe('the block’s drill link', () => {
  it('opens the machine page with the tickets it names', () => {
    expect(drillLinkOf('m1', 'ticket', ['t1', 't2'])).toEqual({
      kind: 'drill',
      href: '/analytics/machines/m1?drill=ticket%3At1%2Ct2',
    });
  });

  it('opens the Breakdown log with the count above the 200-id cap, and no drill query', () => {
    const ids = Array.from({ length: 201 }, (_, index) => `t${index + 1}`);
    const link = drillLinkOf('m1', 'ticket', ids);
    expect(link).toEqual({
      kind: 'log',
      href: '/analytics/breakdowns?screen=breakdown-log',
      count: 201,
    });
    expect(link?.href).not.toContain('drill=');
  });

  it('offers no link when the block names no rows', () => {
    expect(drillLinkOf('m1', 'ticket', [])).toBeNull();
  });
});

describe('the block’s copy', () => {
  it('names a catalogue word for each trend and prints them in English', () => {
    expect(TREND_WORDS).toEqual({
      improving: 'analytics.machine.fit.improving',
      worsening: 'analytics.machine.fit.worsening',
      no_clear_trend: 'analytics.machine.fit.noTrend',
    });
    expect(en[TREND_WORDS.worsening]).toBe('failures are coming faster');
    expect(en[TREND_WORDS.improving]).toBe('failures are getting further apart');
    expect(en[TREND_WORDS.no_clear_trend]).toBe('no clear trend yet');
  });

  it('names every section line and table column in the catalogue', () => {
    const keys = [
      'analytics.machine.reliability',
      'analytics.machine.spares',
      'analytics.machine.fit.shape',
      'analytics.machine.fit.scale',
      'analytics.machine.fit.mean',
      'analytics.machine.fit.hours',
      'analytics.machine.fit.ownFailures',
      'analytics.machine.fit.categoryFit',
      'analytics.machine.fit.sample',
      'analytics.machine.fit.categorySample',
      'analytics.machine.fit.quartiles',
      'analytics.machine.fit.trend',
      'analytics.machine.fit.notEnough',
      'analytics.machine.fit.notEnoughDetail',
      'analytics.machine.fit.noBasis',
      'analytics.machine.spares.ranked',
      'analytics.machine.spares.none',
      'analytics.machine.spares.topFive',
      'analytics.machine.spares.part',
      'analytics.machine.spares.uses',
      'analytics.machine.spares.hours',
      'analytics.machine.spares.lastUsed',
    ] as const;
    for (const key of keys) expect(en[key], key).toBeTruthy();
  });
});
