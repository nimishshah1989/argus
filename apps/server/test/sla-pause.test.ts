import { randomUUID } from 'node:crypto';
import { hash } from '@node-rs/argon2';
import type { Pool } from 'pg';
import type { PgBoss } from 'pg-boss';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { withTenant } from '@uptimo/db';
import { buildApp } from '../src/app.js';
import type { AppConfig } from '../src/kernel/index.js';
import {
  processSlaTimerJob,
  type SlaTimerPayload,
} from '../src/modules/accountability/repo/timers.js';
import { reconcileTicket } from '../src/modules/accountability/sla.js';
import { startTestDb, type TestDb } from './harness.js';

const A = '71000000-0000-0000-0000-000000000001';
const B = '72000000-0000-0000-0000-000000000001';
const MACHINE_A = '71000000-0000-0000-0000-000000000002';
const PERSON_A = '71000000-0000-0000-0000-000000000003';
const LOGIN_ADMIN = '71000000-0000-0000-0000-000000000004';
const LOGIN_TECH = '71000000-0000-0000-0000-000000000005';
const PASSWORD = 'correct-horse-battery';
const HOST = 'pz-a.localhost';
const at = (hhmm: string) => new Date(`2026-01-01T${hhmm}:00Z`);

type App = Awaited<ReturnType<typeof buildApp>>;
let db: TestDb;
let admin: Pool;
let app: App;
let boss: PgBoss;
let adminToken = '';
let techToken = '';
let key = 0;

function call(method: 'GET' | 'POST' | 'PUT', url: string, token: string, payload?: object) {
  key += 1;
  return app.inject({
    method,
    url,
    headers: {
      host: HOST,
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      'idempotency-key': `pause-${key}`,
    },
    ...(payload ? { payload } : {}),
  });
}

async function login(username: string): Promise<string> {
  const res = await call('POST', '/api/v1/auth/login', '', { username, password: PASSWORD });
  expect(res.statusCode).toBe(200);
  return res.json().token as string;
}

function policyBody(over: Record<string, unknown> = {}) {
  const base = [
    { severity: 'S1', ackMinutes: 60, restoreMinutes: 240, pauseMaxMinutes: 30 },
    { severity: 'S2', ackMinutes: 90, restoreMinutes: 360 },
    { severity: 'S3', ackMinutes: 120, restoreMinutes: 480 },
    { severity: 'S4', ackMinutes: 180, restoreMinutes: 720 },
  ];
  return { policies: base.map((p) => ({ ...p, businessHoursOnly: false, ...over })) };
}

async function seedPolicies(tenantId: string): Promise<void> {
  await admin.query(
    `INSERT INTO sla_policy (tenant_id, severity, ack_minutes, restore_minutes, pause_max_minutes) VALUES
      ($1, 'S1', 60, 240, 30), ($1, 'S2', 90, 360, NULL), ($1, 'S3', 120, 480, NULL), ($1, 'S4', 180, 720, NULL)
     ON CONFLICT (tenant_id, severity) DO UPDATE SET pause_max_minutes = EXCLUDED.pause_max_minutes`,
    [tenantId],
  );
}

