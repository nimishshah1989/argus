import { MAX_DRILL_IDS, addDays, isPlannedChannel, pmToleranceDays } from '@uptimo/shared';
import { effectivePmPlan } from '../pm-schedule.js';
import { plantDay } from './plant-day.js';
import type { Computer, EngineData, FigureValue, PmPlanRow, TicketRow } from './types.js';

/**
 * The two compliance definitions of ticket 50 (R6/R7/R8), computed once for the whole product.
 *
 * **PM compliance** is PM work orders closed inside their scheduled date's tolerance, divided by the PM work orders
 * judged (closed, or past the tolerance). **Schedule compliance** is planned work orders (PM or inspection) closed by
 * the Sunday of their scheduled Monday–Sunday week, divided by the planned work orders judged (closed, or past the
 * week). Both read the work order's own scheduled date — `task_expected_on`, else the plant day of `reported_at` —
 * because 49 stores one plan per machine and keeps no visit history to reconstruct a schedule from. A figure that
 * measured PM compliance against the close's week, or schedule compliance against the tolerance, would pass one row
 * of the fixture and miss the point: B1 is a PM early miss and a schedule hit, A1 the reverse, G1 PM-pending while
 * its week has already ended. Percentages are one-decimal numbers or `null` with no denominator; counts are exact.
 */

/** One PM work order's outcome (R6). Only the first five are judged; `pending` is still inside its tolerance. */
export type PmOutcome = 'onTime' | 'early' | 'late' | 'overdue' | 'cancelled' | 'pending';

/** One planned work order's outcome (R7). `pending` is still inside its scheduled week. */
export type ScheduleOutcome = 'done' | 'missed' | 'pending';

export interface PmComplianceCounts {
  eligible: number;
  onTime: number;
  early: number;
  late: number;
  overdue: number;
  cancelled: number;
  pending: number;
  pct: number | null;
}

export interface ScheduleComplianceCounts {
  eligible: number;
  done: number;
  missed: number;
  pending: number;
  pct: number | null;
}

/** What the `pm-compliance` figure carries: the window, the eight PM counts and the four schedule counts. */
export interface PmComplianceValue {
  from: string;
  to: string;
  pm: PmComplianceCounts;
  schedule: ScheduleComplianceCounts;
}

export interface PmComplianceOptions {
  /** First scheduled plant day in the window, inclusive. */
  from: string;
  /** Last scheduled plant day in the window, inclusive. */
  to: string;
  /** The plant day every close is judged against; a close after it has not happened yet. */
  asOf: string;
}

export interface PmComplianceResult {
  value: PmComplianceValue;
  /** The planned work orders of the window, in scheduled order, deduplicated and capped at 200. */
  drillIds: string[];
}

const PM_CHANNEL = 'pm';
/** The platform's own move window, and the window of a ticket whose plan is gone (R4/R6). */
const DEFAULT_TOLERANCE = 15;

/** One planned work order of the window with both of its outcomes, before they are summed. */
interface JudgedRow {
  ticket: TicketRow;
  scheduledOn: string;
  pm: PmOutcome | null;
  schedule: ScheduleOutcome;
}

/** The scheduled date of a work order: its `task_expected_on`, else the plant day it was reported (R6). */
const scheduledOnOf = (ticket: TicketRow, timeZone: string): string =>
  ticket.scheduledOn ?? plantDay(ticket.reportedAt, timeZone);

/** The plant day a ticket was closed on, or null when it was not closed by `asOf` (a later close has not happened). */
function closedByOf(ticket: TicketRow, timeZone: string, asOf: string): string | null {
  if (ticket.status !== 'closed' || ticket.closedAt === null) return null;
  const day = plantDay(ticket.closedAt, timeZone);
  return day <= asOf ? day : null;
}

/** The Sunday of the Monday–Sunday week holding `day`: the end of the week the work was planned for (R7). */
function weekEndOf(day: string): string {
  const dayOfWeek = new Date(`${day}T00:00:00Z`).getUTCDay();
  return addDays(day, (7 - dayOfWeek) % 7);
}

/** R6's outcome: a close inside the window is on time, before it early, after it late; else overdue or cancelled. */
export function pmOutcomeOf(input: {
  status: TicketRow['status'];
  scheduledOn: string;
  closeDay: string | null;
  toleranceDays: number;
  asOf: string;
}): PmOutcome {
  const { status, scheduledOn, closeDay, toleranceDays, asOf } = input;
  const lastDay = addDays(scheduledOn, toleranceDays);
  if (closeDay !== null) {
    if (closeDay < addDays(scheduledOn, -toleranceDays)) return 'early';
    return closeDay > lastDay ? 'late' : 'onTime';
  }
  if (lastDay >= asOf) return 'pending';
  return status === 'cancelled' ? 'cancelled' : 'overdue';
}

