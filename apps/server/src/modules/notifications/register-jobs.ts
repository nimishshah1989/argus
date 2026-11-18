import type { Pool, PoolClient } from 'pg';
import type { PgBoss } from 'pg-boss';
import { assertClockNearDatabase, withTenant, type JobRole } from '../../kernel/index.js';
import { activePerson, jobTenantIds } from '../identity/index.js';
import { dueRegisterItems, plantToday } from '../plant/index.js';
import { notify } from './notify.js';

/**
 * The daily `register.due` notice (ticket 51b, R8–R11). The rule is `plant`'s (`dueRegisterItems`); this job reads
 * it under each plant's row security, skips an owner who is switched off, and calls `notify` once per item per date
 * to the owner. It lives in `notifications` because `plant` may not call notifications (`manifest.ts`).
 */

export const REGISTER_DUE_QUEUE = 'register.due';
/** 00:15 UTC, after the night's retention jobs; the plant's own day decides which window is open. */
export const REGISTER_DUE_CRON = '15 0 * * *';
const QUEUE = {
  policy: 'standard',
  retryLimit: 1,
  retryDelay: 60,
  expireInSeconds: 600,
} as const;

export interface RegisterDueDeps {
  pool: Pool;
  /** Null records the rows without queueing a send (a test does this). */
  boss: PgBoss | null;
  now: Date;
  /** One customer only; the default fans out over `jobTenantIds()` like the retention jobs. */
  tenantId?: string;
  /** Only a test with a fake clock passes this. */
  allowFakeClock?: boolean;
}

export interface RegisterDueResult {
  tenants: number;
  notified: number;
}

/**
 * One customer's day: its due rows, then one `notify` per item with the key `register:<row id>:<watchOn>` (R10).
 * `notify` adds the person and channel, so a second run the same day writes nothing new, a new owner gets one
 * message, and a new date is a new window.
 */
async function notifyTenant(
  client: PoolClient,
  deps: RegisterDueDeps,
  tenantId: string,
): Promise<number> {
  const today = await plantToday(client, tenantId, deps.now);
  const items = await dueRegisterItems(client, tenantId, today);
  let notified = 0;
  for (const item of items) {
    if (!(await activePerson(client, tenantId, item.ownerPersonId))) continue;
    const [one] = await notify(client, deps.boss, {
      tenantId,
      to: [item.ownerPersonId],
      kind: REGISTER_DUE_QUEUE,
      dedupeKey: `register:${item.id}:${item.watchOn}`,
      now: deps.now,
    });
    if (one?.created) notified += 1;
  }
  return notified;
}

/**
 * Runs the notice for the named customer, or for every customer that still holds data. Refuses a clock more than
 * 24 hours from the database's before writing anything; only a test with a fake clock passes `allowFakeClock`.
 */
export async function runRegisterDue(deps: RegisterDueDeps): Promise<RegisterDueResult> {
  if (!deps.allowFakeClock) await assertClockNearDatabase(deps.pool, REGISTER_DUE_QUEUE, deps.now);
  const tenantIds = deps.tenantId ? [deps.tenantId] : await jobTenantIds(deps.pool);
  const result: RegisterDueResult = { tenants: 0, notified: 0 };
  const errors: unknown[] = [];
  for (const tenantId of tenantIds) {
    try {
      result.notified += await withTenant(deps.pool, tenantId, (client) =>
        notifyTenant(client, deps, tenantId),
      );
      result.tenants += 1;
    } catch (error) {
      errors.push(error);
    }
  }
  if (errors.length > 0) throw new AggregateError(errors, `${REGISTER_DUE_QUEUE} failed`);
  return result;
}

export interface RegisterJobDeps {
  pool: Pool;
  now?: () => Date;
}

/** Creates the queue for every role and, unless the role is `api`, the worker and the daily UTC schedule. */
export async function startRegisterJobs(
  boss: PgBoss,
  deps: RegisterJobDeps,
  role: JobRole,
): Promise<void> {
  if (!(await boss.getQueue(REGISTER_DUE_QUEUE))) await boss.createQueue(REGISTER_DUE_QUEUE, QUEUE);
  if (role === 'api') return;
  const now = deps.now ?? (() => new Date());
  await boss.work(REGISTER_DUE_QUEUE, { batchSize: 1, pollingIntervalSeconds: 30 }, async () => {
    const summary = await runRegisterDue({ pool: deps.pool, boss, now: now() });
    console.log(JSON.stringify({ job: REGISTER_DUE_QUEUE, ...summary }));
  });
  await boss.schedule(REGISTER_DUE_QUEUE, REGISTER_DUE_CRON, {}, { tz: 'UTC' });
}
