import { hash } from '@node-rs/argon2';
import type { Pool, PoolClient } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import type { AppConfig } from '../src/kernel/index.js';
import type { PgBoss } from 'pg-boss';
import { startTestDb, type TestDb } from './harness.js';
import {
  processSlaTimerJob,
  type SlaTimerPayload,
} from '../src/modules/accountability/repo/timers.js';
import { reconcileSlaPolicies, reconcileTicket } from '../src/modules/accountability/sla.js';
import { lockRefCounter } from '../src/modules/tickets/repo/ticket.js';
import { jobDb } from '../src/kernel/index.js';
import { withTenant } from '@uptimo/db';
import { runSlaConsistency } from '../src/modules/accountability/consistency.js';

const TENANT = '60000000-0000-0000-0000-000000000001';
const MACHINE = '60000000-0000-0000-0000-000000000002';
const ASHA = '60000000-0000-0000-0000-000000000003';
const CRITICALITY_MACHINE = '60000000-0000-0000-0000-000000000006';
const EARLY_MACHINE = '60000000-0000-0000-0000-000000000007';
const CORRECTION_MACHINE = '60000000-0000-0000-0000-000000000008';
const RACE_MACHINE = '60000000-0000-0000-0000-000000000009';
const POLICY_RACE_A = {
  tenant: '60000000-0000-0000-0000-000000000010',
  machine: '60000000-0000-0000-0000-000000000011',
  person: '60000000-0000-0000-0000-000000000012',
  login: '60000000-0000-0000-0000-000000000013',
  ticket: '60000000-0000-0000-0000-000000000014',
  slug: 'sla-race-a',
};
const POLICY_RACE_B = {
  tenant: '60000000-0000-0000-0000-000000000020',
  machine: '60000000-0000-0000-0000-000000000021',
  person: '60000000-0000-0000-0000-000000000022',
  login: '60000000-0000-0000-0000-000000000023',
  ticket: '60000000-0000-0000-0000-000000000024',
  slug: 'sla-race-b',
};
const CRITICALITY_RACE = {
  tenant: '60000000-0000-0000-0000-000000000030',
  machine: '60000000-0000-0000-0000-000000000031',
  person: '60000000-0000-0000-0000-000000000032',
  login: '60000000-0000-0000-0000-000000000033',
  ticket: '60000000-0000-0000-0000-000000000034',
  slug: 'sla-criticality-race',
};
const LOCK_ORDER_RACE = {
  tenant: '60000000-0000-0000-0000-000000000040',
  machine: '60000000-0000-0000-0000-000000000041',
  person: '60000000-0000-0000-0000-000000000042',
  login: '60000000-0000-0000-0000-000000000043',
  ticket: '60000000-0000-0000-0000-000000000044',
  firstTicket: '60000000-0000-0000-0000-000000000045',
  secondTicket: '60000000-0000-0000-0000-000000000046',
  slug: 'sla-lock-order',
};
const LOGIN_ASHA = '60000000-0000-0000-0000-000000000004';
const LOGIN_ADMIN = '60000000-0000-0000-0000-000000000005';
const PASSWORD = 'correct-horse-battery';

type App = Awaited<ReturnType<typeof buildApp>>;
type Res = Awaited<ReturnType<App['inject']>>;
let db: TestDb;
let admin: Pool;
let app: App;
let ashaToken = '';
let adminToken = '';
let boss: PgBoss;
let key = 0;

function post(url: string, token: string, payload: unknown, host = 'sla.localhost'): Promise<Res> {
  key += 1;
  return app.inject({
    method: 'POST',
    url,
    headers: {
      host,
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
      'idempotency-key': `sla-${key}`,
    },
    payload: payload as object,
  });
}

async function login(username: string, host = 'sla.localhost'): Promise<string> {
  const res = await post('/api/v1/auth/login', '', { username, password: PASSWORD }, host);
  expect(res.statusCode).toBe(200);
  return res.json().token as string;
}