beforeAll(async () => {
  db = await startTestDb();
  admin = db.admin;
  const passwordHash = await hash(PASSWORD, {
    algorithm: 2,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
  await admin.query(
    "INSERT INTO tenant (id, slug, name) VALUES ($1, 'pz-a', 'Pause A'), ($2, 'pz-b', 'Pause B')",
    [A, B],
  );
  await admin.query(
    "INSERT INTO machine (id, tenant_id, code, criticality) VALUES ($1, $2, 'VC-PZ', 'A')",
    [MACHINE_A, A],
  );
  await admin.query(
    "INSERT INTO person (id, tenant_id, name, team) VALUES ($1, $2, 'Asha', 'maintenance')",
    [PERSON_A, A],
  );
  await admin.query(
    `INSERT INTO login (id, tenant_id, person_id, username, password_hash, role, shared) VALUES
      ($1, $3, $4, 'admin', $5, 'admin', false), ($2, $3, $4, 'asha', $5, 'technician', false)`,
    [LOGIN_ADMIN, LOGIN_TECH, A, PERSON_A, passwordHash],
  );
  await admin.query(
    "INSERT INTO ref_counter (tenant_id, prefix, next_value) VALUES ($1, 'BD', 1), ($2, 'BD', 1)",
    [A, B],
  );
  await admin.query(
    "INSERT INTO list_item (tenant_id, list, code, label, is_vendor, pauses_sla) VALUES ($1, 'wait_reason', 'spare', 'Spare part', false, true)",
    [A],
  );
  const config: AppConfig = { pool: db.app, logger: false, rateLimitMax: 100000 };
  app = await buildApp(config);
  boss = config.jobBoss!;
  adminToken = await login('admin');
  techToken = await login('asha');
}, 120_000);

afterAll(async () => {
  await app.close();
  await db.stop();
});

describe('policy settings: pause maximum and sign-off time', () => {
  it('refuses zero, negative, fractional, absurd and non-numeric values', async () => {
    for (const bad of [0, -5, 1.5, 43_201, '30']) {
      for (const field of ['pauseMaxMinutes', 'handbackMinutes']) {
        const res = await call(
          'PUT',
          '/api/v1/settings/sla-policies',
          adminToken,
          policyBody({ [field]: bad }),
        );
        expect(res.statusCode, `${field}=${String(bad)}`).toBe(422);
      }
    }
  });

  it('saves, returns, keeps when omitted, and clears with null', async () => {
    const put = (over: Record<string, unknown>) =>
      call('PUT', '/api/v1/settings/sla-policies', adminToken, policyBody(over));
    const policies = async () =>
      (await call('GET', '/api/v1/config', adminToken)).json().slaPolicies as Array<
        Record<string, unknown>
      >;
    expect((await put({ pauseMaxMinutes: 45, handbackMinutes: 43_200 })).statusCode).toBe(200);
    expect((await policies()).map((p) => [p.pauseMaxMinutes, p.handbackMinutes])).toEqual(
      Array(4).fill([45, 43_200]),
    );
    const omitted = policyBody();
    for (const p of omitted.policies) {
      delete (p as Record<string, unknown>).pauseMaxMinutes;
    }
    expect(
      (await call('PUT', '/api/v1/settings/sla-policies', adminToken, omitted)).statusCode,
    ).toBe(200);
    expect((await policies()).map((p) => p.pauseMaxMinutes)).toEqual(Array(4).fill(45));
    expect((await put({ pauseMaxMinutes: null, handbackMinutes: null })).statusCode).toBe(200);
    expect((await policies()).map((p) => [p.pauseMaxMinutes, p.handbackMinutes])).toEqual(
      Array(4).fill([null, null]),
    );
    expect(
      (await call('PUT', '/api/v1/settings/sla-policies', techToken, policyBody())).statusCode,
    ).toBe(403);
  });
});

describe('pause clock on a real ticket', () => {
  let ticketId = '';
  const pauseRow = async () =>
    (
      await admin.query("SELECT * FROM sla_timer WHERE ticket_id = $1 AND kind = 'pause'", [
        ticketId,
      ])
    ).rows[0];
  const command = (action: string, payload: object = { personId: PERSON_A }) =>
    call('POST', `/api/v1/tickets/${ticketId}/${action}`, techToken, payload);

  beforeAll(async () => {
    expect(
      (
        await call(
          'PUT',
          '/api/v1/settings/sla-policies',
          adminToken,
          policyBody({ pauseMaxMinutes: 30 }),
        )
      ).statusCode,
    ).toBe(200);
    const raised = await call('POST', '/api/v1/tickets', techToken, {
      machineId: MACHINE_A,
      problem: 'Pause clock',
    });
    expect(raised.statusCode).toBe(201);
    ticketId = raised.json().ticket.id as string;
  });

  it('has no pause clock until the ticket is paused', async () => {
    expect(await pauseRow()).toBeUndefined();
    const ticket = (await call('GET', `/api/v1/tickets/${ticketId}`, techToken)).json().ticket;
    expect(ticket.sla.pause ?? null).toBeNull();
    expect((await command('start')).statusCode).toBe(200);
  });

  it('arms at the pause start plus the maximum and shows on the ticket', async () => {
    const paused = await command('pause', { personId: PERSON_A, reasonCode: 'spare' });
    expect(paused.statusCode).toBe(200);
    const start = (
      await admin.query("SELECT at FROM ticket_event WHERE ticket_id = $1 AND type = 'pause'", [
        ticketId,
      ])
    ).rows[0].at as Date;
    const row = await pauseRow();
    expect(row).toMatchObject({ state: 'running', fired_at: null });
    expect(new Date(row.due_at).getTime()).toBe(start.getTime() + 30 * 60_000);
    const live = await admin.query(
      "SELECT 1 FROM pgboss.job WHERE name = 'sla.timer' AND singleton_key = $1 AND state IN ('created','retry','active')",
      [`${A}:${ticketId}:pause`],
    );
    expect(live.rowCount).toBe(1);
    const pause = paused.json().ticket.sla.pause;
    expect(pause).toMatchObject({
      state: 'running',
      breached: false,
      dueAt: new Date(row.due_at).toISOString(),
    });
    const read = (await call('GET', `/api/v1/tickets/${ticketId}`, techToken)).json().ticket.sla;
    expect(read.pause).toEqual(pause);
  });

  it('a policy change re-arms the running pause with the new maximum', async () => {
    const before = await pauseRow();
    expect(
      (
        await call(
          'PUT',
          '/api/v1/settings/sla-policies',
          adminToken,
          policyBody({ pauseMaxMinutes: 90 }),
        )
      ).statusCode,
    ).toBe(200);
    const after = await pauseRow();
    expect(new Date(after.due_at).getTime() - new Date(before.due_at).getTime()).toBe(60 * 60_000);
    expect(after.revision).toBe(before.revision + 1);
    expect(after.id).toBe(before.id);
  });

  it('resuming stops the clock and removes its job', async () => {
    expect((await command('resume')).statusCode).toBe(200);
    expect(await pauseRow()).toMatchObject({
      state: 'stopped',
      stop_reason: 'resumed',
      fired_at: null,
    });
    const live = await admin.query(
      "SELECT 1 FROM pgboss.job WHERE name = 'sla.timer' AND singleton_key = $1 AND state IN ('created','retry','active')",
      [`${A}:${ticketId}:pause`],
    );
    expect(live.rowCount).toBe(0);
  });

  it('a second pause reuses the same row and runs again', async () => {
    const first = await pauseRow();
    expect((await command('pause', { personId: PERSON_A, reasonCode: 'spare' })).statusCode).toBe(
      200,
    );
    const second = await pauseRow();
    expect(second.id).toBe(first.id);
    expect(second).toMatchObject({ state: 'running', stopped_at: null, stop_reason: null });
    expect(new Date(second.due_at).getTime()).toBeGreaterThan(
      new Date(first.due_at).getTime() - 90 * 60_000,
    );
    expect(
      (
        await admin.query(
          "SELECT count(*)::int AS n FROM sla_timer WHERE ticket_id = $1 AND kind = 'pause'",
          [ticketId],
        )
      ).rows[0].n,
    ).toBe(1);
  });
});

type Ev = [type: string, hhmm: string, payload?: object];

describe('pause clock on the fake clock', () => {
  async function makeTicket(
    tenantId: string,
    severity: string,
    events: Array<[string, string, object?]>,
  ) {
    const id = randomUUID();
    await admin.query(
      `INSERT INTO ticket (id, tenant_id, ref, kind, status, problem, reported_at, severity)
       VALUES ($1, $2, $3, 'stopped', 'waiting', 'Fake clock', $4, $5)`,
      [id, tenantId, `BD-${id.slice(0, 8)}`, at('09:00'), severity],
    );
    for (const event of events) await addEvent(tenantId, id, event);
    return id;
  }
  async function addEvent(tenantId: string, ticketId: string, event: Ev) {
    await admin.query(
      `INSERT INTO ticket_event (tenant_id, ticket_id, seq, type, at, payload)
       VALUES ($1, $2, (SELECT COALESCE(max(seq) + 1, 0) FROM ticket_event WHERE ticket_id = $2), $3, $4, $5)`,
      [tenantId, ticketId, event[0], at(event[1]), event[2] ?? {}],
    );
  }
  const pause = (hhmm: string): [string, string, object] => [
    'pause',
    hhmm,
    { pausesSla: true, reason: 'spare' },
  ];
  const arm = (tenantId: string, ticketId: string, hhmm: string) =>
    withTenant(db.app, tenantId, (client) =>
      reconcileTicket(client, { tenantId, ticketId, now: at(hhmm), boss }),
    );
  const row = async (tenantId: string, ticketId: string) =>
    (
      await admin.query(
        "SELECT * FROM sla_timer WHERE tenant_id = $1 AND ticket_id = $2 AND kind = 'pause'",
        [tenantId, ticketId],
      )
    ).rows[0];
  const liveJobs = async (tenantId: string, ticketId: string) =>
    (
      await admin.query(
        "SELECT 1 FROM pgboss.job WHERE name = 'sla.timer' AND singleton_key = $1 AND state IN ('created','retry','active')",
        [`${tenantId}:${ticketId}:pause`],
      )
    ).rowCount;
  const fire = async (tenantId: string, ticketId: string, hhmm: string) => {
    const timer = await row(tenantId, ticketId);
    const payload: SlaTimerPayload = {
      tenantId,
      ticketId,
      kind: 'pause',
      revision: timer.revision,
    };
    return processSlaTimerJob(payload, { pool: db.app, now: () => at(hhmm), boss });
  };

  beforeAll(async () => {
    await seedPolicies(A);
    await seedPolicies(B);
  });

  it('a pause shorter than the maximum fires nothing', async () => {
    const id = await makeTicket(A, 'S1', [['down', '09:00'], pause('09:10')]);
    await arm(A, id, '09:20');
    expect(await fire(A, id, '09:39')).toBe(false);
    const armed = await row(A, id);
    await addEvent(A, id, ['resume', '09:35']);
    await arm(A, id, '09:36');
    expect(await row(A, id)).toMatchObject({ state: 'stopped', stop_reason: 'resumed' });
    const stale: SlaTimerPayload = {
      tenantId: A,
      ticketId: id,
      kind: 'pause',
      revision: armed.revision,
    };
    expect(await processSlaTimerJob(stale, { pool: db.app, now: () => at('10:30'), boss })).toBe(
      false,
    );
    expect((await row(A, id)).fired_at).toBeNull();
  });

  it('a pause longer than the maximum fires one breach, however many times the job runs', async () => {
    const id = await makeTicket(A, 'S1', [['down', '09:00'], pause('09:10')]);
    await arm(A, id, '09:20');
    expect(await fire(A, id, '09:39')).toBe(false);
    expect(await fire(A, id, '09:41')).toBe(true);
    const firedAt = (await row(A, id)).fired_at as Date;
    expect(firedAt.toISOString()).toBe(at('09:41').toISOString());
    expect(await fire(A, id, '09:55')).toBe(false);
    await arm(A, id, '10:00');
    expect(await fire(A, id, '10:01')).toBe(false);
    expect(((await row(A, id)).fired_at as Date).toISOString()).toBe(firedAt.toISOString());
  });

  it('a second pause is a new clock that can breach once more', async () => {
    const id = await makeTicket(A, 'S1', [['down', '09:00'], pause('09:10')]);
    await arm(A, id, '09:20');
    const first = await row(A, id);
    expect(await fire(A, id, '09:41')).toBe(true);
    await addEvent(A, id, ['resume', '10:00']);
    await arm(A, id, '10:00');
    expect(await row(A, id)).toMatchObject({ state: 'stopped', stop_reason: 'resumed' });
    await addEvent(A, id, pause('11:00'));
    await arm(A, id, '11:10');
    const second = await row(A, id);
    expect(second.id).toBe(first.id);
    expect(second).toMatchObject({ state: 'running', fired_at: null });
    expect(new Date(second.due_at).toISOString()).toBe(at('11:30').toISOString());
    expect(await fire(A, id, '11:29')).toBe(false);
    expect(await fire(A, id, '11:31')).toBe(true);
    expect(await fire(A, id, '11:40')).toBe(false);
  });

  it('a pause whose reason does not pause the restore clock arms no pause clock', async () => {
    const id = await makeTicket(A, 'S1', [
      ['down', '09:00'],
      ['pause', '09:10', { pausesSla: false }],
    ]);
    await arm(A, id, '09:20');
    expect(await row(A, id)).toBeUndefined();
  });

  it('removing the maximum while a pause clock runs stops it: no job, no breach', async () => {
    const id = await makeTicket(A, 'S1', [['down', '09:00'], pause('09:10')]);
    await arm(A, id, '09:20');
    const armed = await row(A, id);
    expect(await liveJobs(A, id)).toBe(1);
    await admin.query(
      "UPDATE sla_policy SET pause_max_minutes = NULL WHERE tenant_id = $1 AND severity = 'S1'",
      [A],
    );
    try {
      await arm(A, id, '09:25');
      expect(await row(A, id)).toMatchObject({
        state: 'stopped',
        stop_reason: 'cancelled',
        fired_at: null,
      });
      expect((await row(A, id)).revision).toBeGreaterThan(armed.revision);
      expect(await liveJobs(A, id)).toBe(0);
      const stale: SlaTimerPayload = {
        tenantId: A,
        ticketId: id,
        kind: 'pause',
        revision: armed.revision,
      };
      expect(await processSlaTimerJob(stale, { pool: db.app, now: () => at('10:30'), boss })).toBe(
        false,
      );
      expect(await fire(A, id, '10:30')).toBe(false);
      expect((await row(A, id)).fired_at).toBeNull();
    } finally {
      await admin.query(
        "UPDATE sla_policy SET pause_max_minutes = 30 WHERE tenant_id = $1 AND severity = 'S1'",
        [A],
      );
    }
  });

  it('a ticket that moves to a severity with no maximum while paused stops its clock', async () => {
    const id = await makeTicket(A, 'S1', [['down', '09:00'], pause('09:10')]);
    await arm(A, id, '09:20');
    await admin.query("UPDATE ticket SET severity = 'S2' WHERE id = $1", [id]);
    await arm(A, id, '09:25');
    expect(await row(A, id)).toMatchObject({
      state: 'stopped',
      stop_reason: 'cancelled',
      fired_at: null,
    });
    expect(await liveJobs(A, id)).toBe(0);
    expect(await fire(A, id, '10:30')).toBe(false);
  });

  it('cancel then restore after the pause already breached starts a clock that can breach again', async () => {
    const id = await makeTicket(A, 'S1', [['down', '09:00'], pause('09:10')]);
    await arm(A, id, '09:20');
    expect(await fire(A, id, '09:41')).toBe(true);
    await addEvent(A, id, ['cancel', '10:00', { previousStatus: 'waiting' }]);
    await arm(A, id, '10:00');
    expect(await row(A, id)).toMatchObject({ state: 'stopped', stop_reason: 'cancelled' });
    await addEvent(A, id, ['restore', '10:30']);
    await arm(A, id, '10:30');
    expect(await row(A, id)).toMatchObject({ state: 'running', fired_at: null });
    expect(new Date((await row(A, id)).due_at).toISOString()).toBe(at('11:00').toISOString());
    expect(await fire(A, id, '10:59')).toBe(false);
    expect(await fire(A, id, '11:01')).toBe(true);
    expect(await fire(A, id, '11:30')).toBe(false);
  });

  it('restoring a ticket that was cancelled in another status starts no pause clock', async () => {
    const id = await makeTicket(A, 'S1', [['down', '09:00'], pause('09:10')]);
    await arm(A, id, '09:20');
    await addEvent(A, id, ['cancel', '09:30', { previousStatus: 'open' }]);
    await addEvent(A, id, ['restore', '09:40']);
    await arm(A, id, '09:45');
    expect(await row(A, id)).toMatchObject({ state: 'stopped', stop_reason: 'cancelled' });
    expect(await liveJobs(A, id)).toBe(0);
  });

  it('a policy with no pause maximum arms no pause clock', async () => {
    const id = await makeTicket(A, 'S2', [['down', '09:00'], pause('09:10')]);
    await arm(A, id, '09:20');
    expect(await row(A, id)).toBeUndefined();
    const kinds = await admin.query(
      'SELECT kind FROM sla_timer WHERE ticket_id = $1 ORDER BY kind',
      [id],
    );
    expect(kinds.rows.map((r) => r.kind)).toEqual(['ack', 'restore']);
  });

  it('one plant never fires, or reads, another plant’s pause clock', async () => {
    const idA = await makeTicket(A, 'S1', [['down', '09:00'], pause('09:10')]);
    const idB = await makeTicket(B, 'S1', [['down', '09:00'], pause('10:00')]);
    await arm(A, idA, '09:20');
    await arm(B, idB, '10:05');
    const timerA = await row(A, idA);
    const crossed: SlaTimerPayload = {
      tenantId: B,
      ticketId: idA,
      kind: 'pause',
      revision: timerA.revision,
    };
    expect(await processSlaTimerJob(crossed, { pool: db.app, now: () => at('09:50'), boss })).toBe(
      false,
    );
    expect((await row(A, idA)).fired_at).toBeNull();
    expect(await fire(A, idA, '09:50')).toBe(true);
    expect((await row(B, idB)).fired_at).toBeNull();
    expect(await fire(B, idB, '10:31')).toBe(true);
  });
});
