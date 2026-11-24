import type { Pool } from 'pg';
import type { PgBoss } from 'pg-boss';
import { z } from 'zod';
import { logFailures, withTenant, type JobRole } from '../../kernel/index.js';
import { jobTenantIds } from '../identity/index.js';
import { plantToday } from '../plant/index.js';
import { ENGINE_FREEZE_QUEUE, runEngineFreeze } from './freeze.js';
import { ENGINE_RUN_QUEUE, runEngineRun } from './run.js';
import { FIGURES_WARM_QUEUE, warmServedRun } from './served.js';

/**
 * The engine's queues (ticket 52, R18): created for every role so a caller can enqueue, worked and scheduled only
 * by a non-`api` replica. The payload names one customer or, when absent, the handler fans out over every plant.
 * The freeze runs at 00:10 UTC; the scoring and inspection run at 00:40 UTC, after it.
 */

export const ENGINE_FREEZE_VERSION = 1;
export const ENGINE_RUN_VERSION = 1;
/** 00:10 UTC daily: the 1st freezes the current plant month, a later day catches a missed 1st up (R6). */
export const ENGINE_FREEZE_CRON = '10 0 * * *';
/** 00:40 UTC daily: score the closed months still in their window, then raise the current month's inspections (R8). */
export const ENGINE_RUN_CRON = '40 0 * * *';
const QUEUE = {
  policy: 'standard',
  retryLimit: 1,
  retryDelay: 60,
  expireInSeconds: 1800,
} as const;

const payloadSchema = z.object({
  v: z.literal(ENGINE_FREEZE_VERSION),
  tenantId: z.string().uuid().optional(),
});
type EnginePayload = z.infer<typeof payloadSchema>;

export interface EngineJobDeps {
  pool: Pool;
  now?: () => Date;
}

/** Creates both queues for every role and, unless the role is `api`, their workers and daily UTC schedules. */
export async function startEngineJobs(
  boss: PgBoss,
  deps: EngineJobDeps,
  role: JobRole,
): Promise<void> {
  for (const queue of [ENGINE_FREEZE_QUEUE, ENGINE_RUN_QUEUE])
    if (!(await boss.getQueue(queue))) await boss.createQueue(queue, QUEUE);
  await startWarmJobs(boss, deps.pool, role);
  if (role === 'api') return;
  const now = deps.now ?? (() => new Date());
  await boss.work<EnginePayload>(
    ENGINE_FREEZE_QUEUE,
    { batchSize: 1, pollingIntervalSeconds: 30 },
    logFailures(ENGINE_FREEZE_QUEUE, async ([job]) => {
      const { tenantId } = payloadSchema.parse(job?.data ?? { v: ENGINE_FREEZE_VERSION });
      const summary = await runEngineFreeze(deps.pool, {
        now: now(),
        ...(tenantId ? { tenantId } : {}),
      });
      console.log(JSON.stringify({ job: ENGINE_FREEZE_QUEUE, ...summary }));
      return summary;
    }),
  );
  await boss.schedule(ENGINE_FREEZE_QUEUE, ENGINE_FREEZE_CRON, {}, { tz: 'UTC' });
  await boss.work<EnginePayload>(
    ENGINE_RUN_QUEUE,
    { batchSize: 1, pollingIntervalSeconds: 30 },
    logFailures(ENGINE_RUN_QUEUE, async ([job]) => {
      const { tenantId } = payloadSchema.parse(job?.data ?? { v: ENGINE_RUN_VERSION });
      const summary = await runEngineRun(deps.pool, {
        now: now(),
        ...(tenantId ? { tenantId } : {}),
      });
      console.log(JSON.stringify({ job: ENGINE_RUN_QUEUE, ...summary }));
      return summary;
    }),
  );
  await boss.schedule(ENGINE_RUN_QUEUE, ENGINE_RUN_CRON, {}, { tz: 'UTC' });
}

const warmQueues = new WeakMap<PgBoss, Promise<void>>();

/** Creates the warm queue once per boss handle; startup and the first stale read both come through here. */
export function ensureWarmQueue(boss: PgBoss): Promise<void> {
  let ready = warmQueues.get(boss);
  if (!ready) {
    ready = (async () => {
      if (!(await boss.getQueue(FIGURES_WARM_QUEUE)))
        await boss.createQueue(FIGURES_WARM_QUEUE, { ...QUEUE, policy: 'short' });
    })();
    warmQueues.set(boss, ready);
    ready.catch(() => warmQueues.delete(boss));
  }
  return ready;
}

const warmSchema = z.object({
  v: z.literal(1),
  tenantId: z.string().uuid().optional(),
  asOf: z.string().optional(),
});

/** Ticket 606: with a plant and date, warm that one; without, warm every plant's today (the daily schedule). */
async function warmJob(pool: Pool, data: unknown): Promise<void> {
  const { tenantId, asOf } = warmSchema.parse(data);
  if (tenantId && asOf) return warmServedRun(pool, { tenantId, asOf });
  const errors: unknown[] = [];
  for (const id of tenantId ? [tenantId] : await jobTenantIds(pool))
    try {
      await warmServedRun(pool, {
        tenantId: id,
        asOf: await withTenant(pool, id, (tx) => plantToday(tx, id)),
      });
    } catch (error) {
      errors.push(error);
    }
  if (errors.length > 0) throw new AggregateError(errors, 'figures.warm failed');
}

/**
 * The `figures.warm` queue (`short`: one queued job per singleton key, so a burst of stale reads queues one). The
 * daily schedule runs just after midnight plant time (the plants are in India) so each plant's new day is kept
 * before the first read. shortcut: one fixed time zone, give each plant its own schedule when one is abroad.
 */
async function startWarmJobs(boss: PgBoss, pool: Pool, role: JobRole): Promise<void> {
  await ensureWarmQueue(boss);
  if (role === 'api') return;
  await boss.work(
    FIGURES_WARM_QUEUE,
    { batchSize: 1, pollingIntervalSeconds: 30 },
    logFailures(FIGURES_WARM_QUEUE, async ([job]) => warmJob(pool, job?.data ?? { v: 1 })),
  );
  await boss.schedule(FIGURES_WARM_QUEUE, '5 0 * * *', { v: 1 }, { tz: 'Asia/Kolkata' });
}
