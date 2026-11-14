import type { Pool, PoolClient } from 'pg';
import type { PgBoss } from 'pg-boss';
import { withTenant, type JobRole } from './kernel/index.js';
import { jobTenantIds, purgeDeadSessions } from './modules/identity/index.js';
import { stripOldImportPayloads } from './modules/imports/index.js';
import { purgeRoster } from './modules/accountability/index.js';
import { purgeNotifications } from './modules/notifications/index.js';
import { figureDrift, purgeIdempotencyKeys, type DriftLine } from './modules/tickets/index.js';

/**
 * The nightly retention jobs and `figures.drift` (ticket 14). Each runs one customer at a time under that
 * customer's row security, takes the clock as an argument, and is a no-op on a second run. `audit.purge` is not
 * here: it is router-only (D24), so it is an operator command (`pnpm audit:purge`).
 */

const DAY = 86_400_000;
/** A job whose clock is further than this from the database's refuses to run: a wrong clock would purge too much. */
const MAX_CLOCK_SKEW_MS = DAY;

export interface RetentionResult {
  tenants: number;
  affected: number;
  report?: DriftLine[];
}

interface JobSpec {
  cron: string;
  run: (
    client: PoolClient,
    tenantId: string,
    now: Date,
  ) => Promise<{ affected: number; report?: DriftLine[] }>;
}

const before = (now: Date, days: number): Date => new Date(now.getTime() - days * DAY);
const count = (affected: number) => ({ affected });

const JOBS = {
  'session.purge': {
    cron: '10 2 * * *',
    run: async (c, t, now) => count(await purgeDeadSessions(c, t, before(now, 30))),
  },
  'idempotency.purge': {
    cron: '20 2 * * *',
    run: async (c, t, now) => count(await purgeIdempotencyKeys(c, t, before(now, 30))),
  },
  'import.purge': {
    cron: '30 2 * * *',
    run: async (c, t, now) => count(await stripOldImportPayloads(c, t, before(now, 365))),
  },
  'notification.purge': {
    cron: '40 2 * * *',
    run: async (c, t, now) => count(await purgeNotifications(c, t, before(now, 90))),
  },
  'roster.purge': {
    cron: '50 2 * * *',
    run: async (c, t, now) => count(await purgeRoster(c, t, before(now, 365))),
  },
  'figures.drift': {
    cron: '0 3 * * *',
    run: async (c, t) => {
      const report = await figureDrift(c, t);
      return { affected: report.length, report };
    },
  },
} satisfies Record<string, JobSpec>;

export type RetentionJobName = keyof typeof JOBS;
export const RETENTION_JOBS = Object.keys(JOBS) as RetentionJobName[];

export interface RetentionPayload {
  tenantId?: string;
}

async function assertClockNearDatabase(pool: Pool, name: string, now: Date): Promise<void> {
  const row = (await pool.query('SELECT clock_timestamp() AS t')).rows[0] as { t: Date };
  if (Math.abs(row.t.getTime() - now.getTime()) > MAX_CLOCK_SKEW_MS)
    throw new Error(
      `${name}: the clock (${now.toISOString()}) is more than 24 hours from the database's ` +
        `(${row.t.toISOString()}); nothing was changed`,
    );
}

/**
 * Runs one job for the named customer, or for every customer that still holds data. Refuses a clock more than 24
 * hours from the database's; only a test with a fake clock passes `allowFakeClock`.
 */
export async function runRetentionJob(
  pool: Pool,
  name: RetentionJobName,
  options: { now: Date; tenantId?: string; allowFakeClock?: boolean },
): Promise<RetentionResult> {
  if (!options.allowFakeClock) await assertClockNearDatabase(pool, name, options.now);
  const spec: JobSpec = JOBS[name];
  const tenantIds = options.tenantId ? [options.tenantId] : await jobTenantIds(pool);
  const result: RetentionResult = {
    tenants: 0,
    affected: 0,
    ...(name === 'figures.drift' ? { report: [] } : {}),
  };
  const errors: unknown[] = [];
  for (const tenantId of tenantIds) {
    try {
      const one = await withTenant(pool, tenantId, (client) =>
        spec.run(client, tenantId, options.now),
      );
      result.tenants += 1;
      result.affected += one.affected;
      result.report?.push(...(one.report ?? []));
    } catch (error) {
      errors.push(error);
    }
  }
  if (errors.length > 0) throw new AggregateError(errors, `${name} failed`);
  return result;
}

export interface RetentionDeps {
  pool: Pool;
  now?: () => Date;
  log?: (line: Record<string, unknown>) => void;
}

/** Creates the queues for every role and, unless the role is `api`, the workers and the nightly schedule (UTC). */
export async function startRetentionJobs(
  boss: PgBoss,
  deps: RetentionDeps,
  role: JobRole,
): Promise<void> {
  const now = deps.now ?? (() => new Date());
  const log = deps.log ?? ((line) => console.log(JSON.stringify(line)));
  for (const name of RETENTION_JOBS) {
    if (!(await boss.getQueue(name)))
      await boss.createQueue(name, {
        policy: 'standard',
        retryLimit: 1,
        retryDelay: 60,
        expireInSeconds: 1800,
      });
    if (role === 'api') continue;
    await boss.work<RetentionPayload>(
      name,
      { batchSize: 1, pollingIntervalSeconds: 30 },
      async ([job]) => {
        const payload = job?.data ?? {};
        if (payload.tenantId && !/^[0-9a-f-]{36}$/i.test(payload.tenantId))
          throw new Error(`Invalid ${name} tenant id`);
        const { report = [], ...summary } = await runRetentionJob(deps.pool, name, {
          now: now(),
          ...(payload.tenantId ? { tenantId: payload.tenantId } : {}),
        });
        log({ job: name, ...summary });
        for (const line of report) log({ job: name, drift: line });
        return summary;
      },
    );
    await boss.schedule(name, JOBS[name].cron, {}, { tz: 'UTC' });
  }
}
