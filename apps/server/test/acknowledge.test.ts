import { randomUUID } from 'node:crypto';
import { hash } from '@node-rs/argon2';
import type { Pool } from 'pg';
import type { PgBoss } from 'pg-boss';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import type { AppConfig } from '../src/kernel/index.js';
import { withTenant } from '@uptimo/db';
import { processSlaTimerJob } from '../src/modules/accountability/repo/timers.js';
import { reconcileTicket } from '../src/modules/accountability/sla.js';
import { startTestDb, type TestDb } from './harness.js';

const TENANT = '81000000-0000-0000-0000-000000000001';
const SHIFT = '81000000-0000-0000-0000-000000000002';
const SHIFT_OFF = '81000000-0000-0000-0000-000000000003';
const PASSWORD = 'correct-horse-battery';
const HOST = 'ack.localhost';

type App = Awaited<ReturnType<typeof buildApp>>;
let db: TestDb;
let admin: Pool;
let app: App;
let boss: PgBoss;
let key = 0;
let today = '';
const machines: string[] = [];
const people: Record<string, string> = {};
const tokens: Record<string, string> = {};

function headers(token: string, idem?: string) {
  key += 1;
  return {
    host: HOST,
    'content-type': 'application/json',
    ...(token ? { authorization: `Bearer ${token}` } : {}),
    'idempotency-key': idem ?? `ack-${key}`,
  };
}

function call(method: 'GET' | 'POST', url: string, token: string, payload?: object) {
  return app.inject({ method, url, headers: headers(token), ...(payload ? { payload } : {}) });
}

async function raise(): Promise<string> {
  const machineId = machines.shift();
  if (!machineId) throw new Error('out of machines');
  const res = await call('POST', '/api/v1/tickets', tokens.asha!, {
    machineId,
    problem: 'Spindle',
  });
  expect(res.statusCode, res.body).toBe(201);
  return res.json().ticket.id as string;
}

const acknowledge = (id: string, as: string, personName = as, idem?: string) =>
  app.inject({
    method: 'POST',
    url: `/api/v1/tickets/${id}/acknowledge`,
    headers: headers(tokens[as]!, idem),
    payload: { personId: people[personName] },
  });

const ackTimer = async (id: string) =>
  (
    await admin.query(
      "SELECT state, revision, fired_at, stop_reason FROM sla_timer WHERE ticket_id = $1 AND kind = 'ack'",
      [id],
    )
  ).rows[0] as {
    state: string;
    revision: number;
    fired_at: Date | null;
    stop_reason: string | null;
  };

async function liveAckJobs(id: string): Promise<number> {
  const jobs = await admin.query(
    `SELECT 1 FROM pgboss.job WHERE name = 'sla.timer' AND state IN ('created', 'retry', 'active')
       AND singleton_key = $1`,
    [`${TENANT}:${id}:ack`],
  );
  return jobs.rowCount ?? 0;
}

const ackEvents = async (id: string) =>
  (
    await admin.query(
      "SELECT acting_person_id, login_id FROM ticket_event WHERE ticket_id = $1 AND type = 'acknowledge'",
      [id],
    )
  ).rows;

async function expectRefused(id: string, res: Awaited<ReturnType<typeof acknowledge>>) {
  expect(res.statusCode, res.body).toBe(403);
  expect(res.json().error.code).toBe('forbidden');
  expect(await ackEvents(id)).toHaveLength(0);
  expect((await ackTimer(id)).state).toBe('running');
  expect(await liveAckJobs(id)).toBe(1);
}

const rosterLine = (person: string, over: { date?: string; shiftId?: string } = {}) =>
  admin.query(
    "INSERT INTO roster_entry (tenant_id, date, shift_id, person_id, level) VALUES ($1, $2, $3, $4, 'L1')",
    [TENANT, over.date ?? today, over.shiftId ?? SHIFT, people[person]],
  );

