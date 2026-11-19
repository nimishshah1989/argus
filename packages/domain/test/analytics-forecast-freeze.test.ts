import { DEFAULT_PROFILE } from '@uptimo/shared';
import { describe, expect, it } from 'vitest';
import { FORECAST_MODEL, frozenForMonth, type FrozenForecast } from '../src/index.js';
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
