import type { PgBoss } from 'pg-boss';
import type { Pool } from 'pg';
import { z } from 'zod';
import type { JobRole } from '../../kernel/index.js';
import { markQueueReady, NOTIFY_SEND_QUEUE, NOTIFY_SEND_VERSION, SEND_QUEUE } from './notify.js';
import { processNotification } from './send.js';
import { sweepNotifications } from './sweep.js';

export const NOTIFY_SWEEP_QUEUE = 'notify.sweep';

const sendJob = z.object({
  v: z.literal(NOTIFY_SEND_VERSION),
  tenantId: z.string().uuid(),
  notificationId: z.string().uuid(),
  attempt: z.number().int().min(0),
});

export interface NotifyJobDeps {
  pool: Pool;
  now?: () => Date;
  pollingIntervalSeconds?: number;
}

/**
 * Creates the `notify.send` queue for every role (callers of `notify` need it) and, unless the role is `api`,
 * the workers (send, and a sweep every five minutes). The retries and their waits are ours (`processNotification` queues each one for when it is due);
 * pg-boss's own two retries only cover a crash or an unexpected error.
 */
export async function startNotifyJobs(
  boss: PgBoss,
  deps: NotifyJobDeps,
  role: JobRole,
): Promise<void> {
  if (!(await boss.getQueue(NOTIFY_SEND_QUEUE)))
    await boss.createQueue(NOTIFY_SEND_QUEUE, SEND_QUEUE);
  markQueueReady(boss);
  if (!(await boss.getQueue(NOTIFY_SWEEP_QUEUE)))
    await boss.createQueue(NOTIFY_SWEEP_QUEUE, {
      policy: 'standard',
      retryLimit: 1,
      retryDelay: 60,
      expireInSeconds: 600,
    });
  if (role === 'api') return;
  const now = deps.now ?? (() => new Date());
  await boss.work(
    NOTIFY_SEND_QUEUE,
    { batchSize: 1, pollingIntervalSeconds: deps.pollingIntervalSeconds ?? 2 },
    async ([job]) => {
      if (!job) return;
      const { tenantId, notificationId } = sendJob.parse(job.data);
      await processNotification(
        { pool: deps.pool, boss, now: now() },
        { tenantId, notificationId },
      );
    },
  );
  await boss.work(NOTIFY_SWEEP_QUEUE, { batchSize: 1, pollingIntervalSeconds: 30 }, async () => {
    const swept = await sweepNotifications({ pool: deps.pool, boss, now: now() });
    if (swept.requeued + swept.dead > 0)
      console.log(JSON.stringify({ job: NOTIFY_SWEEP_QUEUE, ...swept }));
  });
  await boss.schedule(NOTIFY_SWEEP_QUEUE, '*/5 * * * *', {}, { tz: 'UTC' });
}