beforeAll(async () => {
  db = await startTestDb();
  admin = db.admin;
  const passwordHash = await hash(PASSWORD, {
    algorithm: 2,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
  await admin.query("INSERT INTO tenant (id, slug, name) VALUES ($1, 'ack', 'Ack plant')", [
    TENANT,
  ]);
  today = (await admin.query("SELECT (now() AT TIME ZONE 'Asia/Kolkata')::date::text AS d")).rows[0]
    .d;
  // one shift that covers every hour, and a switched-off one that never counts
  await admin.query(
    `INSERT INTO shift (id, tenant_id, code, name, starts_at, ends_at, crosses_midnight, active) VALUES
      ($1, $3, '1', 'Day', '00:00', '00:00', true, true), ($2, $3, '2', 'Old', '00:00', '00:00', true, false)`,
    [SHIFT, SHIFT_OFF, TENANT],
  );
  const logins: Array<[string, string, string | null, boolean]> = [
    ['asha', 'technician', 'asha', false],
    ['bina', 'technician', 'bina', false],
    ['sunil', 'supervisor', 'sunil', false],
    ['hema', 'head', 'hema', false],
    ['pravin', 'plant_head', 'pravin', false],
    ['pooja', 'plant_head', 'pooja', false],
    ['omkar', 'operator', 'omkar', false],
    ['board', 'board', 'boris', false],
    ['root', 'admin', 'root', false],
    ['shared', 'technician', null, true],
  ];
  for (const [, , person] of logins) {
    if (!person) continue;
    people[person] = randomUUID();
    await admin.query(
      "INSERT INTO person (id, tenant_id, name, team) VALUES ($1, $2, $3, 'maintenance')",
      [people[person], TENANT, person],
    );
  }
  for (const [username, role, person, shared] of logins) {
    await admin.query(
      `INSERT INTO login (tenant_id, person_id, username, password_hash, role, shared)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [TENANT, person ? people[person] : null, username, passwordHash, role, shared],
    );
  }
  await admin.query(
    "INSERT INTO ref_counter (tenant_id, prefix, next_value) VALUES ($1, 'BD', 1)",
    [TENANT],
  );
  await admin.query(
    `INSERT INTO sla_policy (tenant_id, severity, ack_minutes, restore_minutes) VALUES
      ($1, 'S1', 60, 240), ($1, 'S2', 90, 360), ($1, 'S3', 120, 480), ($1, 'S4', 180, 720)`,
    [TENANT],
  );
  for (let i = 0; i < 24; i += 1) {
    const id = randomUUID();
    machines.push(id);
    await admin.query(
      "INSERT INTO machine (id, tenant_id, code, criticality) VALUES ($1, $2, $3, 'A')",
      [id, TENANT, `VC-${i}`],
    );
  }
  for (const person of ['asha', 'sunil', 'hema', 'pravin', 'omkar', 'boris']) {
    await rosterLine(person);
  }
  const config: AppConfig = { pool: db.app, logger: false, rateLimitMax: 100000 };
  app = await buildApp(config);
  boss = config.jobBoss!;
  for (const [username] of logins) {
    const res = await call('POST', '/api/v1/auth/login', '', { username, password: PASSWORD });
    expect(res.statusCode, `login ${username}`).toBe(200);
    tokens[username] = res.json().token as string;
  }
}, 120_000);

afterAll(async () => {
  await app.close();
  await db.stop();
});

describe('POST /tickets/:id/acknowledge', () => {
  it('stops the ack clock for the rostered person and writes the history event', async () => {
    const id = await raise();
    const before = await ackTimer(id);
    expect(before.state).toBe('running');
    expect(await liveAckJobs(id)).toBe(1);

    const res = await acknowledge(id, 'asha');
    expect(res.statusCode, res.body).toBe(200);
    expect(res.json().ticket.status).toBe('open');
    expect(res.json().ticket.sla.ack.state).toBe('stopped');

    const after = await ackTimer(id);
    expect(after).toMatchObject({ state: 'stopped', stop_reason: 'acknowledged', fired_at: null });
    expect(after.revision).toBeGreaterThan(before.revision);
    expect(await liveAckJobs(id)).toBe(0);
    expect(await ackEvents(id)).toEqual([
      { acting_person_id: people.asha, login_id: expect.any(String) },
    ]);
    const detail = await call('GET', `/api/v1/tickets/${id}`, tokens.asha!);
    expect(detail.json().events.map((e: { type: string }) => e.type)).toContain('acknowledge');
  });

  it('lets a rostered supervisor, head and plant head acknowledge, and the admin without a line', async () => {
    for (const who of ['sunil', 'hema', 'pravin', 'root']) {
      const id = await raise();
      const res = await acknowledge(id, who);
      expect(res.statusCode, `${who}: ${res.body}`).toBe(200);
      expect((await ackTimer(id)).state).toBe('stopped');
    }
  });

  it('refuses a technician who is not on the roster, and the clock keeps running', async () => {
    const id = await raise();
    await expectRefused(id, await acknowledge(id, 'bina'));
  });

  it('refuses a plant head who is not on the roster', async () => {
    const id = await raise();
    await expectRefused(id, await acknowledge(id, 'pooja'));
  });

  it('refuses an operator and the board even with a roster line', async () => {
    const id = await raise();
    await expectRefused(id, await acknowledge(id, 'omkar'));
    await expectRefused(id, await acknowledge(id, 'board', 'boris'));
  });

  it('refuses a roster line for yesterday, and one on a shift that is not running', async () => {
    const id = await raise();
    const yesterday = (
      await admin.query("SELECT ((now() AT TIME ZONE 'Asia/Kolkata')::date - 1)::text AS d")
    ).rows[0].d;
    await rosterLine('bina', { date: yesterday });
    await expectRefused(id, await acknowledge(id, 'bina'));
    await admin.query('DELETE FROM roster_entry WHERE person_id = $1', [people.bina]);
    await rosterLine('bina', { shiftId: SHIFT_OFF });
    await expectRefused(id, await acknowledge(id, 'bina'));
    await admin.query('DELETE FROM roster_entry WHERE person_id = $1', [people.bina]);
  });

  it('on a shared login the acting person decides: none chosen is refused, unrostered is refused, rostered passes', async () => {
    const id = await raise();
    const none = await acknowledge(id, 'shared', 'asha');
    expect(none.statusCode).toBe(403);
    expect(none.json().error.code).toBe('choose_acting_person');
    expect((await ackTimer(id)).state).toBe('running');

    const choose = (who: string) =>
      call('POST', '/api/v1/auth/acting', tokens.shared!, { actingPersonId: people[who] });
    expect((await choose('bina')).statusCode).toBe(200);
    await expectRefused(id, await acknowledge(id, 'shared', 'bina'));
    expect((await choose('asha')).statusCode).toBe(200);
    const ok = await acknowledge(id, 'shared', 'asha');
    expect(ok.statusCode, ok.body).toBe(200);
    expect((await ackEvents(id))[0]?.acting_person_id).toBe(people.asha);
  });

  it('refuses a person signed in as someone else', async () => {
    const id = await raise();
    const res = await call('POST', `/api/v1/tickets/${id}/acknowledge`, tokens.bina!, {
      personId: people.asha,
    });
    expect(res.statusCode).toBe(403);
    expect((await ackTimer(id)).state).toBe('running');
  });

  it('answers a second acknowledge with a conflict, and replays the same request', async () => {
    const id = await raise();
    const first = await acknowledge(id, 'asha', 'asha', 'ack-replay');
    expect(first.statusCode).toBe(200);
    const replay = await acknowledge(id, 'asha', 'asha', 'ack-replay');
    expect(replay.statusCode).toBe(200);
    expect(replay.json()).toEqual(first.json());
    const again = await acknowledge(id, 'sunil');
    expect(again.statusCode).toBe(409);
    expect(await ackEvents(id)).toHaveLength(1);
  });

  it('refuses a closed ticket and an unknown one', async () => {
    const id = await raise();
    const cancel = await call('POST', `/api/v1/tickets/${id}/cancel`, tokens.asha!, {
      personId: people.asha,
      reason: 'Duplicate',
    });
    expect(cancel.statusCode).toBe(200);
    expect((await acknowledge(id, 'asha')).statusCode).toBe(409);
    const unknown = await acknowledge(randomUUID(), 'asha');
    expect(unknown.statusCode).toBe(404);
  });

  it('keeps a breach that already fired: a late acknowledge does not undo it', async () => {
    const id = await raise();
    // the breakdown was reported three hours ago, so the 60-minute acknowledge target is long past
    await admin.query("UPDATE ticket SET reported_at = now() - interval '3 hours' WHERE id = $1", [
      id,
    ]);
    await admin.query(
      "UPDATE ticket_event SET at = now() - interval '3 hours' WHERE ticket_id = $1 AND type = 'down'",
      [id],
    );
    await withTenant(db.app, TENANT, (client) =>
      reconcileTicket(client, { tenantId: TENANT, ticketId: id, now: new Date(), boss }),
    );
    const due = await ackTimer(id);
    const fired = await processSlaTimerJob(
      { tenantId: TENANT, ticketId: id, kind: 'ack', revision: due.revision },
      { pool: db.app, now: () => new Date(), boss },
    );
    expect(fired).toBe(true);
    const breached = await ackTimer(id);
    expect(breached.fired_at).not.toBeNull();

    const res = await acknowledge(id, 'asha');
    expect(res.statusCode, res.body).toBe(200);
    const after = await ackTimer(id);
    expect(after.state).toBe('stopped');
    expect(after.fired_at?.toISOString()).toBe(breached.fired_at?.toISOString());
    expect(res.json().ticket.sla.ack.breached).toBe(true);
  });
});
