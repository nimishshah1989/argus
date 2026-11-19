import type { Pool } from 'pg';
import type { PgBoss } from 'pg-boss';
import { alarmLine, logFailures } from '../../kernel/index.js';

/**
 * The timer-lag alarm (MILESTONES 78a): once a minute, every queue holding a job whose time came more than two
 * minutes ago and which no worker took writes one alarm line. It reads the database's clock, so a skewed server
 * clock cannot hide a late timer. It runs in every role: with only the web process alive, it still notices that
 * the workers are gone.
 */

export const WATCH_QUEUE = 'ops.watch';
export const LATE_AFTER_SECONDS = 120;

export interface LateQueue {
  queue: string;
  count: number;
  lateSeconds: number;
}

export async function runJobWatch(pool: Pool): Promise<LateQueue[]> {
  const { rows } = await pool.query(
    `SELECT name, count(*)::int AS n,
            floor(extract(epoch FROM clock_timestamp() - min(start_after)))::int AS late
       FROM pgboss.job
      WHERE state IN ('created', 'retry') AND name <> $1
        AND start_after < clock_timestamp() - make_interval(secs => $2)
      GROUP BY name ORDER BY name`,
    [WATCH_QUEUE, LATE_AFTER_SECONDS],
  );
  const late = rows.map((row) => ({
    queue: row.name as string,
    count: row.n as number,
    lateSeconds: row.late as number,
  }));
  for (const one of late)
    alarmLine('timer-late', { job: one.queue, count: one.count, lateSeconds: one.lateSeconds });
  return late;
}

export async function startJobWatch(boss: PgBoss, deps: { pool: Pool }): Promise<void> {
  if (!(await boss.getQueue(WATCH_QUEUE)))
    await boss.createQueue(WATCH_QUEUE, { policy: 'standard', retryLimit: 0, expireInSeconds: 60 });
  await boss.work(
    WATCH_QUEUE,
    { batchSize: 1, pollingIntervalSeconds: 15 },
    logFailures(WATCH_QUEUE, async () => {
      await runJobWatch(deps.pool);
    }),
  );
  await boss.schedule(WATCH_QUEUE, '* * * * *', {}, { tz: 'UTC' });
}