const policies = [
  { severity: 'S1', ackMinutes: 60, restoreMinutes: 240, businessHoursOnly: false },
  { severity: 'S2', ackMinutes: 90, restoreMinutes: 360, businessHoursOnly: false },
  { severity: 'S3', ackMinutes: 120, restoreMinutes: 480, businessHoursOnly: false },
  { severity: 'S4', ackMinutes: 180, restoreMinutes: 720, businessHoursOnly: false },
];

beforeAll(async () => {
  db = await startTestDb();
  admin = db.admin;
  const passwordHash = await hash(PASSWORD, {
    algorithm: 2,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
  await admin.query("INSERT INTO tenant (id, slug, name) VALUES ($1, 'sla', 'SLA')", [TENANT]);
  await admin.query(
    `INSERT INTO machine (id, tenant_id, code, criticality) VALUES
      ($1, $4, 'VC-SLA', 'A'), ($2, $4, 'VC-CRITICALITY', 'A'), ($3, $4, 'VC-EARLY', 'A'),
      ($5, $4, 'VC-CORRECTION', 'A'), ($6, $4, 'VC-RACE', 'A')`,
    [MACHINE, CRITICALITY_MACHINE, EARLY_MACHINE, TENANT, CORRECTION_MACHINE, RACE_MACHINE],
  );
  await admin.query(
    "INSERT INTO person (id, tenant_id, name, team) VALUES ($1, $2, 'Asha', 'maintenance')",
    [ASHA, TENANT],
  );
  await admin.query(
    `INSERT INTO login (id, tenant_id, person_id, username, password_hash, role, shared) VALUES
      ($1, $3, $4, 'asha', $5, 'technician', false), ($2, $3, $4, 'admin', $5, 'admin', false)`,
    [LOGIN_ASHA, LOGIN_ADMIN, TENANT, ASHA, passwordHash],
  );
  await admin.query(
    "INSERT INTO ref_counter (tenant_id, prefix, next_value) VALUES ($1, 'BD', 1)",
    [TENANT],
  );
  await admin.query(
    "INSERT INTO list_item (tenant_id, list, code, label, is_vendor, pauses_sla) VALUES ($1, 'wait_reason', 'spare', 'Spare part', false, true), ($1, 'wait_reason', 'vendor', 'Vendor service', true, false)",
    [TENANT],
  );
  const config: AppConfig = { pool: db.app, logger: false, rateLimitMax: 100000 };
  app = await buildApp(config);
  boss = config.jobBoss!;
  ashaToken = await login('asha');
  adminToken = await login('admin');
  const saved = await put('/api/v1/settings/sla-policies', adminToken, { policies });
  expect(saved.statusCode).toBe(200);
}, 120_000);

afterAll(async () => {
  await app.close();
  await db.stop();
});

function ticketPost(url: string, payload: unknown, token = ashaToken): Promise<Res> {
  return post(url, token, payload);
}

async function liveJobKeys(ticketId: string): Promise<string[]> {
  const jobs = await admin.query(
    `SELECT singleton_key FROM pgboss.job
     WHERE name = 'sla.timer' AND state IN ('created', 'retry', 'active') AND singleton_key LIKE $1`,
    [`${TENANT}:${ticketId}:%`],
  );
  return jobs.rows.map((job) => job.singleton_key);
}

async function waitForLockWaiters(pool: Pool, timeoutMs = 10_000): Promise<number> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const activity = await pool.query(
      "SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock' AND pid <> pg_backend_pid()",
    );
    const waiting = activity.rows[0].n as number;
    if (waiting > 0) return waiting;
    if (Date.now() > deadline) throw new Error('Timed out waiting for ticket lock waiter');
    await new Promise<void>((resolve) => setTimeout(resolve, 10));
  }
}

function put(url: string, token: string, payload: unknown, host = 'sla.localhost'): Promise<Res> {
  key += 1;
  return app.inject({
    method: 'PUT',
    url,
    headers: {
      host,
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
      'idempotency-key': `sla-${key}`,
    },
    payload: payload as object,
  });
}

