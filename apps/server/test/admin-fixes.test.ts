import { randomUUID } from 'node:crypto';
import { hash } from '@node-rs/argon2';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../src/app.js';
import { startTestDb, type TestDb } from './harness.js';

/**
 * Cancel, restore and correct (DOMAIN §2, §3): who may do them, the 7-day limits, a second person racing the same
 * action, and that every change keeps its old and new values with the reason, in the ticket's history and in the audit trail.
 */
const TENANT = randomUUID();
const PASSWORD = 'correct-horse-battery';
const ROLES = [
  'operator',
  'technician',
  'supervisor',
  'head',
  'plant_head',
  'admin',
  'board',
] as const;
type Role = (typeof ROLES)[number];
const DAY = 86_400_000;

let db: TestDb;
let app: Awaited<ReturnType<typeof buildApp>>;
const token = new Map<string, string>();
const person = new Map<string, string>();
const machines: string[] = [];
let nextMachine = 0;
let keys = 0;

type Res = Awaited<ReturnType<typeof app.inject>>;
const call = (method: 'POST' | 'GET', url: string, who: string, payload?: object): Promise<Res> => {
  keys += 1;
  return app.inject({
    method,
    url,
    headers: {
      host: 'cosmos.localhost',
      authorization: `Bearer ${token.get(who)}`,
      ...(method === 'POST'
        ? { 'content-type': 'application/json', 'idempotency-key': `fix-${keys}` }
        : {}),
    },
    ...(payload ? { payload } : {}),
  });
};
const act = (id: string, action: string, who: string, extra: object = {}): Promise<Res> =>
  call('POST', `/api/v1/tickets/${id}/${action}`, who, { personId: person.get(who), ...extra });
const correct = (
  id: string,
  who: string,
  changes: object,
  reason = 'Fixing the record',
): Promise<Res> => call('POST', `/api/v1/tickets/${id}/correct`, who, { reason, changes });
const detail = async (id: string) => (await call('GET', `/api/v1/tickets/${id}`, 'admin')).json();

async function raise(who: string, machineId = machines[nextMachine++]): Promise<string> {
  const res = await call('POST', '/api/v1/tickets', who, { machineId, problem: 'Spindle alarm' });
  expect(res.statusCode).toBe(201);
  return res.json().ticket.id as string;
}
/** A ticket raised and led by asha; `waiting` has been paused, `closed` closed without a report. */
async function ticketIn(state: 'open' | 'working' | 'waiting' | 'closed'): Promise<string> {
  const id = await raise('asha');
  if (state === 'open') return id;
  expect((await act(id, 'start', 'asha')).statusCode).toBe(200);
  if (state === 'waiting') await act(id, 'pause', 'asha', { reasonCode: 'spare' });
  if (state === 'closed')
    expect((await act(id, 'close', 'asha', { kind: 'no_report', note: 'done' })).statusCode).toBe(
      200,
    );
  return id;
}
const audit = async (id: string, action: string) =>
  (
    await db.admin.query(
      'SELECT before, after, login_id FROM audit_log WHERE entity_id = $1 AND action = $2',
      [id, action],
    )
  ).rows;

