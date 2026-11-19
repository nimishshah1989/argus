import type { PoolClient } from 'pg';
import {
  apiError,
  type BreakdownReportBody,
  type PmChecklistItem,
  type PmPlanForJob,
  type PmReport,
} from '@uptimo/shared';
import { pmPlanById, pmPlanForMachine, type PmPlan } from '../plant/index.js';
import type { CommandAction } from '@uptimo/shared';
import type { LoadedCtx, Outcome, Tx } from './mapper.js';

/**
 * The PM close (ticket 49c, R8). 46b's store writes `input.body.pmReport` verbatim, so the route builds the stored
 * object here **before** the store: it resolves the plan behind the job, derives `total`/`doneBy`, and validates
 * every ticked point and reading against the plan's checklist, so a client cannot lie about how many points a plan
 * has or who did the job. `afterClose` moves the accepted plan in the same transaction, active plans only.
 */

export const PM_CHANNEL = 'pm';
/** The reserved reading key of the machine's meter (R6/R8); it is not a checklist item. */
export const METER_READING = 'meter';

const NO_PLAN = "That plan is not this job's PM plan";

function invalid(message: string, field: string): Outcome {
  return { status: 422, body: apiError('validation', message, field) };
}

function unknownPlan(): Outcome {
  return { status: 404, body: apiError('not_found', 'Unknown PM plan', 'planId') };
}

/** The plan as the job's detail carries it: the effective plan's checklist, no timestamp (R3, 49c). */
export function pmPlanForJob(plan: PmPlan): PmPlanForJob {
  return {
    id: plan.id,
    title: plan.title,
    machineId: plan.machineId,
    category: plan.category,
    intervalDays: plan.intervalDays,
    meterInterval: plan.meterInterval,
    meterTolerance: plan.meterTolerance,
    lastMeterReading: plan.lastMeterReading,
    lastDoneOn: plan.lastDoneOn,
    checklist: plan.checklist as PmChecklistItem[],
    active: plan.active,
  };
}

/** The close's report body, when the command carries one. */
function reportBody(tx: Tx): BreakdownReportBody | null {
  const body = tx.body.report as BreakdownReportBody | undefined;
  return body && typeof body === 'object' ? body : null;
}

/** A PM report belongs to `close` (the phone) and to the late `report`; no other command carries one. */
function carriesPmReport(action: CommandAction): boolean {
  return action === 'close' || action === 'report';
}

/**
 * The plan a close is allowed to record (R8). The effective plan is the answer; a plan switched off after the job
 * opened is accepted when it targets the job's own machine and is not moved; anything else is refused, so a
 * `planId` from another plant (404) or another machine's plan (422) cannot close this job.
 */
async function acceptedPlan(
  client: PoolClient,
  tx: Tx,
  loaded: LoadedCtx,
  requestedId: string | undefined,
): Promise<{ plan: PmPlan | null } | Outcome> {
  const machineId = loaded.ticket.machineId;
  const effective = machineId ? await pmPlanForMachine(client, tx.tenantId, machineId) : null;
  if (requestedId === undefined) return { plan: effective };
  const requested = await pmPlanById(client, tx.tenantId, requestedId);
  // A plan row that is gone (or another plant's) closes to an empty checklist only when the machine has no
  // effective plan; otherwise the id names nothing this job may record (R8: never a dead end, never a lie).
  if (!requested) return effective ? unknownPlan() : { plan: null };
  if (requested.id === effective?.id) return { plan: requested };
  const switchedOff = !requested.active && machineId !== null && requested.machineId === machineId;
  return switchedOff ? { plan: requested } : invalid(NO_PLAN, 'planId');
}

interface ChecklistIndex {
  ticks: Set<string>;
  readings: Set<string>;
  tickCount: number;
  meterNeeded: boolean;
}

/** What the plan accepts: tick ids, reading item ids and whether a meter reading belongs on the report. */
function indexOf(plan: PmPlan | null): ChecklistIndex {
  const index: ChecklistIndex = {
    ticks: new Set(),
    readings: new Set(),
    tickCount: 0,
    meterNeeded: plan?.meterInterval != null,
  };
  for (const item of (plan?.checklist ?? []) as PmChecklistItem[]) {
    if (item.kind === 'tick') {
      index.ticks.add(item.id);
      index.tickCount += 1;
    } else {
      index.readings.add(item.id);
    }
  }
  return index;
}

