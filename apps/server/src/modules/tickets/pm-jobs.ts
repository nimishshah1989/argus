import type { Pool } from 'pg';
import type { PgBoss } from 'pg-boss';
import { pmGeneratePayloadSchema } from '@uptimo/shared';
import type { JobRole } from '../../kernel/index.js';
import { runPmGenerate } from './pm-generate.js';

export const PM_GENERATE_QUEUE = 'pm.generate';

export interface PmJobDeps {
  pool: Pool;
  now?: () => Date;
}

/**
 * The `pm.generate` queue for every role and, unless the role is `api`, the worker and its daily UTC schedule. The
 * payload is tenant-agnostic (like retention's): the worker fans out over the customers. No boot enqueue: a plan is
 * not due at creation, and a missed night is one run of the current state, not one per night.
 */
export async function startPmJobs(boss: PgBoss, deps: PmJobDeps, role: JobRole): Promise<void> {
  if (!(await boss.getQueue(PM_GENERATE_QUEUE)))
    await boss.createQueue(PM_GENERATE_QUEUE, {
      policy: 'standard',
      retryLimit: 1,
      retryDelay: 60,
      expireInSeconds: 600,
    });
  if (role === 'api') return;
  const now = deps.now ?? (() => new Date());
  await boss.work(
    PM_GENERATE_QUEUE,
    { batchSize: 1, pollingIntervalSeconds: 30 },
    async ([job]) => {
      if (!job) return;
      const payload = pmGeneratePayloadSchema.parse(job.data);
      const summary = await runPmGenerate(deps.pool, {
        now: now(),
        horizonDays: payload.horizonDays,
      });
      console.log(JSON.stringify({ job: PM_GENERATE_QUEUE, ...summary }));
      return summary;
    },
  );
  await boss.schedule(
    PM_GENERATE_QUEUE,
    '5 0 * * *',
    { v: 1, horizonDays: 0 },
    { tz: 'UTC', singletonKey: 'all', missed: 'once' },
  );
}
