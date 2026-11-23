import type { FiguresReply } from '@uptimo/shared/analytics';
import { figureMeasure, roundMove, type Measure } from '../../ui/meaning/index.js';

type Figure = FiguresReply['figures'][number];

/** The prior period Today compares with: the same figures as the engine gave them this many days earlier. */
export const COMPARE_DAYS = 30;

/** The plant date `COMPARE_DAYS` before `asOf`, as `YYYY-MM-DD` (calendar arithmetic in UTC, no time zone drift). */
export function priorDate(asOf: string): string {
  const day = new Date(`${asOf}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() - COMPARE_DAYS);
  return day.toISOString().slice(0, 10);
}

/**
 * Figures with no earlier period to compare: a list or state of now. The six fleet counts and the two pictures
 * (the ticket 86 exceptions that sit on Today); the rest of Today's figures show a change.
 */
const NO_PRIOR: ReadonlySet<string> = new Set([
  'dashboard.total-machines',
  'dashboard.utilities',
  'dashboard.dg-sets',
  'dashboard.cnc-machines',
  'dashboard.conventional-machines',
  'dashboard.process-machines',
  'dashboard.bubble-chart',
  'dashboard.expansion-timeline',
]);

/**
 * Totals of the whole log to date. Their change over 30 days is what was added in that time, which is above zero
 * for every plant, so reading it as "Worse" would be wrong: it keeps no good direction. These seven are the
 * sums (breakdowns, downtime, PM, no-downtime and plant-event hours, the costliest problems' hours, and the whole
 * downtime divided by the constant CNC count, which only rises too). A rate, a share or a per-day average moves both
 * ways and keeps its own direction.
 */
const RUNNING_TOTALS: ReadonlySet<string> = new Set([
  'dashboard.total-breakdowns',
  'dashboard.total-downtime-hours',
  'dashboard.pm-hours',
  'dashboard.no-downtime-hours',
  'dashboard.plant-events',
  'dashboard.avg-bd-hours-per-machine',
  'dashboard.costliest-problems',
]);

/** Figures of the plant's year to date: they restart each January, so a change across New Year is no change at all. */
const YEAR_TO_DATE: ReadonlySet<string> = new Set([
  'dashboard.plant-events',
  'dashboard.plant-bd-pct',
  'dashboard.fleet-availability',
]);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The one number a figure's change is about: the value itself, the clean machines, or the problems' total hours. */
export function scalarOf(figure: Figure): number | null {
  if (figure.status !== 'ready') return null;
  const value = figure.value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (!isObject(value)) return null;
  const picked = figure.key === 'dashboard.breakdown-free' ? value.runningClean : value.totalHours;
  return typeof picked === 'number' && Number.isFinite(picked) ? picked : null;
}

/** What a tile prints as its change: the signed move, and the measure that says which way is good. */
export interface Change {
  measure: Measure;
  delta: number;
  /** A running total: the change is what was added, a quiet amount with no verdict. */
  added: boolean;
}

/**
 * The change of `now` against the same figure `before`; none when the figure has no prior period, either value is
 * missing, or the prior date is in an earlier year (`sameYear` false) for a year-to-date figure.
 */
export function changeOf(
  now: Figure,
  before: Figure | undefined,
  sameYear = true,
): Change | undefined {
  if (before === undefined || NO_PRIOR.has(now.key)) return undefined;
  if (!sameYear && YEAR_TO_DATE.has(now.key)) return undefined;
  const [current, prior] = [scalarOf(now), scalarOf(before)];
  if (current === null || prior === null) return undefined;
  const own = figureMeasure(now.key);
  const added = RUNNING_TOTALS.has(now.key);
  return { measure: own, delta: roundMove(current - prior, 2), added };
}
