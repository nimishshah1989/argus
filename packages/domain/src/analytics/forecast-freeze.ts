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
import { formatNumber } from './format.js';
import { dayNumber } from './plant-date.js';
import { effectiveHours } from './rows.js';
import type { EngineData } from './types.js';
import type { Status } from '../types.js';

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

/**
 * What actually happened to one machine in a frozen month (R13): the effective hours of its production, non-PM
 * reports dated in the month, and the merged episodes that **began** in it. A month-boundary episode therefore
 * counts its hours in the month it ran into but its one episode in the month it began.
 */
export interface ForecastActual {
  hours: number;
  episodes: number;
}

/** The inspection ticket's close, mapped one-to-one (R12): no problem text, note or person is copied. */
export interface InspectionOutcome {
  ticketId: string;
  ref: string;
  status: Status;
  closeKind: 'report' | 'no_report' | 'done' | null;
  closedAt: string | null;
}

/** One frozen row's score: what happened, whether the plan-for held, and its inspection's close state. */
export interface ForecastOutcome {
  hours: number;
  episodes: number;
  /** `hours <= predicted.p80`, exactly: plan-for exceedance, not model accuracy (R13). */
  hit: boolean;
  inspection: InspectionOutcome | null;
}

/**
 * The month's actuals per machine, on the same fleet and hour definitions the A9 model reads: every production,
 * non-PM report dated in the month adds its effective hours; every merged episode whose first day is in the month
 * counts once. A machine with no activity in the month has no entry (the caller reads it as 0 hours, 0 episodes).
 */
export function monthActuals(data: EngineData, month: string): Map<string, ForecastActual> {
  if (dayNumber(month) === null) throw new RangeError(`not a plant date: ${month}`);
  if (!month.endsWith('-01')) throw new RangeError(`a scored month is its 1st: ${month}`);
  const start = dayNumber(month) as number;
  const end = start + monthAt(month).days - 1;
  const rows = fleetRows(data);
  const actuals = new Map<string, ForecastActual>();
  const at = (machineId: string): ForecastActual => {
    const known = actuals.get(machineId);
    if (known) return known;
    const fresh: ForecastActual = { hours: 0, episodes: 0 };
    actuals.set(machineId, fresh);
    return fresh;
  };
  for (const { report } of rows) {
    const day = dayNumber(report.date);
    if (day === null || day < start || day > end) continue;
    at(report.machineId).hours += effectiveHours(report);
  }
  for (const [machineId, episodes] of episodesOf(rows)) {
    const begun = episodes.filter(
      (episode) => episode.first >= start && episode.first <= end,
    ).length;
    if (begun > 0) at(machineId).episodes = begun;
  }
  return actuals;
}

/** One frozen row scored: the predicted plan-for against the month's actuals and the inspection's close (R8/R12). */
export function outcomeFor(
  predicted: FrozenPrediction,
  actual: ForecastActual,
  inspection: InspectionOutcome | null,
): ForecastOutcome {
  return {
    hours: actual.hours,
    episodes: actual.episodes,
    hit: actual.hours <= predicted.p80,
    inspection,
  };
}

/**
 * The inspection ticket's problem text, the plant's own words (pinned by the domain test): the machine's code, the
 * frozen month's label and its plan-for at one decimal, the same text a person reads on the ticket.
 */
export function inspectionProblem(input: { code: string; month: string; p80: number }): string {
  return `${input.code} is Hot for ${monthAt(input.month).label}: plan for ${formatNumber(input.p80, 1)} hrs`;
}