type RaceIds = typeof POLICY_RACE_A;

async function preparePolicyRace(ids: RaceIds): Promise<{ token: string; host: string }> {
  const host = `${ids.slug}.localhost`;
  await admin.query("INSERT INTO tenant (id, slug, name) VALUES ($1, $2, 'SLA race')", [
    ids.tenant,
    ids.slug,
  ]);
  await admin.query(
    "INSERT INTO machine (id, tenant_id, code, criticality) VALUES ($1, $2, 'VC-POLICY-RACE', 'A')",
    [ids.machine, ids.tenant],
  );
  await admin.query("INSERT INTO person (id, tenant_id, name) VALUES ($1, $2, 'Race Admin')", [
    ids.person,
    ids.tenant,
  ]);
  await admin.query(
    `INSERT INTO login (id, tenant_id, person_id, username, password_hash, role, shared)
     SELECT $1, $2, $3, 'race-admin', password_hash, 'admin', false FROM login WHERE id = $4`,
    [ids.login, ids.tenant, ids.person, LOGIN_ADMIN],
  );
  await admin.query(
    "INSERT INTO ref_counter (tenant_id, prefix, next_value) VALUES ($1, 'BD', 1)",
    [ids.tenant],
  );
  await admin.query(
    "INSERT INTO ticket (id, tenant_id, ref, kind, status, problem, reported_at, severity) VALUES ($1, $2, 'BD-EXISTING', 'stopped', 'open', 'Existing candidate', now(), 'S1')",
    [ids.ticket, ids.tenant],
  );
  return { token: await login('race-admin', host), host };
}

async function waitForAdvisoryWait(key: string): Promise<boolean> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const result = await admin.query(
      `SELECT 1 FROM pg_locks
       WHERE locktype = 'advisory' AND NOT granted AND objid = hashtext($1)
         AND database = (SELECT oid FROM pg_database WHERE datname = current_database()) LIMIT 1`,
      [key],
    );
    if (result.rowCount === 1) return true;
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
  return false;
}

async function waitForMinimumLockWaiters(minimum: number): Promise<boolean> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const result = await admin.query(
      "SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock' AND pid <> pg_backend_pid()",
    );
    if (result.rows[0].n >= minimum) return true;
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
  return false;
}

async function installPolicyRaceBarriers(ids: RaceIds): Promise<PoolClient> {
  const client = await admin.connect();
  const policyKey = `sla-policy-scan:${ids.tenant}`;
  const raiseKey = `sla-raise-insert:${ids.tenant}`;
  await client.query('SELECT pg_advisory_lock(hashtext($1)), pg_advisory_lock(hashtext($2))', [
    policyKey,
    raiseKey,
  ]);
  await client.query(`
    CREATE OR REPLACE FUNCTION race_policy_block() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      PERFORM pg_advisory_xact_lock(hashtext('${policyKey}'));
      RETURN NEW;
    END $$;
    CREATE OR REPLACE FUNCTION race_raise_block() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      PERFORM pg_advisory_xact_lock(hashtext('${raiseKey}'));
      RETURN NEW;
    END $$;
    CREATE TRIGGER race_policy_block BEFORE INSERT ON sla_timer
      FOR EACH ROW EXECUTE FUNCTION race_policy_block();
    CREATE TRIGGER race_raise_block BEFORE INSERT ON ticket
      FOR EACH ROW EXECUTE FUNCTION race_raise_block();
  `);
  return client;
}

async function releaseAdvisory(client: PoolClient, key: string): Promise<void> {
  await client.query('SELECT pg_advisory_unlock(hashtext($1))', [key]);
}

async function cleanupPolicyRace(client: PoolClient): Promise<void> {
  await client.query('SELECT pg_advisory_unlock_all()');
  await client.query(`
    DROP TRIGGER IF EXISTS race_policy_block ON sla_timer;
    DROP TRIGGER IF EXISTS race_raise_block ON ticket;
    DROP FUNCTION IF EXISTS race_policy_block();
    DROP FUNCTION IF EXISTS race_raise_block();
  `);
  client.release();
}

