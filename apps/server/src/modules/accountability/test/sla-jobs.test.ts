import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { PgBoss, TestClock } from 'pg-boss';
import { Pool, type PoolClient } from 'pg';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { installJobSchema, withTenant } from '@uptimo/db';
import { runSlaConsistency } from '../consistency.js';
import { startJobs } from '../jobs.js';
import {
  processSlaTimerJob,
  rearmTicket,
  type SlaTimerPayload,
  type SlaTimerProjection,
} from '../repo/timers.js';

const A = '70000000-0000-0000-0000-000000000001';
const TICKET_A = '70000000-0000-0000-0000-000000000002';
const B = '80000000-0000-0000-0000-000000000001';
const TICKET_B = '80000000-0000-0000-0000-000000000002';
const PASSWORD = 'sla-jobs-test-password';
const MIGRATIONS = new URL('../../../../../../packages/db/migrations/', import.meta.url);
const START = new Date('2026-01-01T09:00:00Z');

let container: StartedPostgreSqlContainer;
let admin: Pool;
let app: Pool;
let appUrl: string;
let boss: PgBoss;

function projection(patch: Partial<SlaTimerProjection> = {}): SlaTimerProjection {
  return {
    kind: 'ack',
    state: 'running',
    breached: false,
    dueAt: new Date('2026-01-01T09:05:00Z'),
    pausedAt: null,
    stoppedAt: null,
    stopReason: null,
    ...patch,
  };
}

async function makeTicket(tenantId = A): Promise<string> {
  const id = randomUUID();
  await admin.query(
    `INSERT INTO ticket (id, tenant_id, ref, kind, status, problem, reported_at, severity)
     VALUES ($1, $2, $3, 'stopped', 'open', 'SLA job test', $4, 'S1')`,
    [id, tenantId, `BD-${id.slice(0, 8)}`, START],
  );
  return id;
}

async function timerRow(tenantId: string, ticketId: string, kind = 'ack') {
  return withTenant(app, tenantId, async (client) => {
    const result = await client.query(
      'SELECT * FROM sla_timer WHERE tenant_id = $1 AND ticket_id = $2 AND kind = $3',
      [tenantId, ticketId, kind],
    );
    return result.rows[0];
  });
}

async function liveJobs(key: string) {
  const jobs = await boss.findJobs<SlaTimerPayload>('sla.timer', { key });
  return jobs.filter((job) => ['created', 'retry', 'active'].includes(job.state));
}

// Waits until the injected first failure has happened. The job's `retry` state is transient: the
// test clock has already passed its start_after, so the worker may re-pick it and complete it
// before a poll sees `retry`. Later assertions pin attempts === 2 and the completed outcome.
async function waitForPersistedRetry(jobId: string): Promise<void> {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const job = await admin.query('SELECT state FROM pgboss.job WHERE id = $1', [jobId]);
    const attempts = await admin.query('SELECT last_value FROM sla_fire_attempt');
    const state = job.rows[0]?.state;
    if (
      ['retry', 'active', 'completed'].includes(state) &&
      Number(attempts.rows[0]?.last_value) >= 1
    ) {
      return;
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`SLA job ${jobId} did not reach retry after its first attempt`);
}

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:16-alpine').start();
  admin = new Pool({ connectionString: container.getConnectionUri(), max: 3 });
  for (const file of readdirSync(MIGRATIONS)
    .filter((name) => name.endsWith('.sql'))
    .sort()) {
    await admin.query(readFileSync(new URL(file, MIGRATIONS), 'utf8'));
  }
  await installJobSchema(admin);
  await admin.query(`ALTER ROLE app_api LOGIN PASSWORD '${PASSWORD}'`);
  // TestClock creates its clock table as the runtime role; production never receives this grant.
  await admin.query('GRANT CREATE ON SCHEMA pgboss TO app_api');
  await admin.query('ALTER FUNCTION pgboss.job_now() OWNER TO app_api');
  await admin.query(
    "INSERT INTO tenant (id, slug, name) VALUES ($1, 'sla-a', 'SLA A'), ($2, 'sla-b', 'SLA B')",
    [A, B],
  );
  await admin.query(
    `INSERT INTO ticket (id, tenant_id, ref, kind, status, problem, reported_at, severity)
     VALUES ($2, $1, 'BD-A', 'stopped', 'open', 'A', $5, 'S1'),
            ($4, $3, 'BD-B', 'stopped', 'open', 'B', $5, 'S1')`,
    [A, TICKET_A, B, TICKET_B, START],
  );
  await admin.query(
    `INSERT INTO sla_policy (tenant_id, severity, ack_minutes, restore_minutes)
     VALUES ($1, 'S1', 5, 30), ($2, 'S1', 5, 30)`,
    [A, B],
  );
  appUrl = `postgresql://app_api:${PASSWORD}@${container.getHost()}:${container.getPort()}/${container.getDatabase()}`;
  app = new Pool({ connectionString: appUrl, max: 5 });
  boss = new PgBoss({
    connectionString: appUrl,
    migrate: false,
    schedule: false,
    supervise: false,
    openTelemetry: { enabled: false },
  });
  await boss.start();
  await boss.createQueue('sla.timer');
}, 120_000);

