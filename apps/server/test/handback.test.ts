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

const A = '34000000-0000-4000-8000-00000000000a';
const MACHINE = '34000000-0000-4000-8000-000000000101';
const id = (n: number) => `34000000-0000-4000-8000-0000000002${n.toString(16).padStart(2, '0')}`;
const [REPORTER, LEAD, SUPER, FLOOR2, OUTSIDER] = [id(1), id(2), id(3), id(4), id(5)];
const PASSWORD = 'correct-horse-battery';
const HOST = 'hb-a.localhost';
const at = (hhmm: string) => new Date(`2026-01-01T${hhmm}:00Z`);

type App = Awaited<ReturnType<typeof buildApp>>;
let db: TestDb;
let admin: Pool;
let app: App;
let boss: PgBoss;
let keys = 0;
const tokens: Record<string, string> = {};

interface Req {
  method: 'GET' | 'POST' | 'PUT';
  url: string;
  token: string;
  payload?: object;
}

function send({ method, url, token, payload }: Req, key: string) {
  return app.inject({
    method,
    url,
    headers: {
      host: HOST,
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      'idempotency-key': key,
    },
    ...(payload ? { payload } : {}),
  });
}

function call(method: Req['method'], url: string, token: string, payload?: object) {
  return send({ method, url, token, payload }, `hb-${(keys += 1)}`);
}

async function login(username: string): Promise<string> {
  const res = await call('POST', '/api/v1/auth/login', '', { username, password: PASSWORD });
  expect(res.statusCode, username).toBe(200);
  return res.json().token as string;
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
  await admin.query("INSERT INTO tenant (id, slug, name) VALUES ($1, 'hb-a', 'Handback A')", [A]);
  await admin.query(
    "INSERT INTO machine (id, tenant_id, code, criticality, cell) VALUES ($1, $2, 'VC-HB', 'A', 'C1')",
    [MACHINE, A],
  );
  await admin.query(
    `INSERT INTO person (id, tenant_id, name, team, kind) VALUES
      ($2, $1, 'Rina', 'production', 'production'), ($3, $1, 'Lal', 'maintenance', 'staff'),
      ($4, $1, 'Sana', 'maintenance', 'staff'), ($5, $1, 'Floor Two', 'production', 'production'),
      ($6, $1, 'Out', 'production', 'production')`,
    [A, REPORTER, LEAD, SUPER, FLOOR2, OUTSIDER],
  );
  await admin.query(
    `INSERT INTO login (tenant_id, person_id, username, password_hash, role, shared, cell) VALUES
      ($1, $2, 'rina', $7, 'operator', false, NULL),
      ($1, $3, 'lal', $7, 'technician', false, NULL),
      ($1, $4, 'sana', $7, 'supervisor', false, NULL),
      ($1, NULL, 'cell1', $7, 'operator', true, 'C1'),
      ($1, $5, 'floor2', $7, 'operator', false, 'C1'),
      ($1, $6, 'cell2', $7, 'operator', false, 'C2'),
      ($1, $3, 'boss', $7, 'admin', false, NULL)`,
    [A, REPORTER, LEAD, SUPER, FLOOR2, OUTSIDER, passwordHash],
  );
  await admin.query(
    "INSERT INTO ref_counter (tenant_id, prefix, next_value) VALUES ($1, 'BD', 1)",
    [A],
  );
  await admin.query(
    `INSERT INTO sla_policy (tenant_id, severity, ack_minutes, restore_minutes, handback_minutes) VALUES
      ($1, 'S1', 60, 240, 60), ($1, 'S2', 90, 360, 60), ($1, 'S3', 120, 480, 60), ($1, 'S4', 180, 720, 60)`,
    [A],
  );
  const config: AppConfig = { pool: db.app, logger: false, rateLimitMax: 100000 };
  app = await buildApp(config);
  boss = config.jobBoss!;
  for (const name of ['rina', 'lal', 'sana', 'cell1', 'floor2', 'cell2', 'boss']) {
    tokens[name] = await login(name);
  }
}, 120_000);

afterAll(async () => {
  await app.close();
  await db.stop();
});