async function assertPolicyRaceTimers(ids: RaceIds, ticketId: string): Promise<void> {
  const timers = (
    await admin.query('SELECT kind, state, due_at FROM sla_timer WHERE ticket_id = $1', [ticketId])
  ).rows;
  expect(timers).toHaveLength(2);
  for (const timer of timers) {
    expect(timer.state).toBe('running');
    const jobs = await admin.query(
      `SELECT singleton_key, data, start_after FROM pgboss.job
       WHERE name = 'sla.timer' AND singleton_key = $1 AND state IN ('created', 'retry', 'active')`,
      [`${ids.tenant}:${ticketId}:${timer.kind}`],
    );
    expect(jobs.rows).toHaveLength(1);
    expect(jobs.rows[0].data.revision).toBe(1);
    expect(jobs.rows[0].start_after.toISOString()).toBe(timer.due_at.toISOString());
  }
}

async function runPolicyRaiseRace(
  ids: RaceIds,
  order: 'policy-first' | 'raise-first',
): Promise<void> {
  const { token, host } = await preparePolicyRace(ids);
  const client = await installPolicyRaceBarriers(ids);
  const policyKey = `sla-policy-scan:${ids.tenant}`;
  const raiseKey = `sla-raise-insert:${ids.tenant}`;
  const policy = () => put('/api/v1/settings/sla-policies', token, { policies }, host);
  const raise = () =>
    post(
      '/api/v1/tickets',
      token,
      { machineId: ids.machine, problem: 'Initial policy race' },
      host,
    );
  let policyResult: Promise<Res> | undefined;
  let raiseResult: Promise<Res> | undefined;
  try {
    if (order === 'policy-first') {
      policyResult = policy();
      expect(await waitForAdvisoryWait(policyKey)).toBe(true);
      raiseResult = raise();
      if (await waitForAdvisoryWait(raiseKey)) {
        await releaseAdvisory(client, raiseKey);
        await releaseAdvisory(client, policyKey);
      } else {
        await releaseAdvisory(client, policyKey);
        expect(await waitForAdvisoryWait(raiseKey)).toBe(true);
        await releaseAdvisory(client, raiseKey);
      }
    } else {
      raiseResult = raise();
      expect(await waitForAdvisoryWait(raiseKey)).toBe(true);
      policyResult = policy();
      await releaseAdvisory(client, raiseKey);
      expect(await waitForAdvisoryWait(policyKey)).toBe(true);
      await releaseAdvisory(client, policyKey);
    }
    const [saved, raised] = await Promise.all([policyResult, raiseResult]);
    expect(saved?.statusCode).toBe(200);
    expect(raised?.statusCode).toBe(201);
    const ticketId = raised?.json().ticket.id as string;
    const found = await admin.query(
      `SELECT 1 FROM ticket t JOIN sla_policy p ON p.tenant_id = t.tenant_id AND p.severity = t.severity
        WHERE t.id = $1`,
      [ticketId],
    );
    expect(found.rows).toHaveLength(1);
    await assertPolicyRaceTimers(ids, ticketId);
  } finally {
    await cleanupPolicyRace(client);
    await Promise.allSettled([policyResult, raiseResult]);
  }
}