beforeAll(async () => {
  db = await startTestDb();
  await db.admin.query("INSERT INTO tenant (id, slug, name) VALUES ($1, 'cosmos', 'Cosmos')", [
    TENANT,
  ]);
  const segment = randomUUID();
  await db.admin.query(
    "INSERT INTO segment (id, tenant_id, code, name, sort) VALUES ($1, $2, 'CNC', 'CNC', 0)",
    [segment, TENANT],
  );
  for (let i = 0; i < 90; i += 1) {
    const id = randomUUID();
    machines.push(id);
    await db.admin.query(
      "INSERT INTO machine (id, tenant_id, code, segment_id, category, cell, criticality) VALUES ($1, $2, $3, $4, 'VMC', 'C', $5)",
      [id, TENANT, `M-${i}`, segment, i % 2 === 0 ? 'A' : 'C'],
    );
  }
  await db.admin.query(
    "INSERT INTO list_item (tenant_id, list, code, label, pauses_sla) VALUES ($1, 'wait_reason', 'spare', 'Waiting for spare', false)",
    [TENANT],
  );
  await db.admin.query(
    "INSERT INTO ref_counter (tenant_id, prefix, next_value) VALUES ($1, 'BD', 1)",
    [TENANT],
  );
  const passwordHash = await hash(PASSWORD, {
    algorithm: 2,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
  const users = [...ROLES.map(String), 'asha', 'bina', 'opera'];
  for (const name of users) {
    const id = randomUUID();
    person.set(name, id);
    await db.admin.query(
      "INSERT INTO person (id, tenant_id, name, team, title) VALUES ($1, $2, $3, 'maintenance', 'Technician')",
      [id, TENANT, name],
    );
    const role = ROLES.includes(name as Role) ? name : name === 'opera' ? 'operator' : 'technician';
    await db.admin.query(
      'INSERT INTO login (tenant_id, person_id, username, password_hash, role, shared) VALUES ($1, $2, $3, $4, $5, false)',
      [TENANT, id, name, passwordHash, role],
    );
  }
  app = await buildApp({ pool: db.app, logger: false, rateLimitMax: 100000 });
  for (const name of users) {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { host: 'cosmos.localhost', 'content-type': 'application/json' },
      payload: { username: name, password: PASSWORD },
    });
    token.set(name, res.json().token as string);
  }
}, 240_000);

afterAll(async () => {
  vi.useRealTimers();
  await app.close();
  await db.stop();
});

describe('cancel', () => {
  it('the desk cancels any live ticket; the floor only its own, not yet started', async () => {
    for (const role of ROLES) {
      const want = ['technician', 'supervisor', 'head', 'admin'].includes(role) ? 200 : 403;
      const id = await ticketIn('working');
      const res = await act(id, 'cancel', role, { reason: 'Raised by mistake' });
      expect(`${role} ${res.statusCode}`).toBe(`${role} ${want}`);
    }
    const own = await raise('opera');
    expect((await act(own, 'cancel', 'opera', { reason: 'Wrong machine' })).statusCode).toBe(200);
    const others = await ticketIn('open');
    expect((await act(others, 'cancel', 'opera', { reason: 'x' })).statusCode).toBe(403);
    const started = await raise('opera');
    await act(started, 'start', 'asha');
    expect((await act(started, 'cancel', 'opera', { reason: 'x' })).statusCode).toBe(403);
  });

  it('needs a reason, refuses a closed ticket, and a second person racing it gets 409', async () => {
    const id = await ticketIn('working');
    expect((await act(id, 'cancel', 'asha', {})).statusCode).toBe(422);
    const [a, b] = await Promise.all([
      act(id, 'cancel', 'asha', { reason: 'Mistake' }),
      act(id, 'cancel', 'bina', { reason: 'Mistake' }),
    ]);
    expect([a.statusCode, b.statusCode].sort()).toEqual([200, 409]);
    const closed = await ticketIn('closed');
    expect((await act(closed, 'cancel', 'asha', { reason: 'x' })).statusCode).toBe(409);
  });

  it('keeps the old and new status with the reason in the audit trail', async () => {
    const id = await ticketIn('working');
    await act(id, 'cancel', 'bina', { reason: 'Duplicate of BD-9' });
    const rows = await audit(id, 'ticket.cancel');
    expect(rows).toHaveLength(1);
    expect(rows[0].before).toMatchObject({ status: 'working' });
    expect(rows[0].after).toMatchObject({ status: 'cancelled', reason: 'Duplicate of BD-9' });
  });
});