/** A breakdown reported by Rina, worked and closed by Lal. Returns the ticket id. */
async function closedBreakdown(): Promise<string> {
  const raised = await call('POST', '/api/v1/tickets', tokens.rina!, {
    machineId: MACHINE,
    problem: 'Spindle stops',
  });
  expect(raised.statusCode).toBe(201);
  const ticketId = raised.json().ticket.id as string;
  const lal = { personId: LEAD };
  expect(
    (await call('POST', `/api/v1/tickets/${ticketId}/start`, tokens.lal!, lal)).statusCode,
  ).toBe(200);
  const closed = await call('POST', `/api/v1/tickets/${ticketId}/close`, tokens.lal!, {
    ...lal,
    kind: 'done',
  });
  expect(closed.statusCode).toBe(200);
  return ticketId;
}

const answer = (ticketId: string, who: string, personId: string | null, body: object) =>
  call('POST', `/api/v1/tickets/${ticketId}/handback`, tokens[who]!, {
    ...(personId ? { personId } : {}),
    ...body,
  });
const read = async (ticketId: string) =>
  (await call('GET', `/api/v1/tickets/${ticketId}`, tokens.sana!)).json();

describe('asking production to sign off', () => {
  it('a closed breakdown asks the reporter; the ask shows on the ticket with both turnarounds', async () => {
    const ticketId = await closedBreakdown();
    const { ticket } = await read(ticketId);
    expect(ticket.status).toBe('closed');
    expect(ticket.handback).toMatchObject({
      status: 'requested',
      respondedAt: null,
      reopenCount: 0,
    });
    expect(ticket.handback.dueAt).not.toBeNull();
    expect(ticket.handback.turnaround).toEqual({
      maintenanceMin: expect.any(Number),
      productionMin: expect.any(Number),
    });
  });

  it('a ticket that was open before this existed, or never had a machine, asks nobody', async () => {
    const old = randomUUID();
    await admin.query(
      `INSERT INTO ticket (id, tenant_id, ref, kind, status, problem, reported_at, closed_at, severity)
       VALUES ($1, $2, 'BD-OLD', 'stopped', 'closed', 'Old', $3, $4, 'S1')`,
      [old, A, at('09:00'), at('10:00')],
    );
    await admin.query(
      `INSERT INTO ticket_event (tenant_id, ticket_id, seq, type, at) VALUES
        ($1, $2, 0, 'down', $3), ($1, $2, 1, 'close', $4)`,
      [A, old, at('09:00'), at('10:00')],
    );
    expect((await read(old)).ticket.handback).toBeNull();
  });
});

describe('who may answer', () => {
  it('the reporter, an operator in the same cell, and a supervisor may; the rest may not', async () => {
    const ticketId = await closedBreakdown();
    const confirm = { response: 'confirmed' };
    expect((await answer(ticketId, 'lal', LEAD, confirm)).statusCode).toBe(403);
    expect((await answer(ticketId, 'cell2', OUTSIDER, confirm)).statusCode).toBe(403);
    expect((await answer(ticketId, 'floor2', FLOOR2, confirm)).statusCode).toBe(200);
    const second = await closedBreakdown();
    expect((await answer(second, 'sana', SUPER, confirm)).statusCode).toBe(200);
  });

  it('a shared phone answers as the person signed in on it, not whoever the request names', async () => {
    const ticketId = await closedBreakdown();
    const named = await answer(ticketId, 'cell1', REPORTER, { response: 'confirmed' });
    expect(named.statusCode).toBe(403);
    expect((await read(ticketId)).ticket.handback.status).toBe('requested');
  });
});

describe('confirm', () => {
  it('records who answered when; the ticket stays closed; a second answer is refused', async () => {
    const ticketId = await closedBreakdown();
    const res = await answer(ticketId, 'rina', REPORTER, { response: 'confirmed' });
    expect(res.statusCode).toBe(200);
    expect(res.json().ticket).toMatchObject({
      status: 'closed',
      handback: { status: 'confirmed', respondedByPersonId: REPORTER, reopenCount: 0 },
    });
    expect(res.json().ticket.handback.respondedAt).not.toBeNull();
    expect(
      (await answer(ticketId, 'rina', REPORTER, { response: 'disputed', reason: 'x' })).statusCode,
    ).toBe(409);
  });

  it('a replay with the same key gives the first answer and writes nothing twice', async () => {
    const ticketId = await closedBreakdown();
    const body = { personId: REPORTER, response: 'confirmed' };
    const request = {
      method: 'POST',
      url: `/api/v1/tickets/${ticketId}/handback`,
      token: tokens.rina!,
      payload: body,
    } as const;
    const first = await send(request, 'same-key');
    const replay = await send(request, 'same-key');
    expect(replay.statusCode).toBe(200);
    expect(replay.json()).toEqual(first.json());
  });
});

