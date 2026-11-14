import { randomUUID } from 'node:crypto';
import { hash } from '@node-rs/argon2';
import type { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { startTestDb, type TestDb } from './harness.js';

// On a shared login the acting person is the one chosen on that phone, for every ticket command. A request that
// names someone else is refused before anything is written. On a personal login it is the login's own person.
const TENANT = '82000000-0000-0000-0000-000000000001';
const SHIFT = '82000000-0000-0000-0000-000000000002';
const PASSWORD = 'correct-horse-battery';
const HOST = 'acting.localhost';

type App = Awaited<ReturnType<typeof buildApp>>;
let db: TestDb;
let admin: Pool;
let app: App;
let key = 0;
const people: Record<string, string> = {};
const tokens: Record<string, string> = {};
const machines: string[] = [];

function call(method: 'GET' | 'POST', url: string, as: string, payload?: object) {
  key += 1;
  return app.inject({
    method,
    url,
    headers: {
      host: HOST,
      'content-type': 'application/json',
      authorization: `Bearer ${tokens[as]}`,
      'idempotency-key': `acting-${key}`,
    },
    ...(payload ? { payload } : {}),
  });
}

const choose = async (as: string, who: string | null) => {
  if (who === null) {
    await admin.query(
      'UPDATE session SET acting_person_id = NULL WHERE login_id = (SELECT id FROM login WHERE username = $1)',
      [as],
    );
    return;
  }
  const res = await call('POST', '/api/v1/auth/acting', as, { actingPersonId: people[who] });
  expect(res.statusCode, res.body).toBe(200);
};

async function ticketIn(kind: 'stopped' | 'support' = 'stopped'): Promise<string> {
  const machineId = machines.shift();
  if (!machineId) throw new Error('out of machines');
  const res = await call('POST', '/api/v1/tickets', 'asha', {
    kind,
    machineId,
    problem: 'Spindle',
  });
  expect(res.statusCode, res.body).toBe(201);
  return res.json().ticket.id as string;
}

const act = async (id: string, as: string, action: string, body: object = {}) => {
  const res = await call('POST', `/api/v1/tickets/${id}/${action}`, as, body);
  expect(res.statusCode, `${action}: ${res.body}`).toBe(200);
};

const detailOf = async (id: string) => (await call('GET', `/api/v1/tickets/${id}`, 'asha')).json();

type Clock = {
  state: string;
  dueAt: string | null;
  stoppedAt: string | null;
  pausedAt: string | null;
};

/** Everything a refused command must leave alone, read through the API: the ticket, its history, crew and clocks. */
async function snapshot(id: string) {
  const { ticket, events, people: crew, intervals, report } = await detailOf(id);
  const clocks = Object.fromEntries(
    Object.entries((ticket.sla ?? {}) as Record<string, Clock | null>).map(([name, clock]) => [
      name,
      clock && {
        state: clock.state,
        dueAt: clock.dueAt,
        stoppedAt: clock.stoppedAt,
        pausedAt: clock.pausedAt,
      },
    ]),
  );
  return {
    status: ticket.status,
    lead: ticket.leadPersonId,
    assignee: ticket.assignedToPersonId,
    closedBy: ticket.closedByPersonId,
    lastEventSeq: ticket.lastEventSeq,
    events: events.map((e: { seq: number; type: string; actingPersonId: string | null }) => [
      e.seq,
      e.type,
      e.actingPersonId,
    ]),
    crew,
    intervals,
    clocks,
    report,
  };
}

const eventsAfter = async (id: string, seq: number) =>
  (
    (await detailOf(id)).events as Array<{
      seq: number;
      type: string;
      actingPersonId: string | null;
    }>
  )
    .filter((event) => event.seq > seq)
    .map(({ type, actingPersonId }) => ({ type, actingPersonId }));

const lastSeq = async (id: string) => (await detailOf(id)).ticket.lastEventSeq as number;

/** One command per family: how to get a ticket ready, and the body the command carries besides who acts. */
interface Family {
  action: string;
  ready: () => Promise<string>;
  body: object;
  /** The person the command ends up crediting, when the ticket row says so. */
  credited?: (id: string) => Promise<unknown>;
}

const leadOf = async (id: string) => (await detailOf(id)).ticket.leadPersonId;

const working = async (kind: 'stopped' | 'support' = 'stopped') => {
  const id = await ticketIn(kind);
  await act(id, 'asha', 'start', { personId: people.asha });
  return id;
};

const FAMILIES: Family[] = [
  { action: 'start', ready: () => ticketIn(), body: {}, credited: leadOf },
  { action: 'update', ready: () => working(), body: { text: 'Replaced belt' } },
  { action: 'pause', ready: () => working(), body: { reasonCode: 'spare' } },
  {
    action: 'resume',
    ready: async () => {
      const id = await working();
      await act(id, 'asha', 'pause', { personId: people.asha, reasonCode: 'spare' });
      return id;
    },
    body: {},
  },
  { action: 'transfer', ready: () => working(), body: { note: 'Next shift takes over' } },
  {
    action: 'machine-running',
    ready: () => working(),
    body: {},
  },
  {
    action: 'machine-stopped',
    ready: async () => {
      const id = await working();
      await act(id, 'asha', 'machine-running', { personId: people.asha });
      return id;
    },
    body: {},
  },
  {
    action: 'join',
    ready: () => working(),
    body: { role: 'support' },
  },
  {
    action: 'leave',
    ready: async () => {
      const id = await working();
      await act(id, 'bina', 'join', { personId: people.bina, role: 'support' });
      return id;
    },
    body: { reason: 'Other job' },
  },
  { action: 'close', ready: () => working(), body: { kind: 'no_report' } },
  {
    action: 'report',
    ready: async () => {
      const id = await working();
      await act(id, 'asha', 'close', { personId: people.asha, kind: 'no_report' });
      return id;
    },
    body: { report: { problem: 'Late report', downtimeMin: 30 } },
  },
  { action: 'cancel', ready: () => ticketIn(), body: { reason: 'Raised twice' } },
  { action: 'upgrade-kind', ready: () => ticketIn('support'), body: {} },
];

describe.each(FAMILIES)('$action', (family) => {
  it('on a shared phone with bina chosen, naming asha is refused and nothing changes', async () => {
    const id = await family.ready();
    await choose('shared', 'bina');
    const before = await snapshot(id);
    const res = await call('POST', `/api/v1/tickets/${id}/${family.action}`, 'shared', {
      ...family.body,
      personId: people.asha,
    });
    expect(res.statusCode, res.body).toBe(403);
    expect(res.json().error).toMatchObject({ code: 'forbidden', field: 'personId' });
    expect(await snapshot(id)).toEqual(before);
  });

  it('on a shared phone with nobody chosen, asks who is using it and changes nothing', async () => {
    const id = await family.ready();
    await choose('shared', null);
    const before = await snapshot(id);
    const res = await call('POST', `/api/v1/tickets/${id}/${family.action}`, 'shared', {
      ...family.body,
      personId: people.asha,
    });
    expect(res.statusCode, res.body).toBe(403);
    expect(res.json().error.code).toBe('choose_acting_person');
    expect(await snapshot(id)).toEqual(before);
  });

  it('on a personal login, naming someone else is refused and nothing changes', async () => {
    const id = await family.ready();
    const before = await snapshot(id);
    const res = await call('POST', `/api/v1/tickets/${id}/${family.action}`, 'bina', {
      ...family.body,
      personId: people.asha,
    });
    expect(res.statusCode, res.body).toBe(403);
    expect(res.json().error.code).toBe('forbidden');
    expect(await snapshot(id)).toEqual(before);
  });

  it('on a shared phone, the chosen person acts, named or not, and is the one on the history', async () => {
    for (const named of [true, false]) {
      const id = await family.ready();
      await choose('shared', 'bina');
      const seq = await lastSeq(id);
      const res = await call('POST', `/api/v1/tickets/${id}/${family.action}`, 'shared', {
        ...family.body,
        ...(named ? { personId: people.bina } : {}),
      });
      expect(res.statusCode, res.body).toBe(200);
      const written = await eventsAfter(id, seq);
      expect(written.length).toBeGreaterThan(0);
      expect(written.map((event) => event.actingPersonId)).toEqual(written.map(() => people.bina));
      if (family.credited) expect(await family.credited(id)).toBe(people.bina);
    }
  });
});

describe('restore and correct (admin only)', () => {
  it('restore on a personal login refuses another person; the admin acts as themselves', async () => {
    const id = await ticketIn();
    await act(id, 'root', 'cancel', { personId: people.root, reason: 'Raised twice' });
    const before = await snapshot(id);
    const refused = await call('POST', `/api/v1/tickets/${id}/restore`, 'root', {
      personId: people.asha,
      reason: 'Needed after all',
    });
    expect(refused.statusCode, refused.body).toBe(403);
    expect(await snapshot(id)).toEqual(before);
    const seq = await lastSeq(id);
    const ok = await call('POST', `/api/v1/tickets/${id}/restore`, 'root', {
      reason: 'Needed after all',
    });
    expect(ok.statusCode, ok.body).toBe(200);
    expect((await eventsAfter(id, seq)).map((e) => e.actingPersonId)).toEqual([people.root]);
  });

  it('a correction is the admin’s own act, whatever the body says', async () => {
    const id = await ticketIn();
    const seq = await lastSeq(id);
    const res = await call('POST', `/api/v1/tickets/${id}/correct`, 'root', {
      personId: people.asha,
      reason: 'Typo',
      changes: { problem: 'Spindle noise' },
    });
    expect(res.statusCode, res.body).toBe(200);
    expect((await eventsAfter(id, seq)).map((e) => e.actingPersonId)).toEqual([people.root]);
  });
});

describe('raising a ticket', () => {
  const ticketCount = async () =>
    ((await call('GET', '/api/v1/tickets?limit=200', 'asha')).json().items as unknown[]).length;
  const raiseAs = (as: string, body: object) =>
    call('POST', '/api/v1/tickets', as, { machineId: machines[0], problem: 'Spindle', ...body });

  it('refuses a start naming someone else and creates nothing, on a shared and a personal login', async () => {
    await choose('shared', 'bina');
    for (const as of ['shared', 'bina']) {
      const before = await ticketCount();
      const res = await raiseAs(as, { startNow: true, startByPersonId: people.asha });
      expect(res.statusCode, `${as}: ${res.body}`).toBe(403);
      expect(res.json().error).toMatchObject({ code: 'forbidden', field: 'startByPersonId' });
      expect(await ticketCount()).toBe(before);
    }
  });

  it('starts the work as the chosen person, even when the report names another reporter', async () => {
    await choose('shared', 'bina');
    const res = await raiseAs('shared', { startNow: true, reportedByPersonId: people.asha });
    machines.shift();
    expect(res.statusCode, res.body).toBe(201);
    const ticket = res.json().ticket;
    expect(ticket.leadPersonId).toBe(people.bina);
    expect(ticket.reportedByPersonId).toBe(people.asha);
    const events = await eventsAfter(ticket.id, -1);
    expect(events.map((event) => event.actingPersonId)).toEqual(events.map(() => people.bina));
    const { intervals } = await detailOf(ticket.id);
    expect(intervals.map((i: { personId: string }) => i.personId)).toEqual([people.bina]);
  });

  it('does not let an operator start work by raising: refused, and nothing is created', async () => {
    await choose('floor', 'omkar');
    for (const as of ['omkar', 'floor']) {
      const before = await ticketCount();
      const res = await raiseAs(as, { startNow: true });
      expect(res.statusCode, `${as}: ${res.body}`).toBe(403);
      expect(res.json().error).toMatchObject({ code: 'forbidden', field: 'startNow' });
      expect(await ticketCount()).toBe(before);
    }
    const plain = await raiseAs('omkar', {});
    machines.shift();
    expect(plain.statusCode, plain.body).toBe(201);
    expect(plain.json().ticket.status).toBe('open');
  });

  it('lets only maintenance name a reporter other than themselves; an operator reports as themselves', async () => {
    await choose('floor', 'omkar');
    for (const as of ['omkar', 'floor']) {
      const before = await ticketCount();
      const res = await raiseAs(as, { reportedByPersonId: people.asha });
      expect(res.statusCode, `${as}: ${res.body}`).toBe(403);
      expect(res.json().error).toMatchObject({ code: 'forbidden', field: 'reportedByPersonId' });
      expect(await ticketCount()).toBe(before);
    }
    const own = await raiseAs('omkar', { reportedByPersonId: people.omkar });
    machines.shift();
    expect(own.statusCode, own.body).toBe(201);
    expect(own.json().ticket.reportedByPersonId).toBe(people.omkar);
    await choose('shared', 'bina');
    const named = await raiseAs('shared', { reportedByPersonId: people.asha });
    machines.shift();
    expect(named.statusCode, named.body).toBe(201);
    expect(named.json().ticket.reportedByPersonId).toBe(people.asha);
  });

  describe('who hears about a new breakdown', () => {
    const told = async (ticketId: string) =>
      (
        await admin.query(
          "SELECT person_id FROM notification WHERE ticket_id = $1 AND kind = 'breakdown.new'",
          [ticketId],
        )
      ).rows.map((row: { person_id: string }) => row.person_id);

    it('skips the person who raised it, not a reporter they named', async () => {
      await choose('shared', 'bina');
      const named = await raiseAs('shared', { reportedByPersonId: people.asha });
      machines.shift();
      expect(named.statusCode, named.body).toBe(201);
      expect(await told(named.json().ticket.id)).toEqual([people.asha]);
      const own = await raiseAs('asha', {});
      machines.shift();
      expect(await told(own.json().ticket.id)).toEqual([people.bina]);
    });
  });

  it('answers a replay with the first reply only to the person who sent it', async () => {
    await choose('shared', 'bina');
    const machineId = machines.shift();
    const send = (idem: string) =>
      app.inject({
        method: 'POST',
        url: '/api/v1/tickets',
        headers: {
          host: HOST,
          'content-type': 'application/json',
          authorization: `Bearer ${tokens.shared}`,
          'idempotency-key': idem,
        },
        payload: { machineId, problem: 'Spindle' },
      });
    const first = await send('raise-switch');
    expect(first.statusCode, first.body).toBe(201);
    expect((await send('raise-switch')).json()).toEqual(first.json());
    await choose('shared', 'asha');
    const other = await send('raise-switch');
    expect(other.statusCode, other.body).toBe(422);
    expect(other.json().error).toMatchObject({ code: 'validation', field: 'idempotencyKey' });
  });
});

describe('a command replayed after the phone changed hands', () => {
  const start = (id: string, idem: string) =>
    app.inject({
      method: 'POST',
      url: `/api/v1/tickets/${id}/start`,
      headers: {
        host: HOST,
        'content-type': 'application/json',
        authorization: `Bearer ${tokens.shared}`,
        'idempotency-key': idem,
      },
      payload: {},
    });

  it('is not answered with the first person’s reply, and writes nothing; the same person still gets the replay', async () => {
    const id = await ticketIn();
    await choose('shared', 'bina');
    const first = await start(id, 'start-switch');
    expect(first.statusCode, first.body).toBe(200);
    await choose('shared', 'asha');
    const before = await snapshot(id);
    const other = await start(id, 'start-switch');
    expect(other.statusCode, other.body).toBe(422);
    expect(other.json().error).toMatchObject({ code: 'validation', field: 'idempotencyKey' });
    expect(await snapshot(id)).toEqual(before);
    await choose('shared', 'bina');
    expect((await start(id, 'start-switch')).json()).toEqual(first.json());
  });
});

describe('recording a past breakdown', () => {
  it('names the people involved, but the chosen person is the one who recorded it', async () => {
    await choose('shared', 'bina');
    const res = await call('POST', '/api/v1/tickets/past', 'shared', {
      machineId: machines.shift(),
      reportedAt: '2026-03-10T04:00:00.000Z',
      runningAt: '2026-03-10T05:00:00.000Z',
      problem: 'Belt snapped',
      reportedByPersonId: people.asha,
    });
    expect(res.statusCode, res.body).toBe(201);
    const id = res.json().ticket.id as string;
    expect(res.json().ticket.reportedByPersonId).toBe(people.asha);
    expect((await detailOf(id)).report.submittedByPersonId).toBe(people.bina);
    // the audit trail has no read API yet, so this one reads its table
    const audit = await admin.query(
      "SELECT after FROM audit_log WHERE action = 'ticket.past' AND entity_id = $1",
      [id],
    );
    expect(audit.rows[0].after.actingPersonId).toBe(people.bina);
  });
});

describe('registering a phone for push', () => {
  const subscription = (n: number) => ({
    endpoint: `https://fcm.googleapis.com/fcm/send/acting-${n}`,
    keys: {
      p256dh:
        'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM',
      auth: 'tBHItJI5svbpez7KI4CCXg',
    },
  });
  const rows = async () =>
    (
      await admin.query('SELECT acting_person_id FROM push_subscription WHERE tenant_id = $1', [
        TENANT,
      ])
    ).rows;

  it('refuses to register it for someone else, on a shared and a personal login', async () => {
    await choose('shared', 'bina');
    for (const [n, as] of [
      [1, 'shared'],
      [2, 'bina'],
    ] as const) {
      const res = await call('POST', '/api/v1/push/subscribe', as, {
        subscription: subscription(n),
        actingPersonId: people.asha,
      });
      expect(res.statusCode, `${as}: ${res.body}`).toBe(403);
      expect(res.json().error.code).toBe('forbidden');
    }
    expect(await rows()).toEqual([]);
  });

  it('registers it for the chosen person', async () => {
    await choose('shared', 'bina');
    const res = await call('POST', '/api/v1/push/subscribe', 'shared', {
      subscription: subscription(3),
      actingPersonId: people.bina,
    });
    expect(res.statusCode, res.body).toBe(200);
    expect(await rows()).toEqual([{ acting_person_id: people.bina }]);
  });
});

beforeAll(async () => {
  db = await startTestDb();
  admin = db.admin;
  const passwordHash = await hash(PASSWORD, {
    algorithm: 2,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
  await admin.query("INSERT INTO tenant (id, slug, name) VALUES ($1, 'acting', 'Acting plant')", [
    TENANT,
  ]);
  await admin.query(
    `INSERT INTO shift (id, tenant_id, code, name, starts_at, ends_at, crosses_midnight, active)
     VALUES ($1, $2, '1', 'Day', '00:00', '00:00', true, true)`,
    [SHIFT, TENANT],
  );
  const logins: Array<[string, string, string | null, boolean]> = [
    ['asha', 'technician', 'asha', false],
    ['bina', 'technician', 'bina', false],
    ['root', 'admin', 'root', false],
    ['omkar', 'operator', 'omkar', false],
    ['shared', 'technician', null, true],
    ['floor', 'operator', null, true],
  ];
  for (const [, , person] of logins) {
    if (!person) continue;
    people[person] = randomUUID();
    await admin.query('INSERT INTO person (id, tenant_id, name, team) VALUES ($1, $2, $3, $4)', [
      people[person],
      TENANT,
      person,
      person === 'omkar' ? 'production' : 'maintenance',
    ]);
  }
  for (const [username, role, person, shared] of logins) {
    await admin.query(
      'INSERT INTO login (tenant_id, person_id, username, password_hash, role, shared) VALUES ($1, $2, $3, $4, $5, $6)',
      [TENANT, person ? people[person] : null, username, passwordHash, role, shared],
    );
  }
  await admin.query(
    "INSERT INTO ref_counter (tenant_id, prefix, next_value) VALUES ($1, 'BD', 1)",
    [TENANT],
  );
  await admin.query(
    "INSERT INTO list_item (tenant_id, list, code, label, is_vendor, pauses_sla) VALUES ($1, 'wait_reason', 'spare', 'Spare part', false, true)",
    [TENANT],
  );
  await admin.query(
    `INSERT INTO sla_policy (tenant_id, severity, ack_minutes, restore_minutes) VALUES
      ($1, 'S1', 60, 240), ($1, 'S2', 90, 360), ($1, 'S3', 120, 480), ($1, 'S4', 180, 720)`,
    [TENANT],
  );
  for (let i = 0; i < 200; i += 1) {
    const id = randomUUID();
    machines.push(id);
    await admin.query(
      "INSERT INTO machine (id, tenant_id, code, criticality) VALUES ($1, $2, $3, 'A')",
      [id, TENANT, `AP-${i}`],
    );
  }
  app = await buildApp({ pool: db.app, logger: false, rateLimitMax: 100000 });
  for (const [username] of logins) {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { host: HOST, 'content-type': 'application/json' },
      payload: { username, password: PASSWORD },
    });
    expect(res.statusCode, `login ${username}`).toBe(200);
    tokens[username] = res.json().token as string;
  }
}, 120_000);

afterAll(async () => {
  await app.close();
  await db.stop();
});
