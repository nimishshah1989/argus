import type { Pool } from 'pg';
import type { PgBoss } from 'pg-boss';
import { withTenant } from '../../kernel/index.js';
import { jobTenantIds } from '../identity/index.js';
import { queueSends } from './notify.js';
import { claimOverdue, markStuckDead } from './repo.js';

const MINUTE = 60_000;
const DAY = 86_400_000;
/** Longer than any normal wait between a row being due and its job running. */
const GRACE_MS = 10 * MINUTE;
/** A row this overdue has failed every recovery: it is shown dead rather than left pending. */
const GIVE_UP_MS = 7 * DAY;
const BATCH = 500;

export interface SweepResult {
  requeued: number;
  dead: number;
}

/**
 * Finds messages whose job is gone (the queue lost it, a worker died past its retries) and queues them again.
 * Per plant, under that plant's row security. A row whose job is merely a little late is left to that job; a row
 * overdue for over a week is marked dead (`stuck`), so the nightly purge never deletes a message nobody sent.
 */
export async function sweepNotifications(deps: {
  pool: Pool;
  boss: PgBoss;
  now: Date;
}): Promise<SweepResult> {
  const { pool, boss, now } = deps;
  const result: SweepResult = { requeued: 0, dead: 0 };
  for (const tenantId of await jobTenantIds(pool)) {
    await withTenant(pool, tenantId, async (tx) => {
      result.dead += await markStuckDead(tx, tenantId, new Date(now.getTime() - GIVE_UP_MS), now);
      const lost = await claimOverdue(tx, tenantId, {
        overdueBefore: new Date(now.getTime() - GRACE_MS),
        now,
        limit: BATCH,
      });
      for (const [attempt, rows] of groupByAttempt(lost))
        await queueSends(
          tx,
          boss,
          rows.map((r) => ({ tenantId, notificationId: r.id, attempt })),
          now,
        );
      result.requeued += lost.length;
    });
  }
  return result;
}

function groupByAttempt(rows: { id: string; attempts: number }[]): Map<number, { id: string }[]> {
  const groups = new Map<number, { id: string }[]>();
  for (const row of rows) groups.set(row.attempts, [...(groups.get(row.attempts) ?? []), row]);
  return groups;
}
