import { DEFAULT_PROFILE } from '@uptimo/shared';
import { describe, expect, it } from 'vitest';
import {
  FORECAST_MODEL,
  frozenForMonth,
  inspectionProblem,
  monthActuals,
  outcomeFor,
  type FrozenForecast,
} from '../src/index.js';
import { a9RiskCore } from '../src/analytics/a9-bottleneck.js';
import {
  bandOf,
  confidenceOf,
  episodesOf,
  FC_RUNS,
  fleetRows,
  forecastBoard,
  forecastBoardFor,
  monthAt,
  nextMonth,
} from '../src/analytics/a9-forecast-sim.js';
import { isProduction } from '../src/analytics/machine-facts.js';
import { ENGINE_DATA } from './answer-key/fixture.js';

/**
 * The freeze's own acceptance (ticket 52, packet 52a): the frozen board is the A9 model's raw December numbers on
 * the frozen 11 November key, one row per production machine in fleet order, and the month is the calendar month,
 * never `nextMonth(core.to)`. The private helpers are deep-imported as the house rule allows (the server may not).
 */

const DECEMBER = '2026-12-01';
const WJ01 = ENGINE_DATA.machines.find((machine) => machine.code === 'WJ-01')!;
const FLEET = ENGINE_DATA.machines.filter(isProduction);

/** A plant with no production breakdown at all: the freeze writes nothing and says so. */
const QUIET = {
  ...ENGINE_DATA,
  tickets: [],
  tasks: [],
  reports: [],
};

const predictedOf = (rows: readonly FrozenForecast[], machineId: string) =>
  rows.find((row) => row.machineId === machineId)?.predicted;

describe('the frozen board', () => {
  const rows = frozenForMonth(ENGINE_DATA, DEFAULT_PROFILE, DECEMBER);

  it('writes one row per production machine, in fleet order', () => {
    expect(FLEET).toHaveLength(125);
    expect(rows).toHaveLength(FLEET.length);
    expect(rows.map((row) => row.machineId)).toEqual(FLEET.map((machine) => machine.id));
  });

  it('pins WJ-01’s December numbers exactly: expH 6.091584054818952, p80 12.02, p90 19.86, Hot, High', () => {
    expect(predictedOf(rows, WJ01.id)).toEqual({
      days: 31,
      expN: 1.5467071634579725,
      expH: 6.091584054818952,
      p1: 0.6073360870269124,
      p80: 12.02,
      p90: 19.86,
      pLong: 0.245637461502746,
      band: 'Hot',
      confidence: 'High',
      hoursProfile: { prodHrsPerDay: 20, workDaysPerYear: 300 },
    });
  });

  it('has exactly one Hot machine, WJ-01, and the plant’s expected hours are the A9 page’s', () => {
    const hot = rows.filter((row) => row.predicted.band === 'Hot');
    expect(hot.map((row) => row.machineId)).toEqual([WJ01.id]);
    const hours = rows.reduce((total, row) => total + row.predicted.expH, 0);
    expect(hours).toBe(193.7460706225213);
  });

  it('names the model it froze with', () => {
    expect(FORECAST_MODEL).toBe('a9.m0.1');
  });

  it('delegates to the same board the A9 page draws, with the month’s own calendar', () => {
    const core = a9RiskCore(ENGINE_DATA, DEFAULT_PROFILE)!;
    const episodes = episodesOf(fleetRows(ENGINE_DATA));
    const board = forecastBoard(core, episodes, FC_RUNS);
    expect(board.month).toEqual({ label: 'December 2026', days: 31 });
    expect(forecastBoardFor(core, episodes, FC_RUNS, nextMonth(core.to))).toEqual(board);
  });
});

describe('the frozen month', () => {
  it('answers for the date’s calendar month and its length', () => {
    expect(monthAt('2026-12-01')).toEqual({ label: 'December 2026', days: 31 });
    expect(monthAt('2027-02-01')).toEqual({ label: 'February 2027', days: 28 });
    expect(monthAt('2026-12-02')).toEqual({ label: 'December 2026', days: 31 });
  });

  it('refuses a frozen month that is not its 1st', () => {
    expect(() => frozenForMonth(ENGINE_DATA, DEFAULT_PROFILE, '2026-12-02')).toThrow(RangeError);
  });

  it('writes nothing for a plant with no production breakdown', () => {
    expect(frozenForMonth(QUIET, DEFAULT_PROFILE, DECEMBER)).toEqual([]);
  });
});

describe('the moved helpers', () => {
  it('bands the expected hours at 6, 3 and 1', () => {
    expect([bandOf(6), bandOf(5.99), bandOf(3), bandOf(2.99), bandOf(1), bandOf(0.99)]).toEqual([
      'Hot',
      'Likely',
      'Likely',
      'Watch',
      'Watch',
      'Stable',
    ]);
  });

  it('rates confidence from the history length and the episode count', () => {
    expect([
      confidenceOf(6, 150),
      confidenceOf(6, 149),
      confidenceOf(2, 90),
      confidenceOf(2, 89),
    ]).toEqual(['High', 'Medium', 'Medium', 'Low']);
  });
});