describe('restore', () => {
  it('is for the admin only', async () => {
    for (const role of ROLES) {
      const id = await ticketIn('open');
      await act(id, 'cancel', 'asha', { reason: 'Mistake' });
      const res = await act(id, 'restore', role, { reason: 'Cancelled by mistake' });
      expect(`${role} ${res.statusCode}`).toBe(`${role} ${role === 'admin' ? 200 : 403}`);
    }
  });

  it('puts the ticket back where it was, and keeps old and new in the audit trail', async () => {
    for (const state of ['open', 'working', 'waiting'] as const) {
      const id = await ticketIn(state);
      await act(id, 'cancel', 'asha', { reason: 'Mistake' });
      const res = await act(id, 'restore', 'admin', { reason: 'Cancelled by mistake' });
      expect(res.statusCode).toBe(200);
      expect(res.json().ticket.status).toBe(state);
      const rows = await audit(id, 'ticket.restore');
      expect(rows[0].before).toMatchObject({ status: 'cancelled' });
      expect(rows[0].after).toMatchObject({ status: state, reason: 'Cancelled by mistake' });
    }
  });

  it('works within 7 days of the cancel and not after', async () => {
    const id = await ticketIn('open');
    await act(id, 'cancel', 'asha', { reason: 'Mistake' });
    vi.useFakeTimers({ toFake: ['Date'], now: Date.now() + 8 * DAY });
    try {
      expect((await act(id, 'restore', 'admin', { reason: 'Too late' })).statusCode).toBe(409);
    } finally {
      vi.useRealTimers();
    }
    expect((await act(id, 'restore', 'admin', { reason: 'In time' })).statusCode).toBe(200);
  });

  it('refuses when the machine already has an open breakdown, and a second restore racing the first', async () => {
    const machine = machines[nextMachine++];
    const first = await raise('asha', machine);
    await act(first, 'cancel', 'asha', { reason: 'Mistake' });
    await raise('asha', machine);
    expect((await act(first, 'restore', 'admin', { reason: 'x' })).statusCode).toBe(409);
    const id = await ticketIn('open');
    await act(id, 'cancel', 'asha', { reason: 'Mistake' });
    const [a, b] = await Promise.all([
      act(id, 'restore', 'admin', { reason: 'Mistake' }),
      act(id, 'restore', 'admin', { reason: 'Mistake' }),
    ]);
    expect([a.statusCode, b.statusCode].sort()).toEqual([200, 409]);
  });
});