afterAll(async () => {
  await boss?.stop();
  await app?.end();
  await admin?.end();
  await container?.stop();
});

it('arms a running unbreached timer with a tenant-scoped singleton key', async () => {
  await withTenant(app, A, (client) =>
    rearmTicket(client, boss, {
      tenantId: A,
      ticketId: TICKET_A,
      timers: [projection()],
      now: START,
    }),
  );

  const timer = await timerRow(A, TICKET_A);
  expect(timer).toMatchObject({ tenant_id: A, ticket_id: TICKET_A, state: 'running', revision: 1 });
  expect(timer.job_id).toMatch(/[0-9a-f-]{36}/);
  const key = `${A}:${TICKET_A}:ack`;
  const jobs = await liveJobs(key);
  expect(jobs).toHaveLength(1);
  expect(jobs[0]).toMatchObject({
    singletonKey: key,
    data: { tenantId: A, ticketId: TICKET_A, kind: 'ack', revision: 1 },
  });
  expect(jobs[0]!.startAfter.toISOString()).toBe('2026-01-01T09:05:00.000Z');
});

it('rolls back the timer and its queued job with the tenant transaction', async () => {
  const failure = new Error('rollback probe');
  await expect(
    withTenant(app, B, async (client) => {
      await rearmTicket(client, boss, {
        tenantId: B,
        ticketId: TICKET_B,
        timers: [projection()],
        now: START,
      });
      throw failure;
    }),
  ).rejects.toBe(failure);

  expect(await timerRow(B, TICKET_B)).toBeUndefined();
  expect(await liveJobs(`${B}:${TICKET_B}:ack`)).toEqual([]);
});

it('processes a paused breached timer immediately and only once', async () => {
  const ticketId = await makeTicket();
  const pausedAt = new Date('2026-01-01T08:55:00Z');
  await withTenant(app, A, (client) =>
    rearmTicket(client, boss, {
      tenantId: A,
      ticketId,
      timers: [projection({ state: 'paused', breached: true, dueAt: START, pausedAt })],
      now: START,
    }),
  );
  const jobs = await liveJobs(`${A}:${ticketId}:ack`);
  expect(jobs).toHaveLength(1);
  expect(jobs[0]!.startAfter.toISOString()).toBe(START.toISOString());

  const runtime = { pool: app, now: () => START };
  expect(await processSlaTimerJob(jobs[0]!.data as SlaTimerPayload, runtime)).toBe(true);
  expect(await processSlaTimerJob(jobs[0]!.data as SlaTimerPayload, runtime)).toBe(false);
  const timer = await timerRow(A, ticketId);
  expect(timer.state).toBe('paused');
  expect(timer.fired_at.toISOString()).toBe(START.toISOString());
});

