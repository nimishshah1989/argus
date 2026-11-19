import type { Pool } from 'pg';
import type { PgBoss } from 'pg-boss';
import { z } from 'zod';
import type { JobRole } from '../../kernel/index.js';
import { ENGINE_FREEZE_QUEUE, runEngineFreeze } from './freeze.js';

/**
 * The engine's queues (ticket 52, R18): created for every role so a caller can enqueue, worked and scheduled only
 * by a non-`api` replica. The payload names one customer or, when absent, the handler fans out over every plant.
 */

export const ENGINE_FREEZE_VERSION = 1;
/** 00:10 UTC daily: the 1st freezes the current plant month, a later day catches a missed 1st up (R6). */
export const ENGINE_FREEZE_CRON = '10 0 * * *';
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
type EngineFreezePayload = z.infer<typeof payloadSchema>;

export interface EngineJobDeps {
  pool: Pool;
  now?: () => Date;
}

/** Creates the queue for every role and, unless the role is `api`, the worker and the daily UTC schedule. */
export async function startEngineJobs(
  boss: PgBoss,
  deps: EngineJobDeps,
  role: JobRole,
): Promise<void> {
  if (!(await boss.getQueue(ENGINE_FREEZE_QUEUE)))
    await boss.createQueue(ENGINE_FREEZE_QUEUE, QUEUE);
  if (role === 'api') return;
  const now = deps.now ?? (() => new Date());
  await boss.work<EngineFreezePayload>(
    ENGINE_FREEZE_QUEUE,
    { batchSize: 1, pollingIntervalSeconds: 30 },
    async ([job]) => {
      const { tenantId } = payloadSchema.parse(job?.data ?? { v: ENGINE_FREEZE_VERSION });
      const summary = await runEngineFreeze(deps.pool, {
        now: now(),
        ...(tenantId ? { tenantId } : {}),
      });
      console.log(JSON.stringify({ job: ENGINE_FREEZE_QUEUE, ...summary }));
      return summary;
    },
  );
  await boss.schedule(ENGINE_FREEZE_QUEUE, ENGINE_FREEZE_CRON, {}, { tz: 'UTC' });
}
