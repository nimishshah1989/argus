import type { Pool, PoolClient } from 'pg';
import { withTenant } from '@uptimo/db';
import { jobTenantIds, tenantInfo } from '../identity/index.js';
import { pmPlansForScheduling } from '../plant/index.js';
import { pmDue } from './pm-due.js';
import { raisePlannedTicket } from './planned.js';
import { latestPmReadings, openPmMachineIds } from './repo/pm.js';

const DAY = 86_400_000;
/** A job whose clock is further than this from the database's refuses to run: a wrong clock raises the wrong jobs. */
const MAX_CLOCK_SKEW_MS = DAY;

export interface PmGenerateOptions {
  now: Date;
  /** One customer only; the default fans out over `jobTenantIds()` like the retention jobs. */
  tenantId?: string;
  /** Days ahead of today a plan still raises; the daily job uses 0. */
  horizonDays?: number;
  /** Only a test with a fake clock passes this. */
  allowFakeClock?: boolean;
}

export interface PmGenerateResult {
  tenants: number;
  raised: number;
}

async function assertClockNearDatabase(pool: Pool, now: Date): Promise<void> {
  const row = (await pool.query('SELECT clock_timestamp() AS t')).rows[0] as { t: Date };
  if (Math.abs(row.t.getTime() - now.getTime()) > MAX_CLOCK_SKEW_MS)
    throw new Error(
      `pm.generate: the clock (${now.toISOString()}) is more than 24 hours from the database's ` +
        `(${row.t.toISOString()}); nothing was changed`,
    );
}

/**
 * One customer's day, under its row security: its effective plans (R3), the machines with a PM job already open,
 * and the measurement baselines (R6). A due plan raises 46c's `general`/`pm` ticket with only the merged input
 * (`tenantId, machineId, channel, problem, at`); planned work carries no SLA clock, drift or escalation (R4).
 */
async function generateForTenant(
  client: PoolClient,
  tenantId: string,
  now: Date,
  horizonDays: number,
): Promise<number> {
  const plans = await pmPlansForScheduling(client, tenantId);
  if (plans.length === 0) return 0;
  const machineIds = plans.map((plan) => plan.machineId);
  const openPm = await openPmMachineIds(client, tenantId, machineIds);
  const baselines = await latestPmReadings(client, tenantId, machineIds);
  const { time_zone: timeZone } = await tenantInfo(client, tenantId);
  const localDay = (at: Date) => at.toLocaleDateString('en-CA', { timeZone });
  const today = localDay(now);
  let raised = 0;
  for (const plan of plans) {
    const decision = pmDue(
      {
        anchorOn: localDay(plan.createdAt),
        lastDoneOn: plan.lastDoneOn,
        intervalDays: plan.intervalDays,
        meterInterval: plan.meterInterval,
        meterTolerance: plan.meterTolerance,
        lastMeterReading: plan.lastMeterReading,
      },
      {
        today,
        horizonDays,
        openPm: openPm.has(plan.machineId),
        baseline: baselines.get(plan.machineId) ?? null,
      },
    );
    if (!decision.due) continue;
    await raisePlannedTicket(client, {
      tenantId,
      machineId: plan.machineId,
      channel: 'pm',
      problem: `PM due: ${plan.title}`,
      at: now,
    });
    raised += 1;
  }
  return raised;
}

/**
 * The daily `pm.generate` run: one customer at a time under that customer's row security, taking the clock as an
 * argument, and raising no second job while a PM job is open (so a re-run is a no-op). Refuses a clock more than 24
 * hours from the database's unless a test passes the fake clock.
 */
export async function runPmGenerate(
  pool: Pool,
  options: PmGenerateOptions,
): Promise<PmGenerateResult> {
  if (!options.allowFakeClock) await assertClockNearDatabase(pool, options.now);
  const tenantIds = options.tenantId ? [options.tenantId] : await jobTenantIds(pool);
  const horizonDays = options.horizonDays ?? 0;
  const result: PmGenerateResult = { tenants: 0, raised: 0 };
  const errors: unknown[] = [];
  for (const tenantId of tenantIds) {
    try {
      const raised = await withTenant(pool, tenantId, (client) =>
        generateForTenant(client, tenantId, options.now, horizonDays),
      );
      result.tenants += 1;
      result.raised += raised;
    } catch (error) {
      errors.push(error);
    }
  }
  if (errors.length > 0) throw new AggregateError(errors, 'pm.generate failed');
  return result;
}