it('processes late stops, excludes cancellation, and never automatically re-fires', async () => {
  const lateTicket = await makeTicket();
  const stoppedAt = new Date('2026-01-01T09:01:00Z');
  const late = projection({
    state: 'stopped',
    breached: true,
    dueAt: START,
    stoppedAt,
    stopReason: 'closed',
  });
  await withTenant(app, A, (client) =>
    rearmTicket(client, boss, { tenantId: A, ticketId: lateTicket, timers: [late], now: START }),
  );
  const lateJobs = await liveJobs(`${A}:${lateTicket}:ack`);
  expect(lateJobs).toHaveLength(1);
  const runtime = { pool: app, now: () => START };
  expect(await processSlaTimerJob(lateJobs[0]!.data as SlaTimerPayload, runtime)).toBe(true);

  await withTenant(app, A, (client) =>
    rearmTicket(client, boss, {
      tenantId: A,
      ticketId: lateTicket,
      timers: [projection({ dueAt: new Date('2026-01-01T10:00:00Z') })],
      now: new Date('2026-01-01T09:02:00Z'),
    }),
  );
  const corrected = await timerRow(A, lateTicket);
  expect(corrected.revision).toBe(2);
  expect(corrected.fired_at.toISOString()).toBe(START.toISOString());
  expect(await liveJobs(`${A}:${lateTicket}:ack`)).toEqual([]);

  const cancelledTicket = await makeTicket();
  const cancelled = projection({
    state: 'stopped',
    breached: true,
    dueAt: START,
    stoppedAt,
    stopReason: 'cancelled',
  });
  await withTenant(app, A, (client) =>
    rearmTicket(client, boss, {
      tenantId: A,
      ticketId: cancelledTicket,
      timers: [cancelled],
      now: START,
    }),
  );
  expect(await liveJobs(`${A}:${cancelledTicket}:ack`)).toEqual([]);
  expect(
    await processSlaTimerJob(
      { tenantId: A, ticketId: cancelledTicket, kind: 'ack', revision: 1 },
      runtime,
    ),
  ).toBe(false);
});

it('cancels the previous active revision and ignores its stale handler', async () => {
  await boss.deleteAllJobs('sla.timer');
  const ticketId = await makeTicket();
  await withTenant(app, A, (client) =>
    rearmTicket(client, boss, {
      tenantId: A,
      ticketId,
      timers: [projection({ dueAt: START })],
      now: START,
    }),
  );
  const [active] = await boss.fetch<SlaTimerPayload>('sla.timer', { ignoreStartAfter: true });
  expect(active).toBeDefined();
  if (!active) throw new Error('Expected an active SLA timer job');
  expect(active.data.revision).toBe(1);

  await withTenant(app, A, (client) =>
    rearmTicket(client, boss, {
      tenantId: A,
      ticketId,
      timers: [projection({ dueAt: new Date('2026-01-01T09:06:00Z') })],
      now: new Date('2026-01-01T09:01:00Z'),
    }),
  );
  const runtime = { pool: app, now: () => new Date('2026-01-01T09:06:00Z') };
  expect(await processSlaTimerJob(active.data, runtime)).toBe(false);
  const jobs = await liveJobs(`${A}:${ticketId}:ack`);
  expect(jobs).toHaveLength(1);
  expect(jobs[0]!.data.revision).toBe(2);
  expect(await processSlaTimerJob(jobs[0]!.data as SlaTimerPayload, runtime)).toBe(true);
});

it('reconciles every policy tenant idempotently without backfills or cross-tenant writes', async () => {
  const ticketA = await makeTicket(A);
  const ticketB = await makeTicket(B);
  const backfill = await makeTicket(A);
  await admin.query("UPDATE ticket SET raised_channel='backfill' WHERE id=$1", [backfill]);
  const seen: Array<{ tenantId: string; ticketId: string }> = [];
  const reconcileTicket = async (
    client: PoolClient,
    tenantId: string,
    ticketId: string,
    now: Date,
  ) => {
    seen.push({ tenantId, ticketId });
    await rearmTicket(client, boss, {
      tenantId,
      ticketId,
      timers: [projection({ dueAt: new Date('2026-01-01T10:00:00Z') })],
      now,
    });
  };
  const options = { pool: app, reconcileTicket, now: START };
  const first = await runSlaConsistency(options);
  expect(first.tenants).toBe(2);
  expect(seen).toContainEqual({ tenantId: A, ticketId: ticketA });
  expect(seen).toContainEqual({ tenantId: B, ticketId: ticketB });
  expect(seen).not.toContainEqual({ tenantId: A, ticketId: backfill });
  expect(await liveJobs(`${A}:${ticketA}:ack`)).toHaveLength(1);
  expect(await liveJobs(`${B}:${ticketB}:ack`)).toHaveLength(1);

  await runSlaConsistency(options);
  expect((await timerRow(A, ticketA)).revision).toBe(1);
  expect((await timerRow(B, ticketB)).revision).toBe(1);
  expect(await liveJobs(`${A}:${ticketA}:ack`)).toHaveLength(1);
  expect(await liveJobs(`${B}:${ticketB}:ack`)).toHaveLength(1);
});

