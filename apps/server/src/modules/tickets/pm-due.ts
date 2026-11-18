const DAY = 86_400_000;

/** A `YYYY-MM-DD` day plus `n` days: calendar arithmetic, no zone (a plan's day is the plant's day). */
export function addDays(day: string, n: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
}

/** What the decision needs of a plan; `anchorOn` is the plant-local day of its `created_at` (R2). */
export interface PmDuePlan {
  /** The clock anchor when no completion is recorded: the plant's day of `created_at`, which may be future (R2). */
  anchorOn: string;
  lastDoneOn: string | null;
  intervalDays: number | null;
  meterInterval: number | null;
  meterTolerance: number | null;
  lastMeterReading: number | null;
}

export interface PmDueInput {
  /** The plant's calendar day, `YYYY-MM-DD`; never a UTC day. */
  today: string;
  /** Days ahead of today a plan still raises; the daily job uses 0 and 50's calendar projects further. */
  horizonDays: number;
  /** This machine already has a PM job open (or being worked): no second one. */
  openPm: boolean;
  /** The reading in the latest closed PM ticket's `readings.meter`, or null when no PM has been done (R6). */
  baseline: number | null;
}

export interface PmDueResult {
  due: boolean;
  /** The time rule's due day (`anchor + interval`); null when a direct-SQL row has no interval. */
  nextDue: string | null;
  rule: 'time' | 'meter' | null;
  /** Past `meter_interval + meter_tolerance`: the status 50 shows; it never delays or repeats the raise (R6). */
  overdue: boolean;
}

/** The meter delta from the last PM, or null when the plan has no meter, no reading or no baseline. */
function meterDelta(plan: PmDuePlan, baseline: number | null): number | null {
  if (baseline === null || plan.meterInterval === null || plan.lastMeterReading === null)
    return null;
  return plan.lastMeterReading - baseline;
}

/**
 * One plan's answer (R6, R7). Time due is `anchor + interval_days` raised on the due date: 49 has no ±15-day window,
 * that is 50's status work. Meter due is the plan's latest reading less the reading at the last PM, raised at the
 * interval, so tolerance moves only `overdue`. Every plan the screen or the import creates has an interval; a
 * direct-SQL row without one is inert (R6).
 */
export function pmDue(plan: PmDuePlan, input: PmDueInput): PmDueResult {
  const delta = meterDelta(plan, input.baseline);
  const overdue = delta !== null && delta >= (plan.meterInterval ?? 0) + (plan.meterTolerance ?? 0);
  if (plan.intervalDays === null) return { due: false, nextDue: null, rule: null, overdue };

  const nextDue = addDays(plan.lastDoneOn ?? plan.anchorOn, plan.intervalDays);
  const timeDue = nextDue <= addDays(input.today, input.horizonDays);
  const meterDue = delta !== null && delta >= (plan.meterInterval ?? 0);
  if (input.openPm) return { due: false, nextDue, rule: null, overdue };
  if (timeDue) return { due: true, nextDue, rule: 'time', overdue };
  if (meterDue) return { due: true, nextDue, rule: 'meter', overdue };
  return { due: false, nextDue, rule: null, overdue };
}
