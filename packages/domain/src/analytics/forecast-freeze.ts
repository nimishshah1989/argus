import { dataAsOf } from './as-of.js';
import { a9RiskCore } from './a9-bottleneck.js';
import {
  FC_RUNS,
  bandOf,
  confidenceOf,
  episodesOf,
  fleetRows,
  forecastBoardFor,
  monthAt,
  type ForecastBand,
  type ForecastConfidence,
} from './a9-forecast-sim.js';
import { dayNumber } from './plant-date.js';
import type { EngineData } from './types.js';

/**
 * The monthly freeze (ticket 52, packet 52a): one `FrozenForecast` per production machine, holding the A9 M0
 * model's raw numbers for the calendar month that starts on the freeze day. The values are the ones the A9 page
 * prints, never printed strings (R2), so the row can be re-derived after a profile edit and scored later. The model
 * name and the profile version are the row's provenance (R2/R7).
 */

/** The one model a frozen row names. */
export const FORECAST_MODEL = 'a9.m0.1';

/** What is frozen: the A9 model's numbers, its band and confidence, and the two inputs that explain them. */
export interface FrozenPrediction {
  /** The frozen month's calendar length. */
  days: number;
  /** Expected breakdowns (episodes) in the month. */
  expN: number;
  /** Expected breakdown hours in the month. */
  expH: number;
  /** Chance of at least one breakdown. */
  p1: number;
  /** Plan-for: hours the machine stays under 4 months in 5. */
  p80: number;
  /** Worst case: hours it stays under 9 months in 10. */
  p90: number;
  /** Chance of a long (8 h+) breakdown. */
  pLong: number;
  band: ForecastBand;
  confidence: ForecastConfidence;
  /** The two profile numbers the model read, so the row is reproducible after an edit. */
  hoursProfile: { prodHrsPerDay: number; workDaysPerYear: number };
}

/** One machine's frozen month: the row the freeze inserts. */
export interface FrozenForecast {
  machineId: string;
  predicted: FrozenPrediction;
}

/**
 * The frozen board for a calibration month (`YYYY-MM-01`, or a `RangeError`): the plant as it stood on the month's
 * 1st, A9's own observation window (the last breakdown on or before that day, R4), and the month's own calendar.
 * One row per production machine in fleet order; `[]` when the plant has no production breakdown to observe.
 */
export function frozenForMonth(
  data: EngineData,
  profile: { prodHrsPerDay: number; workDaysPerYear: number },
  month: string,
  runs: number = FC_RUNS,
): FrozenForecast[] {
  if (dayNumber(month) === null) throw new RangeError(`not a plant date: ${month}`);
  if (!month.endsWith('-01')) throw new RangeError(`a frozen month is its 1st: ${month}`);
  const cut = dataAsOf(data, month);
  const core = a9RiskCore(cut, profile);
  if (core === null) return [];
  const calendar = monthAt(month);
  const board = forecastBoardFor(core, episodesOf(fleetRows(cut)), runs, calendar);
  return board.models.map((model) => ({
    machineId: model.risk.machine.id,
    predicted: {
      days: calendar.days,
      expN: model.expN,
      expH: model.expH,
      p1: model.p1,
      p80: model.p80,
      p90: model.p90,
      pLong: model.pLong,
      band: bandOf(model.expH),
      confidence: confidenceOf(model.n, model.risk.days),
      hoursProfile: {
        prodHrsPerDay: profile.prodHrsPerDay,
        workDaysPerYear: profile.workDaysPerYear,
      },
    },
  }));
}