it('starts daily scheduling and fires deferred ARM with the real TestClock', async () => {
  await boss.deleteAllJobs('sla.timer');
  const clock = new TestClock(START);
  const errors: Error[] = [];
  const handle = await startJobs({
    connectionString: appUrl,
    pool: app,
    role: 'all',
    clock,
    reconcileTicket: async () => undefined,
    pollingIntervalSeconds: 0.5,
    dailyConsistency: true,
    bootConsistency: false,
    __test__enableSpies: true,
    onError: (error) => errors.push(error),
  });
  try {
    const schedule = await handle.boss.getSchedule('sla.consistency', 'all');
    expect(schedule).toMatchObject({
      cron: '0 4 * * *',
      timezone: 'UTC',
      options: { missed: 'once' },
    });
    const spy = handle.boss.getSpy<SlaTimerPayload>('sla.timer');
    const ticketId = await makeTicket();
    await withTenant(app, A, (client) =>
      rearmTicket(client, handle.boss, {
        tenantId: A,
        ticketId,
        timers: [projection({ dueAt: new Date('2026-01-01T09:01:00Z') })],
        now: START,
      }),
    );
    const timer = await timerRow(A, ticketId);
    await clock.tick(59_000);
    expect((await timerRow(A, ticketId)).fired_at).toBeNull();
    await clock.tick(1_000);
    // The last poll landed just before dueAt; advance once more to the next poll.
    await clock.tick(1_000);
    const outcome = await Promise.race([
      spy.waitForJobWithId(timer.job_id, 'completed'),
      spy.waitForJobWithId(timer.job_id, 'failed'),
    ]);
    expect(outcome.state).toBe('completed');
    const firedAt = (await timerRow(A, ticketId)).fired_at as Date;
    expect(firedAt.getTime()).toBeGreaterThanOrEqual(new Date('2026-01-01T09:01:00Z').getTime());
    expect(firedAt.getTime()).toBeLessThanOrEqual(clock.now());
    expect(errors).toEqual([]);
  } finally {
    await handle.close();
  }
});

it('retries a transient failure without firing twice', async () => {
  await boss.deleteAllJobs('sla.timer');
  const clock = new TestClock(START);
  const handle = await startJobs({
    connectionString: appUrl,
    pool: app,
    role: 'worker',
    clock,
    reconcileTicket: async () => undefined,
    pollingIntervalSeconds: 0.5,
    dailyConsistency: false,
    bootConsistency: false,
    __test__enableSpies: true,
  });
  try {
    await admin.query(
      'CREATE SEQUENCE sla_fire_attempt; GRANT USAGE ON SEQUENCE sla_fire_attempt TO app_user',
    );
    await admin.query(`
      CREATE FUNCTION fail_first_sla_fire() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.fired_at IS NOT NULL AND OLD.fired_at IS NULL THEN
          IF nextval('sla_fire_attempt') = 1 THEN RAISE EXCEPTION 'injected retry';
          END IF;
        END IF;
        RETURN NEW;
      END $$;
      CREATE TRIGGER fail_first_sla_fire BEFORE UPDATE ON sla_timer
        FOR EACH ROW EXECUTE FUNCTION fail_first_sla_fire();
    `);
    const spy = handle.boss.getSpy<SlaTimerPayload>('sla.timer');
    const ticketId = await makeTicket();
    await withTenant(app, A, (client) =>
      rearmTicket(client, handle.boss, {
        tenantId: A,
        ticketId,
        timers: [projection({ breached: true, dueAt: START })],
        now: START,
      }),
    );
    const timer = await timerRow(A, ticketId);
    const [job] = await liveJobs(`${A}:${ticketId}:ack`);
    await clock.tick(1_000);
    await waitForPersistedRetry(timer.job_id);
    await clock.tick(5_000);
    const outcome = await Promise.race([
      spy.waitForJobWithId(timer.job_id, 'completed'),
      spy.waitForJobWithId(timer.job_id, 'failed'),
    ]);
    expect(outcome.state).toBe('completed');
    const attempts = await admin.query('SELECT last_value FROM sla_fire_attempt');
    expect(attempts.rows[0].last_value).toBe('2');
    expect((await timerRow(A, ticketId)).fired_at).not.toBeNull();
    expect(
      await processSlaTimerJob(job!.data, { pool: app, now: () => new Date(clock.now()) }),
    ).toBe(false);
  } finally {
    await handle.close();
    await admin.query(
      'DROP TRIGGER fail_first_sla_fire ON sla_timer; DROP FUNCTION fail_first_sla_fire(); DROP SEQUENCE sla_fire_attempt;',
    );
  }
}, 60_000);