async function runCriticalityRaiseRace(ids: RaceIds): Promise<void> {
  const { token, host } = await preparePolicyRace(ids);
  expect((await put('/api/v1/settings/sla-policies', token, { policies }, host)).statusCode).toBe(
    200,
  );
  let markLocked!: () => void;
  let releaseUpdate!: () => void;
  const locked = new Promise<void>((resolve) => {
    markLocked = resolve;
  });
  const release = new Promise<void>((resolve) => {
    releaseUpdate = resolve;
  });
  let raisedResult: Promise<Res> | undefined;
  const criticality = withTenant(db.app, ids.tenant, async (client) => {
    await lockRefCounter(client, ids.tenant, 'BD');
    markLocked();
    await release;
    await client.query("UPDATE machine SET criticality = 'C' WHERE id = $1 AND tenant_id = $2", [
      ids.machine,
      ids.tenant,
    ]);
    await client.query(
      "UPDATE ticket SET severity = 'S3' WHERE machine_id = $1 AND tenant_id = $2",
      [ids.machine, ids.tenant],
    );
    await reconcileSlaPolicies(client, ids.tenant, boss);
  });
  try {
    await locked;
    raisedResult = post(
      '/api/v1/tickets',
      token,
      { machineId: ids.machine, problem: 'Criticality raise race' },
      host,
    );
    expect(await waitForAdvisoryWait(`ref-counter:${ids.tenant}:BD`)).toBe(true);
    releaseUpdate();
    const [raised] = await Promise.all([raisedResult, criticality]);
    expect(raised?.statusCode).toBe(201);
    const ticketId = raised?.json().ticket.id as string;
    const ticket = (await admin.query('SELECT severity FROM ticket WHERE id = $1', [ticketId]))
      .rows[0];
    expect(ticket.severity).toBe('S3');
    await assertPolicyRaceTimers(ids, ticketId);
  } finally {
    releaseUpdate();
    await Promise.allSettled([criticality, raisedResult]);
  }
}