/** What the report says that the plan does not accept: an unticked point or a reading that is not on the list. */
function checklistProblem(
  undone: string[],
  readings: Record<string, number>,
  index: ChecklistIndex,
): { message: string; field: string } | null {
  if (undone.some((id) => !index.ticks.has(id)))
    return { message: 'That point is not on this plan’s checklist', field: 'undone' };
  const stray = Object.keys(readings).find(
    (key) => key !== METER_READING && !index.readings.has(key),
  );
  if (stray) return { message: 'That reading is not on this plan’s checklist', field: 'readings' };
  if (index.meterNeeded && typeof readings[METER_READING] !== 'number')
    return { message: 'A meter reading is required for this plan', field: 'readings.meter' };
  return null;
}

function commentsOf(input: PmReport | undefined): string | null {
  return input?.comments?.trim() || null;
}

/**
 * A plan row that is gone leaves no checklist to check against: the close stores nothing it cannot verify (R8: the
 * job is never a dead end), rather than accepting ids for a plan that no longer exists.
 */
function emptyReport(input: PmReport | undefined, doneBy: string | null): PmReport {
  return { total: 0, undone: [], readings: {}, comments: commentsOf(input), doneBy };
}

/**
 * A job whose machine has no plan at all has nothing to derive against. Its report keeps what the caller recorded
 * (46b's contract, which clients built before 49c rely on); only the person is still taken from the session, so no
 * body can claim someone else closed the job.
 */
function recordedReport(input: PmReport | undefined, doneBy: string | null): PmReport {
  return {
    total: input?.total ?? 0,
    undone: [...new Set(input?.undone ?? [])],
    readings: { ...(input?.readings ?? {}) },
    comments: commentsOf(input),
    doneBy,
  };
}

/** The stored object of R8: the plan's totals, the person derived from the session, the plan id it moved. */
function storedReport(
  plan: PmPlan | null,
  input: PmReport | undefined,
  index: ChecklistIndex,
  doneBy: string | null,
): { report: PmReport } | Outcome {
  if (!plan)
    return {
      report:
        input?.planId === undefined ? recordedReport(input, doneBy) : emptyReport(input, doneBy),
    };
  const undone = [...new Set(input?.undone ?? [])];
  const readings = { ...(input?.readings ?? {}) };
  const problem = checklistProblem(undone, readings, index);
  if (problem) return invalid(problem.message, problem.field);
  return {
    report: {
      total: index.tickCount,
      undone,
      readings,
      comments: commentsOf(input),
      doneBy,
      planId: plan.id,
    },
  };
}

/** A report that is not a PM job's keeps `pm_report` NULL, so a smuggled one never lands (R8). */
function dropForeignReport(report: BreakdownReportBody | null): null {
  if (report?.pmReport) delete report.pmReport;
  return null;
}

/** Builds the stored object on the body (the store writes it verbatim); a refusal has written nothing. */
function storePmReport(
  report: BreakdownReportBody | null,
  plan: PmPlan | null,
  actingPersonId: string | null,
): Outcome | null {
  // An API close may carry no PM data at all (a mark-done close): the plan still moves, `pm_report` stays NULL.
  if (!report?.pmReport) return null;
  const built = storedReport(plan, report.pmReport, indexOf(plan), actingPersonId);
  if ('status' in built) return built;
  report.pmReport = built.report;
  return null;
}

/**
 * Called by `executeCommand` before the transition writes anything. For a PM job it sets the stored object on
 * `tx.body.report.pmReport` (the store then writes it verbatim) and leaves the accepted plan on `tx.pmPlanId` for
 * `afterClose`.
 */
export async function preparePmClose(
  client: PoolClient,
  tx: Tx,
  loaded: LoadedCtx,
): Promise<Outcome | null> {
  const report = reportBody(tx);
  if (loaded.extras.raisedChannel !== PM_CHANNEL) return dropForeignReport(report);
  if (!carriesPmReport(tx.action)) return null;
  const accepted = await acceptedPlan(client, tx, loaded, report?.pmReport?.planId);
  if ('status' in accepted) return accepted;
  const plan = accepted.plan;
  if (tx.action === 'close') tx.pmPlanId = plan?.id ?? null;
  return storePmReport(report, plan, tx.actingPersonId);
}