describe('correct', () => {
  it('is for the admin only', async () => {
    for (const role of ROLES) {
      const id = await ticketIn('working');
      const res = await correct(id, role, { problem: 'Spindle alarm on start-up' });
      expect(`${role} ${res.statusCode}`).toBe(`${role} ${role === 'admin' ? 200 : 403}`);
    }
  });

  it('changes the machine and the kind, and keeps old and new with the reason in the history and the audit trail', async () => {
    const from = machines[nextMachine++];
    const to = machines[nextMachine++];
    const id = await raise('asha', from);
    await act(id, 'start', 'asha');
    const res = await correct(
      id,
      'admin',
      { machineId: to, kind: 'support' },
      'Wrong machine and not a stop',
    );
    expect(res.statusCode).toBe(200);
    expect(res.json().ticket).toMatchObject({ machineId: to, kind: 'support' });
    const edit = (await detail(id)).events.find((e: { type: string }) => e.type === 'edit');
    expect(edit.reason).toBe('Wrong machine and not a stop');
    expect(edit.changes).toEqual(
      expect.arrayContaining([
        { field: 'machineId', from, to },
        { field: 'kind', from: 'stopped', to: 'support' },
      ]),
    );
    const rows = await audit(id, 'ticket.correct');
    expect(rows[0].before).toMatchObject({ machineId: from, kind: 'stopped' });
    expect(rows[0].after).toMatchObject({
      machineId: to,
      kind: 'support',
      reason: 'Wrong machine and not a stop',
    });
  });

  it('the severity follows the corrected machine', async () => {
    const critical = machines[nextMachine++]; // A
    const minor = machines[nextMachine++]; // C
    const id = await raise('asha', critical);
    const before = (await detail(id)).ticket.severity;
    const res = await correct(id, 'admin', { machineId: minor });
    expect(res.json().ticket.severity).not.toBe(before);
  });

  it('refuses a machine that has an open breakdown, an unknown machine, and a breakdown with no machine', async () => {
    const busy = machines[nextMachine++];
    await raise('asha', busy);
    const id = await raise('asha');
    expect((await correct(id, 'admin', { machineId: busy })).statusCode).toBe(409);
    expect((await correct(id, 'admin', { machineId: randomUUID() })).statusCode).toBe(404);
    expect((await correct(id, 'admin', { machineId: null })).statusCode).toBe(409);
  });

  it('sets hands-on and waiting minutes directly on a closed ticket, marked as set by hand, and null takes them off', async () => {
    const id = await ticketIn('closed');
    const res = await correct(id, 'admin', { activeMin: 45, waitMin: 12 });
    expect(res.statusCode).toBe(200);
    const figures = (await detail(id)).ticket.figures;
    expect(figures).toMatchObject({ activeMin: 45, waitMin: 12 });
    expect(figures.overridden).toEqual(expect.arrayContaining(['activeMin', 'waitMin']));
    const edit = (await detail(id)).events.find((e: { type: string }) => e.type === 'edit');
    expect(edit.changes).toEqual(
      expect.arrayContaining([
        { field: 'handsOnOverrideMin', from: expect.any(Number), to: 45 },
        { field: 'waitingOverrideMin', from: expect.any(Number), to: 12 },
      ]),
    );
    expect((await correct(id, 'admin', { activeMin: null })).statusCode).toBe(200);
    const after = (await detail(id)).ticket.figures;
    expect(after.overridden ?? []).not.toContain('activeMin');
    expect(after.overridden).toContain('waitMin');
    const live = await ticketIn('working');
    expect((await correct(live, 'admin', { activeMin: 10 })).statusCode).toBe(409);
  });

  it('refuses times out of order, a cancelled ticket, and a ticket closed more than 7 days ago', async () => {
    const id = await ticketIn('working');
    expect((await correct(id, 'admin', { startedAt: '2020-01-01T00:00:00Z' })).statusCode).toBe(
      422,
    );
    const gone = await ticketIn('open');
    await act(gone, 'cancel', 'asha', { reason: 'Mistake' });
    expect((await correct(gone, 'admin', { problem: 'x' })).statusCode).toBe(409);
    const closed = await ticketIn('closed');
    vi.useFakeTimers({ toFake: ['Date'], now: Date.now() + 8 * DAY });
    try {
      expect((await correct(closed, 'admin', { problem: 'Late fix' })).statusCode).toBe(409);
    } finally {
      vi.useRealTimers();
    }
    expect((await correct(closed, 'admin', { problem: 'In time' })).statusCode).toBe(200);
  });

  it('needs a reason, and a second correction racing the first is not lost', async () => {
    const id = await ticketIn('working');
    const none = await call('POST', `/api/v1/tickets/${id}/correct`, 'admin', {
      changes: { problem: 'x' },
    });
    expect(none.statusCode).toBe(422);
    const [a, b] = await Promise.all([
      correct(id, 'admin', { problem: 'First wording' }),
      correct(id, 'admin', { problem: 'Second wording' }),
    ]);
    expect([a.statusCode, b.statusCode]).toEqual([200, 200]);
    expect(
      (await detail(id)).events.filter((e: { type: string }) => e.type === 'edit'),
    ).toHaveLength(2);
  });
});