async function runLockOrderRace(
  ids: RaceIds & { firstTicket: string; secondTicket: string },
): Promise<void> {
  const { token, host } = await preparePolicyRace(ids);
  for (const [id, ref] of [
    [ids.secondTicket, 'BD-B'],
    [ids.firstTicket, 'BD-A'],
  ]) {
    await admin.query(
      "INSERT INTO ticket (id, tenant_id, ref, kind, status, problem, reported_at, severity) VALUES ($1, $2, $3, 'stopped', 'open', 'Lock order', now(), 'S1')",
      [id, ids.tenant, ref],
    );
  }
  expect((await put('/api/v1/settings/sla-policies', token, { policies }, host)).statusCode).toBe(
    200,
  );
  const key = `sla-lock-order:${ids.tenant}`;
  const client = await admin.connect();
  await client.query('SELECT pg_advisory_lock(hashtext($1))', [key]);
  await client.query(`
    CREATE OR REPLACE FUNCTION race_lock_order_block() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      PERFORM pg_advisory_xact_lock(hashtext('${key}'));
      RETURN NEW;
    END $$;
    CREATE TRIGGER race_lock_order_block BEFORE UPDATE ON sla_timer
      FOR EACH ROW WHEN (NEW.ticket_id = '${ids.firstTicket}' OR NEW.ticket_id = '${ids.secondTicket}')
      EXECUTE FUNCTION race_lock_order_block();
  `);
  const updated = policies.map((policy) =>
    policy.severity === 'S1' ? { ...policy, ackMinutes: policy.ackMinutes + 1 } : policy,
  );
  let policyResult: Promise<Res> | undefined;
  let consistencyResult: Promise<unknown> | undefined;
  try {
    policyResult = put('/api/v1/settings/sla-policies', token, { policies: updated }, host);
    expect(await waitForAdvisoryWait(key)).toBe(true);
    consistencyResult = runSlaConsistency({
      pool: db.app,
      tenantId: ids.tenant,
      now: new Date(),
      reconcileTicket: (ticketClient, tenantId, ticketId, now) =>
        reconcileTicket(ticketClient, { tenantId, ticketId, now, boss }),
    });
    expect(await waitForMinimumLockWaiters(2)).toBe(true);
    await releaseAdvisory(client, key);
    expect((await policyResult)?.statusCode).toBe(200);
    await consistencyResult;
    for (const ticketId of [ids.firstTicket, ids.secondTicket]) {
      const timers = (
        await admin.query(
          'SELECT count(*)::int AS n, max(revision)::int AS revision FROM sla_timer WHERE ticket_id = $1',
          [ticketId],
        )
      ).rows[0];
      expect(timers).toEqual({ n: 2, revision: 2 });
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock_all()');
    await client.query(
      'DROP TRIGGER IF EXISTS race_lock_order_block ON sla_timer; DROP FUNCTION IF EXISTS race_lock_order_block()',
    );
    client.release();
    await Promise.allSettled([policyResult, consistencyResult]);
  }
}

describe('SLA ticket integration', () => {
  it('re-arms acknowledge and restore through the complete command lifecycle', async () => {
    const raised = await ticketPost('/api/v1/tickets', {
      machineId: MACHINE,
      problem: 'Lifecycle',
    });
    expect(raised.statusCode).toBe(201);
    const id = raised.json().ticket.id as string;
    let timers = (
      await admin.query('SELECT kind, state, revision FROM sla_timer WHERE ticket_id = $1', [id])
    ).rows;
    expect(timers).toHaveLength(2);
    expect(timers.every((timer) => timer.state === 'running')).toBe(true);
    const armedKeys = await liveJobKeys(id);
    expect(armedKeys).toHaveLength(2);
    expect(new Set(armedKeys).size).toBe(2);

    const started = await ticketPost(`/api/v1/tickets/${id}/start`, { personId: ASHA });
    expect(started.statusCode).toBe(200);
    expect(
      (await admin.query("SELECT state FROM sla_timer WHERE ticket_id = $1 AND kind = 'ack'", [id]))
        .rows[0].state,
    ).toBe('stopped');

    expect(
      (await ticketPost(`/api/v1/tickets/${id}/pause`, { personId: ASHA, reasonCode: 'spare' }))
        .statusCode,
    ).toBe(200);
    expect(
      (
        await admin.query("SELECT state FROM sla_timer WHERE ticket_id = $1 AND kind = 'restore'", [
          id,
        ])
      ).rows[0].state,
    ).toBe('paused');
    expect((await ticketPost(`/api/v1/tickets/${id}/resume`, { personId: ASHA })).statusCode).toBe(
      200,
    );
    expect(
      (
        await admin.query("SELECT state FROM sla_timer WHERE ticket_id = $1 AND kind = 'restore'", [
          id,
        ])
      ).rows[0].state,
    ).toBe('running');

    expect(
      (await ticketPost(`/api/v1/tickets/${id}/cancel`, { personId: ASHA, reason: 'Reset' }))
        .statusCode,
    ).toBe(200);
    const restored = await ticketPost(
      `/api/v1/tickets/${id}/restore`,
      { reason: 'Restore lifecycle', personId: ASHA },
      adminToken,
    );
    expect(restored.statusCode).toBe(200);
    expect(
      (await ticketPost(`/api/v1/tickets/${id}/machine-running`, { personId: ASHA })).statusCode,
    ).toBe(200);
    expect(
      (
        await admin.query(
          "SELECT state, stop_reason FROM sla_timer WHERE ticket_id = $1 AND kind = 'restore'",
          [id],
        )
      ).rows[0].stop_reason,
    ).toBe('machine_running');

    timers = (await admin.query('SELECT kind, revision FROM sla_timer WHERE ticket_id = $1', [id]))
      .rows;
    expect(Math.max(...timers.map((timer) => timer.revision))).toBeGreaterThan(1);
    expect(await liveJobKeys(id)).toHaveLength(0);
  });

  it('re-arms the timers of the policy that matches the new severity when criticality changes', async () => {
    const raised = await ticketPost('/api/v1/tickets', {
      machineId: CRITICALITY_MACHINE,
      problem: 'Criticality SLA',
    });
    expect(raised.statusCode, raised.body).toBe(201);
    const id = raised.json().ticket.id as string;
    const changed = await put(`/api/v1/machines/${CRITICALITY_MACHINE}/criticality`, adminToken, {
      criticality: 'C',
    });
    expect(changed.statusCode).toBe(200);
    const ticket = await admin.query('SELECT severity FROM ticket WHERE id = $1', [id]);
    expect(ticket.rows[0].severity).toBe('S3');
    const timers = await admin.query('SELECT kind, revision FROM sla_timer WHERE ticket_id = $1', [
      id,
    ]);
    expect(timers.rows.length).toBe(2);
  });

  it('reads SLA history after the ticket lock when a command commits concurrently', async () => {
    const raised = await ticketPost('/api/v1/tickets', {
      machineId: RACE_MACHINE,
      problem: 'Concurrent SLA reconciliation',
    });
    expect(raised.statusCode).toBe(201);
    const id = raised.json().ticket.id as string;
    let markLocked!: () => void;
    let releaseCommand!: () => void;
    const locked = new Promise<void>((resolve) => {
      markLocked = resolve;
    });
    const release = new Promise<void>((resolve) => {
      releaseCommand = resolve;
    });
    const command = withTenant(db.app, TENANT, async (client) => {
      await client.query('SELECT id FROM ticket WHERE id = $1 FOR UPDATE', [id]);
      markLocked();
      await release;
      await client.query(
        "UPDATE ticket SET status = 'working', started_at = reported_at + interval '5 minutes' WHERE id = $1",
        [id],
      );
      await client.query(
        `INSERT INTO ticket_event (tenant_id, ticket_id, seq, type, at, login_id, acting_person_id, payload)
         SELECT tenant_id, id, COALESCE((SELECT max(seq) + 1 FROM ticket_event WHERE ticket_id = $1), 0),
           'start', reported_at + interval '5 minutes', $2, $3, '{}'::jsonb
         FROM ticket WHERE id = $1`,
        [id, LOGIN_ASHA, ASHA],
      );
    });
    await locked;
    const reconciliation = withTenant(db.app, TENANT, async (client) =>
      reconcileTicket(client, { tenantId: TENANT, ticketId: id, now: new Date(), boss }),
    );
    let waitError: unknown;
    const waiting = await waitForLockWaiters(admin).catch((error) => {
      waitError = error;
      return -1;
    });
    releaseCommand();
    const [commandResult, reconciliationResult] = await Promise.allSettled([
      command,
      reconciliation,
    ]);
    if (waitError) throw waitError;
    if (commandResult.status === 'rejected') throw commandResult.reason;
    if (reconciliationResult.status === 'rejected') throw reconciliationResult.reason;
    expect(waiting).toBeGreaterThan(0);
    const ack = (
      await admin.query(
        "SELECT state, stop_reason FROM sla_timer WHERE ticket_id = $1 AND kind = 'ack'",
        [id],
      )
    ).rows[0];
    expect(ack).toMatchObject({ state: 'stopped', stop_reason: 'started' });
  });

  it('rejects future correction terminals without changing SLA timers', async () => {
    const raised = await ticketPost('/api/v1/tickets', {
      machineId: CORRECTION_MACHINE,
      problem: 'Future SLA correction',
    });
    expect(raised.statusCode).toBe(201);
    const id = raised.json().ticket.id as string;
    const before = (
      await admin.query(
        "SELECT state, due_at, revision, fired_at FROM sla_timer WHERE ticket_id = $1 AND kind = 'ack'",
        [id],
      )
    ).rows[0];
    for (const field of ['startedAt', 'closedAt']) {
      const corrected = await ticketPost(
        `/api/v1/tickets/${id}/correct`,
        {
          reason: `Future ${field}`,
          changes: { [field]: new Date(Date.now() + 60 * 60 * 1000).toISOString() },
        },
        adminToken,
      );
      // a start in the future is an invalid time (422); a closing time on a ticket that is not closed is a conflict (409)
      expect(corrected.statusCode).toBe(field === 'startedAt' ? 422 : 409);
      const after = (
        await admin.query(
          "SELECT state, due_at, revision, fired_at FROM sla_timer WHERE ticket_id = $1 AND kind = 'ack'",
          [id],
        )
      ).rows[0];
      expect(after).toEqual(before);
    }
  });

  it('excludes backfill projections and re-arms a current job delivered early', async () => {
    const backfill = await admin.query(
      "INSERT INTO ticket (tenant_id, ref, kind, status, problem, reported_at, severity, raised_channel) VALUES ($1, 'BD-BACKFILL', 'stopped', 'open', 'Legacy backfill', now(), 'S1', 'backfill') RETURNING id",
      [TENANT],
    );
    const backfillId = backfill.rows[0].id as string;
    const detail = await app.inject({
      method: 'GET',
      url: `/api/v1/tickets/${backfillId}`,
      headers: { host: 'sla.localhost', authorization: `Bearer ${ashaToken}` },
    });
    expect(detail.statusCode).toBe(200);
    expect(detail.json().ticket.sla).toBeNull();

    const earlyTicket = await ticketPost('/api/v1/tickets', {
      machineId: EARLY_MACHINE,
      problem: 'Early SLA job',
    });
    expect(earlyTicket.statusCode, earlyTicket.body).toBe(201);
    const earlyId = earlyTicket.json().ticket.id as string;
    const dueAt = new Date(Date.now() + 60 * 60 * 1000);
    await boss.deleteAllJobs('sla.timer');
    await withTenant(db.app, TENANT, async (client) => {
      await boss.upsert({
        name: 'sla.timer',
        data: { tenantId: TENANT, ticketId: earlyId, kind: 'ack', revision: 1 },
        options: {
          singletonKey: `${TENANT}:${earlyId}:ack`,
          startAfter: dueAt,
          db: jobDb(client),
        },
      });
    });
    const [active] = await boss.fetch<SlaTimerPayload>('sla.timer', { ignoreStartAfter: true });
    expect(active?.data).toMatchObject({ ticketId: earlyId, kind: 'ack', revision: 1 });
    if (!active) throw new Error('Expected an early active SLA timer');
    const early = await processSlaTimerJob(active.data, {
      pool: db.app,
      now: () => new Date(),
      boss,
    });
    expect(early).toBe(false);
    await boss.complete('sla.timer', active.id);
    const timer = (
      await admin.query(
        "SELECT due_at, fired_at FROM sla_timer WHERE ticket_id = $1 AND kind = 'ack'",
        [earlyId],
      )
    ).rows[0];
    const rearmed = await admin.query(
      `SELECT id, data, start_after FROM pgboss.job
       WHERE name = 'sla.timer' AND singleton_key = $1 AND state = 'created'`,
      [`${TENANT}:${earlyId}:ack`],
    );
    expect(rearmed.rows).toHaveLength(1);
    expect(rearmed.rows[0].data.revision).toBe(1);
    expect(rearmed.rows[0].start_after.toISOString()).toBe(timer.due_at.toISOString());
    expect(timer.fired_at).toBeNull();

    await admin.query('UPDATE sla_timer SET due_at = $2 WHERE ticket_id = $1 AND kind = $3', [
      earlyId,
      new Date(Date.now() - 1000),
      'ack',
    ]);
    const fired = await processSlaTimerJob(
      { tenantId: TENANT, ticketId: earlyId, kind: 'ack', revision: 1 },
      { pool: db.app, now: () => new Date(), boss },
    );
    expect(fired).toBe(true);
    expect(
      await processSlaTimerJob(
        { tenantId: TENANT, ticketId: earlyId, kind: 'ack', revision: 1 },
        { pool: db.app, now: () => new Date(), boss },
      ),
    ).toBe(false);
  });

  it('serializes initial policy configuration followed by a concurrent raise', async () => {
    await runPolicyRaiseRace(POLICY_RACE_A, 'policy-first');
  }, 120_000);

  it('serializes a concurrent raise followed by initial policy configuration', async () => {
    await runPolicyRaiseRace(POLICY_RACE_B, 'raise-first');
  }, 120_000);

  it('uses the same BD lock order for raise and machine criticality updates', async () => {
    await runCriticalityRaiseRace(CRITICALITY_RACE);
  }, 120_000);

  it('reconciles multiple tickets in the same order as daily consistency', async () => {
    await runLockOrderRace(LOCK_ORDER_RACE);
  }, 120_000);
});