it('fires paused+breached work on the next real worker poll', async () => {
  await boss.deleteAllJobs('sla.timer');
  const clock = new TestClock(START);
  const handle = await startJobs({
    connectionString: appUrl,
    pool: app,
    role: 'worker',
    clock,
    reconcileTicket: async () => undefined,
    pollingIntervalSeconds: 0.5,
    dailyConsistency: false,
    bootConsistency: false,
    __test__enableSpies: true,
  });
  try {
    const spy = handle.boss.getSpy<SlaTimerPayload>('sla.timer');
    const ticketId = await makeTicket();
    await withTenant(app, A, (client) =>
      rearmTicket(client, handle.boss, {
        tenantId: A,
        ticketId,
        timers: [
          projection({
            state: 'paused',
            breached: true,
            dueAt: START,
            pausedAt: new Date('2026-01-01T08:55:00Z'),
          }),
        ],
        now: START,
      }),
    );
    const timer = await timerRow(A, ticketId);
    await clock.tick(2_000);
    await spy.waitForJobWithId(timer.job_id, 'completed');
    expect((await timerRow(A, ticketId)).fired_at).not.toBeNull();
  } finally {
    await handle.close();
  }
});

it('the real worker fires a pause clock once, on the fake clock', async () => {
  await boss.deleteAllJobs('sla.timer');
  const clock = new TestClock(START);
  const handle = await startJobs({
    connectionString: appUrl,
    pool: app,
    role: 'worker',
    clock,
    reconcileTicket: async () => undefined,
    pollingIntervalSeconds: 0.5,
    dailyConsistency: false,
    bootConsistency: false,
    __test__enableSpies: true,
  });
  try {
    const spy = handle.boss.getSpy<SlaTimerPayload>('sla.timer');
    const ticketId = await makeTicket();
    const dueAt = new Date(START.getTime() + 60_000);
    await withTenant(app, A, (client) =>
      rearmTicket(client, handle.boss, {
        tenantId: A,
        ticketId,
        timers: [projection({ kind: 'pause', dueAt })],
        now: START,
      }),
    );
    const timer = await timerRow(A, ticketId, 'pause');
    // A tick runs one database round-trip per simulated poll, so keep the simulated span short.
    await clock.tick(59_000);
    expect((await timerRow(A, ticketId, 'pause')).fired_at).toBeNull();
    await clock.tick(1_000);
    // The last poll landed just before dueAt; advance once more to the next poll.
    await clock.tick(1_000);
    await spy.waitForJobWithId(timer.job_id, 'completed');
    const fired = (await timerRow(A, ticketId, 'pause')).fired_at as Date;
    expect(fired.getTime()).toBeGreaterThanOrEqual(dueAt.getTime());
    await clock.tick(60_000);
    expect(((await timerRow(A, ticketId, 'pause')).fired_at as Date).getTime()).toBe(
      fired.getTime(),
    );
  } finally {
    await handle.close();
  }
}, 60_000);