const NOVEMBER = '2026-11-01';
const novemberFrozen = frozenForMonth(ENGINE_DATA, DEFAULT_PROFILE, NOVEMBER);
const wj01November = predictedOf(novemberFrozen, WJ01.id)!;

describe('the month’s actuals', () => {
  const actuals = monthActuals(ENGINE_DATA, NOVEMBER);

  it('reads WJ-01’s November exactly: 12.02 hours over 1 episode', () => {
    expect(actuals.get(WJ01.id)).toEqual({ hours: 12.02, episodes: 1 });
  });

  it('totals the plant at 51.06 hours over 42 episodes from 58 November reports', () => {
    const rows = fleetRows(ENGINE_DATA).filter((row) => row.report.date.startsWith('2026-11'));
    expect(rows).toHaveLength(58);
    const sum = [...actuals.values()].reduce(
      (total, entry) => ({
        hours: total.hours + entry.hours,
        episodes: total.episodes + entry.episodes,
      }),
      { hours: 0, episodes: 0 },
    );
    expect(sum).toEqual({ hours: 51.06, episodes: 42 });
  });

  it('counts a month-boundary episode once, in the month it began', () => {
    // WJ-01's 31 July episode runs into 1 August: July holds all 15.43 h and 4 episodes; August holds the
    // 4.28 h that fell in it but not a fifth episode.
    const july = monthActuals(ENGINE_DATA, '2026-07-01').get(WJ01.id)!;
    const august = monthActuals(ENGINE_DATA, '2026-08-01').get(WJ01.id)!;
    expect(july).toEqual({ hours: 15.43, episodes: 4 });
    expect(august.episodes).toBe(3);
    expect(august.hours).toBeCloseTo(10.95, 10);
  });

  it('has no entry for a month the plant did not break down in', () => {
    expect(monthActuals(ENGINE_DATA, '2030-01-01').size).toBe(0);
  });

  it('refuses a month that is not its 1st', () => {
    expect(() => monthActuals(ENGINE_DATA, '2026-11-02')).toThrow(RangeError);
  });
});

describe('the score', () => {
  it('scores WJ-01’s November against its frozen plan-for: 12.02 h over a p80 of 10.17 is no hit', () => {
    expect(wj01November.p80).toBe(10.17);
    const outcome = outcomeFor(
      wj01November,
      monthActuals(ENGINE_DATA, NOVEMBER).get(WJ01.id)!,
      null,
    );
    expect(outcome).toEqual({ hours: 12.02, episodes: 1, hit: false, inspection: null });
  });

  it('scores the November freeze’s plant at 121 hits of 125', () => {
    const actuals = monthActuals(ENGINE_DATA, NOVEMBER);
    const hits = novemberFrozen.filter(
      (row) =>
        outcomeFor(row.predicted, actuals.get(row.machineId) ?? { hours: 0, episodes: 0 }, null)
          .hit,
    );
    expect(novemberFrozen).toHaveLength(125);
    expect(hits).toHaveLength(121);
  });

  it('is exact: the plan-for itself is a hit and a hair over it is not', () => {
    const actual = { hours: wj01November.p80, episodes: 1 };
    expect(outcomeFor(wj01November, actual, null).hit).toBe(true);
    expect(outcomeFor(wj01November, { ...actual, hours: 10.170001 }, null).hit).toBe(false);
  });

  it('scores a month with no breakdown as 0 hours, 0 episodes and a hit', () => {
    expect(outcomeFor(wj01November, { hours: 0, episodes: 0 }, null)).toEqual({
      hours: 0,
      episodes: 0,
      hit: true,
      inspection: null,
    });
  });

  it('carries the inspection’s close state into the outcome untouched', () => {
    const inspection = {
      ticketId: '10000000-0000-0000-0000-000000000001',
      ref: 'WR-0042',
      status: 'closed' as const,
      closeKind: 'done' as const,
      closedAt: '2026-12-03T05:30:00.000Z',
    };
    expect(outcomeFor(wj01November, { hours: 12.02, episodes: 1 }, inspection).inspection).toEqual(
      inspection,
    );
  });
});

describe('the inspection’s problem text', () => {
  it('says the machine, the frozen month and the plan-for at one decimal', () => {
    expect(inspectionProblem({ code: 'WJ-01', month: '2026-12-01', p80: 12.02 })).toBe(
      'WJ-01 is Hot for December 2026: plan for 12.0 hrs',
    );
    expect(inspectionProblem({ code: 'WJ-01', month: '2027-02-01', p80: 9.94 })).toBe(
      'WJ-01 is Hot for February 2027: plan for 9.9 hrs',
    );
  });
});