/** R7's outcome: done by the week's Sunday counts; otherwise a missed week once it has ended, else pending. */
export function scheduleOutcomeOf(input: {
  scheduledOn: string;
  closeDay: string | null;
  asOf: string;
}): ScheduleOutcome {
  const { scheduledOn, closeDay, asOf } = input;
  const weekEnd = weekEndOf(scheduledOn);
  if (closeDay !== null && closeDay <= weekEnd) return 'done';
  return weekEnd < asOf ? 'missed' : 'pending';
}

/** The tolerance of each machine's effective plan (R4): the machine's own plan first, else its category's. */
function toleranceByMachine(data: EngineData): Map<string, number> {
  const plans: readonly PmPlanRow[] = data.pmPlans ?? [];
  const tolerances = new Map<string, number>();
  for (const machine of data.machines) {
    const plan = effectivePmPlan(plans, machine);
    tolerances.set(machine.id, pmToleranceDays(plan?.intervalDays ?? null));
  }
  return tolerances;
}

/** The work orders the two definitions read: a PM job or another planned channel, scheduled inside the window. */
function judgedInWindow(data: EngineData, options: PmComplianceOptions): JudgedRow[] {
  const { from, to, asOf } = options;
  const tolerances = toleranceByMachine(data);
  const judged: JudgedRow[] = [];
  for (const ticket of data.tickets) {
    if (!isPlannedChannel(ticket.raisedChannel)) continue;
    const scheduledOn = scheduledOnOf(ticket, data.timeZone);
    if (scheduledOn < from || scheduledOn > to) continue;
    const closeDay = closedByOf(ticket, data.timeZone, asOf);
    const isPm = ticket.raisedChannel === PM_CHANNEL;
    const toleranceDays =
      (ticket.machineId === null ? undefined : tolerances.get(ticket.machineId)) ??
      DEFAULT_TOLERANCE;
    judged.push({
      ticket,
      scheduledOn,
      pm: isPm
        ? pmOutcomeOf({ status: ticket.status, scheduledOn, closeDay, toleranceDays, asOf })
        : null,
      schedule: scheduleOutcomeOf({ scheduledOn, closeDay, asOf }),
    });
  }
  return judged.sort(
    (left, right) =>
      left.scheduledOn.localeCompare(right.scheduledOn) ||
      left.ticket.ref.localeCompare(right.ticket.ref),
  );
}

/** One decimal, the plan's rounding (R16): 2 of 8 is 25.0, 3 of 11 is 27.3; no denominator is null, never 0. */
function pctOf(success: number, eligible: number): number | null {
  return eligible === 0 ? null : Math.round((1000 * success) / eligible) / 10;
}

/** Both figures over a window, with the planned work orders behind them (R8). Nothing is written on a read. */
export function computePmCompliance(
  data: EngineData,
  options: PmComplianceOptions,
): PmComplianceResult {
  const judged = judgedInWindow(data, options);
  const pm: PmComplianceCounts = {
    eligible: 0,
    onTime: 0,
    early: 0,
    late: 0,
    overdue: 0,
    cancelled: 0,
    pending: 0,
    pct: null,
  };
  const schedule: ScheduleComplianceCounts = {
    eligible: 0,
    done: 0,
    missed: 0,
    pending: 0,
    pct: null,
  };
  for (const row of judged) {
    if (row.pm !== null) {
      pm[row.pm] += 1;
      if (row.pm !== 'pending') pm.eligible += 1;
    }
    if (row.schedule !== 'pending') schedule.eligible += 1;
    schedule[row.schedule] += 1;
  }
  pm.pct = pctOf(pm.onTime, pm.eligible);
  schedule.pct = pctOf(schedule.done, schedule.eligible);
  return {
    value: { from: options.from, to: options.to, pm, schedule },
    drillIds: judged.slice(0, MAX_DRILL_IDS).map((row) => row.ticket.id),
  };
}

/**
 * The `pm-calendar` screen's figure (owner 50): the calendar year of the run's as-of day up to that day. 53 freezes
 * the month-end row by calling `computePmCompliance` with its own window; nothing here reads the clock.
 */
export const pmComplianceFigure: Computer = ({ data, asOf }) => {
  const result = computePmCompliance(data, { from: `${asOf.slice(0, 4)}-01-01`, to: asOf, asOf });
  return { value: result.value as unknown as FigureValue, drillIds: result.drillIds };
};