describe('dispute', () => {
  it('needs a reason', async () => {
    const ticketId = await closedBreakdown();
    expect((await answer(ticketId, 'rina', REPORTER, { response: 'disputed' })).statusCode).toBe(
      422,
    );
  });

  it('reopens the same ticket for the last lead, and the next close asks again', async () => {
    const ticketId = await closedBreakdown();
    const before = (await read(ticketId)).ticket;
    const res = await answer(ticketId, 'rina', REPORTER, {
      response: 'disputed',
      reason: 'Still stops',
    });
    expect(res.statusCode).toBe(200);
    const after = res.json().ticket;
    expect(after).toMatchObject({
      id: ticketId,
      ref: before.ref,
      status: 'working',
      leadPersonId: LEAD,
      closedAt: null,
      handback: { status: 'disputed', disputeReason: 'Still stops', reopenCount: 1 },
    });
    expect(after.segmentStartedAt).toBe(after.handback.respondedAt);
    const detail = await read(ticketId);
    expect(detail.events.map((e: { type: string }) => e.type)).toContain('handback_dispute');
    expect(detail.events.find((e: { type: string }) => e.type === 'handback_dispute').text).toBe(
      'Still stops',
    );

    const lal = { personId: LEAD, kind: 'done' };
    expect(
      (await call('POST', `/api/v1/tickets/${ticketId}/close`, tokens.lal!, lal)).statusCode,
    ).toBe(200);
    expect((await read(ticketId)).ticket.handback).toMatchObject({
      status: 'requested',
      reopenCount: 1,
    });
    expect((await answer(ticketId, 'rina', REPORTER, { response: 'confirmed' })).statusCode).toBe(
      200,
    );
  });

  it('tells the last lead, once, that their fix was sent back', async () => {
    const ticketId = await closedBreakdown();
    const told = () =>
      admin.query(
        "SELECT person_id FROM notification WHERE ticket_id = $1 AND kind = 'handback.disputed'",
        [ticketId],
      );
    expect((await told()).rowCount).toBe(0);
    await answer(ticketId, 'rina', REPORTER, { response: 'disputed', reason: 'Still stops' });
    expect((await told()).rows).toEqual([{ person_id: LEAD }]);
    await call('POST', `/api/v1/tickets/${ticketId}/cancel`, tokens.boss!, {
      personId: LEAD,
      reason: 'test',
    });
  });

  it('a ticket still being worked has nothing to sign off', async () => {
    const raised = await call('POST', '/api/v1/tickets', tokens.rina!, {
      machineId: MACHINE,
      problem: 'Open',
    });
    const open = raised.json().ticket.id as string;
    expect((await answer(open, 'sana', SUPER, { response: 'confirmed' })).statusCode).toBe(409);
    await call('POST', `/api/v1/tickets/${open}/cancel`, tokens.boss!, {
      personId: LEAD,
      reason: 'test',
    });
  });
});

describe('a plant that has not switched the SLA clocks on', () => {
  it('still asks, takes the answer and shows it, with no time limit', async () => {
    const policies = (await admin.query('SELECT * FROM sla_policy WHERE tenant_id = $1', [A])).rows;
    await admin.query('DELETE FROM sla_policy WHERE tenant_id = $1', [A]);
    try {
      const ticketId = await closedBreakdown();
      expect((await read(ticketId)).ticket.handback).toMatchObject({
        status: 'requested',
        dueAt: null,
      });
      const res = await answer(ticketId, 'rina', REPORTER, { response: 'confirmed' });
      expect(res.statusCode, res.body).toBe(200);
      expect(res.json().ticket.handback).toMatchObject({ status: 'confirmed' });
    } finally {
      for (const p of policies) {
        await admin.query(
          `INSERT INTO sla_policy (tenant_id, severity, ack_minutes, restore_minutes, handback_minutes)
           VALUES ($1, $2, $3, $4, $5)`,
          [A, p.severity, p.ack_minutes, p.restore_minutes, p.handback_minutes],
        );
      }
    }
  });
});

