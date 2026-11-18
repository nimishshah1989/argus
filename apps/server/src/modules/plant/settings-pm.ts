import type { PoolClient } from 'pg';
import { pmPlanCreateSchema, pmPlanPatchSchema } from '@uptimo/shared';
import { activePlanForMachine } from './repo/records.js';
import { exists } from './repo/plant-settings.js';
import { plantToday } from './repo/reads.js';
import type { Problem, Resource } from './settings-resources.js';

/**
 * The generated `/settings/pm-plans` resource (ticket 49a). One recurring plan per machine or category,
 * edited through the generic plant store; the seed and the future scheduler use `records.ts` instead.
 */

const numberOrNull = (value: unknown): number | null =>
  value === null || value === undefined ? null : Number(value);

/** A stored date column arrives as a local-midnight `Date` or a text day; either way the day is what it says. */
const dayOrNull = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  if (!(value instanceof Date)) return String(value).slice(0, 10);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
};

function pmPlanReply(row: Record<string, unknown>): Record<string, unknown> {
  return {
    id: row.id,
    title: row.title,
    machineId: row.machine_id ?? null,
    category: row.category ?? null,
    intervalDays: row.interval_days ?? null,
    meterInterval: numberOrNull(row.meter_interval),
    meterTolerance: numberOrNull(row.meter_tolerance),
    lastMeterReading: numberOrNull(row.last_meter_reading),
    lastDoneOn: dayOrNull(row.last_done_on),
    checklist: (row.checklist as unknown[] | null) ?? [],
    active: row.active === true,
    createdAt: new Date(row.created_at as string | number | Date).toISOString(),
  };
}

function targetProblem(plan: Record<string, unknown>): Problem | null {
  const machineId = (plan.machineId as string | null | undefined) ?? null;
  const category = (plan.category as string | null | undefined) ?? null;
  return machineId || category
    ? null
    : { field: 'machineId', message: 'Choose a machine or a category' };
}

async function machineProblem(tx: PoolClient, machineId: string | null): Promise<Problem | null> {
  if (!machineId || (await exists(tx, 'machine', machineId))) return null;
  return { field: 'machineId', message: 'Unknown machine', missing: true };
}

async function lastDoneProblem(
  tx: PoolClient,
  plan: Record<string, unknown>,
  tenantId: string,
): Promise<Problem | null> {
  const lastDoneOn = plan.lastDoneOn as string | null | undefined;
  if (!lastDoneOn || lastDoneOn <= (await plantToday(tx, tenantId))) return null;
  return { field: 'lastDoneOn', message: 'The last done date cannot be in the future' };
}

/** One effective plan per machine (R3): a second active machine plan is refused; category plans are the fallback. */
async function duplicateProblem(
  tx: PoolClient,
  plan: Record<string, unknown>,
  edit: { before: Record<string, unknown> } | undefined,
  tenantId: string,
): Promise<Problem | null> {
  const machineId = (plan.machineId as string | null | undefined) ?? null;
  if (!machineId || plan.active === false) return null;
  const other = await activePlanForMachine(
    tx,
    tenantId,
    machineId,
    edit?.before.id as string | undefined,
  );
  return other
    ? { field: 'machineId', message: 'That machine already has an active PM plan', conflict: true }
    : null;
}

async function checkPmPlan(
  tx: PoolClient,
  plan: Record<string, unknown>,
  edit: { before: Record<string, unknown> } | undefined,
  tenantId: string,
): Promise<Problem | null> {
  const machineId = (plan.machineId as string | null | undefined) ?? null;
  return (
    targetProblem(plan) ??
    (await machineProblem(tx, machineId)) ??
    (await lastDoneProblem(tx, plan, tenantId)) ??
    (await duplicateProblem(tx, plan, edit, tenantId))
  );
}

export const pmPlans: Resource = {
  path: 'settings/pm-plans',
  table: 'pm_plan',
  kind: 'pmPlan',
  order: 'title',
  columns: {
    title: 'title',
    machineId: 'machine_id',
    category: 'category',
    intervalDays: 'interval_days',
    meterInterval: 'meter_interval',
    meterTolerance: 'meter_tolerance',
    lastMeterReading: 'last_meter_reading',
    lastDoneOn: 'last_done_on',
    active: 'active',
  },
  create: pmPlanCreateSchema,
  patch: pmPlanPatchSchema,
  reply: pmPlanReply,
  switchTo: (active) => ({ active }),
  check: checkPmPlan,
};