describe('a correction cannot rewrite what happened', () => {
  const HOUR = 3_600_000;
  /** Raised 08:00, started 10:00, closed 12:00 (two days ago), then the clock is back at the real time. */
  async function closedTwoDaysAgo(): Promise<{
    id: string;
    at: (h: number) => string;
    closedAt: number;
  }> {
    const base = Math.floor((Date.now() - 2 * DAY) / DAY) * DAY + 8 * HOUR;
    const at = (h: number) => new Date(base + (h - 8) * HOUR).toISOString();
    vi.useFakeTimers({ toFake: ['Date'], now: new Date(at(8)) });
    try {
      const id = await raise('asha');
      vi.setSystemTime(new Date(at(10)));
      await act(id, 'start', 'asha');
      vi.setSystemTime(new Date(at(12)));
      expect((await act(id, 'close', 'asha', { kind: 'no_report', note: 'done' })).statusCode).toBe(
        200,
      );
      return { id, at, closedAt: new Date(at(12)).getTime() };
    } finally {
      vi.useRealTimers();
    }
  }

  it('refuses times that disagree with the work recorded on the ticket, with the reason (422)', async () => {
    const { id, at } = await closedTwoDaysAgo();
    for (const changes of [
      { startedAt: at(9), closedAt: at(9.5) }, // the reviewer's case
      { startedAt: at(10.5) },
      { reportedAt: at(10.5) },
      { closedAt: at(11) },
    ]) {
      const res = await correct(id, 'admin', changes);
      expect(JSON.stringify(changes) + res.statusCode).toBe(JSON.stringify(changes) + 422);
      expect(res.json().error.message).toMatch(/^Invalid correction/);
    }
    expect((await correct(id, 'admin', { startedAt: at(9), closedAt: at(12) })).statusCode).toBe(
      200,
    );
  });

  it('the 7-day window is measured from the close and a correction cannot push it out', async () => {
    const { id, closedAt } = await closedTwoDaysAgo();
    // an hour short of seven days after the close, whatever the hour of the real clock: still inside the window,
    // but the close cannot be moved to now
    vi.useFakeTimers({ toFake: ['Date'], now: closedAt + 7 * DAY - 3_600_000 });
    try {
      expect((await correct(id, 'admin', { closedAt: new Date().toISOString() })).statusCode).toBe(
        422,
      );
      expect((await correct(id, 'admin', { problem: 'Inside the window' })).statusCode).toBe(200);
      vi.setSystemTime(new Date(Date.now() + 2 * DAY));
      expect((await correct(id, 'admin', { problem: 'Day 9' })).statusCode).toBe(409);
    } finally {
      vi.useRealTimers();
    }
  });

  it('a closing time only on a closed ticket', async () => {
    const id = await ticketIn('working');
    expect((await correct(id, 'admin', { closedAt: new Date().toISOString() })).statusCode).toBe(
      409,
    );
  });
});

describe('answers that do not depend on what the ticket looks like', () => {
  it('is 403 before 404 for a correction by someone who may not, and for plant head and board cancelling any state', async () => {
    for (const role of ['technician', 'plant_head', 'board']) {
      const res = await call('POST', `/api/v1/tickets/${randomUUID()}/correct`, role, {
        reason: 'x',
        changes: { machineId: randomUUID() },
      });
      expect(`${role} ${res.statusCode}`).toBe(`${role} 403`);
    }
    const closed = await ticketIn('closed');
    for (const role of ['plant_head', 'board'])
      expect((await act(closed, 'cancel', role, { reason: 'x' })).statusCode).toBe(403);
  });

  it('an unknown person in a correction is 404, and a corrected machine replaces the machine shown', async () => {
    const from = machines[nextMachine++];
    const to = machines[nextMachine++];
    const id = await raise('asha', from);
    expect((await correct(id, 'admin', { leadPersonId: randomUUID() })).statusCode).toBe(404);
    expect((await correct(id, 'admin', { closedByPersonId: randomUUID() })).statusCode).toBe(404);
    const res = await correct(id, 'admin', { machineId: to });
    expect(res.json().ticket.machineSnapshot).toMatchObject({ code: expect.stringMatching(/^M-/) });
    const code = (await db.admin.query('SELECT code FROM machine WHERE id = $1', [to])).rows[0]
      .code;
    expect((await detail(id)).ticket.machineSnapshot.code).toBe(code);
  });
});