describe('an unanswered sign-off on the fake clock', () => {
  async function closedAt9(): Promise<string> {
    const ticketId = randomUUID();
    await admin.query(
      `INSERT INTO ticket (id, tenant_id, ref, kind, status, problem, reported_at, closed_at, severity, reported_by_person_id, last_event_seq)
       VALUES ($1, $2, $3, 'stopped', 'closed', 'Fake', $4, $5, 'S1', $6, 1)`,
      [ticketId, A, `BD-${ticketId.slice(0, 8)}`, at('08:00'), at('09:00'), REPORTER],
    );
    const events: Array<[string, Date, object]> = [
      ['down', at('08:00'), {}],
      ['close', at('09:00'), { handbackRequested: true }],
    ];
    for (const [index, [type, when, payload]] of events.entries()) {
      await admin.query(
        'INSERT INTO ticket_event (tenant_id, ticket_id, seq, type, at, payload) VALUES ($1, $2, $3, $4, $5, $6)',
        [A, ticketId, index, type, when, payload],
      );
    }
    await withTenant(db.app, A, (client) =>
      reconcileTicket(client, { tenantId: A, ticketId, now: at('09:00'), boss }),
    );
    return ticketId;
  }
  const timer = async (ticketId: string) =>
    (
      await admin.query("SELECT * FROM sla_timer WHERE ticket_id = $1 AND kind = 'handback'", [
        ticketId,
      ])
    ).rows[0];
  const fire = async (ticketId: string, hhmm: string) =>
    processSlaTimerJob(
      {
        tenantId: A,
        ticketId,
        kind: 'handback',
        revision: (await timer(ticketId)).revision,
      } as SlaTimerPayload,
      { pool: db.app, now: () => at(hhmm), boss },
    );

  it('is quiet until the policy time, then times out once', async () => {
    const ticketId = await closedAt9();
    expect(new Date((await timer(ticketId)).due_at).toISOString()).toBe(at('10:00').toISOString());
    expect(await fire(ticketId, '09:59')).toBe(false);
    expect(await fire(ticketId, '10:01')).toBe(true);
    expect(await fire(ticketId, '10:30')).toBe(false);
    expect((await read(ticketId)).ticket.handback).toMatchObject({ status: 'timed_out' });
  });

  it('the ticket stays closed, and a late answer is still taken', async () => {
    const ticketId = await closedAt9();
    expect(await fire(ticketId, '10:01')).toBe(true);
    const res = await answer(ticketId, 'sana', SUPER, { response: 'confirmed' });
    expect(res.statusCode, res.body).toBe(200);
    expect(res.json().ticket).toMatchObject({
      status: 'closed',
      handback: { status: 'confirmed' },
    });
    expect(await fire(ticketId, '11:00')).toBe(false);
  });

  it('an answer before the time stops the clock: nothing fires', async () => {
    const ticketId = await closedAt9();
    const armed = await timer(ticketId);
    await admin.query(
      `INSERT INTO ticket_event (tenant_id, ticket_id, seq, type, at, acting_person_id)
       VALUES ($1, $2, 2, 'handback_confirm', $3, $4)`,
      [A, ticketId, at('09:30'), REPORTER],
    );
    await withTenant(db.app, A, (client) =>
      reconcileTicket(client, { tenantId: A, ticketId, now: at('09:31'), boss }),
    );
    expect(await timer(ticketId)).toMatchObject({ state: 'stopped', stop_reason: 'confirmed' });
    expect(
      await processSlaTimerJob(
        { tenantId: A, ticketId, kind: 'handback', revision: armed.revision },
        { pool: db.app, now: () => at('10:30'), boss },
      ),
    ).toBe(false);
    expect((await timer(ticketId)).fired_at).toBeNull();
  });

  it('a plant with no limit never times out', async () => {
    await admin.query('UPDATE sla_policy SET handback_minutes = NULL WHERE tenant_id = $1', [A]);
    try {
      const ticketId = await closedAt9();
      expect(await timer(ticketId)).toBeUndefined();
      expect((await read(ticketId)).ticket.handback).toMatchObject({
        status: 'requested',
        dueAt: null,
      });
    } finally {
      await admin.query('UPDATE sla_policy SET handback_minutes = 60 WHERE tenant_id = $1', [A]);
    }
  });
});
