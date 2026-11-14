import { randomUUID } from 'node:crypto';
import { hash } from '@node-rs/argon2';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { startTestDb, type TestDb } from './harness.js';

/**
 * Who may work a ticket (DOMAIN §3) and what a second person racing the same action gets (DOMAIN §2: 409), for
 * start, update, pause, resume, join, leave, transfer, running and stopped, through the real routes.
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
const MAY_WORK: Role[] = ['technician', 'supervisor', 'head', 'admin'];

let db: TestDb;
let app: Awaited<ReturnType<typeof buildApp>>;
const token = new Map<string, string>();
const person = new Map<string, string>();
const machines: string[] = [];
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
        ? { 'content-type': 'application/json', 'idempotency-key': `work-${keys}` }
        : {}),
    },
    ...(payload ? { payload } : {}),
  });
};
const act = (id: string, action: string, who: string, extra: object = {}): Promise<Res> =>
  call('POST', `/api/v1/tickets/${id}/${action}`, who, { personId: person.get(who), ...extra });

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
  for (let i = 0; i < 80; i += 1) {
    const id = randomUUID();
    machines.push(id);
    await db.admin.query(
      "INSERT INTO machine (id, tenant_id, code, segment_id, category, cell) VALUES ($1, $2, $3, $4, 'VMC', 'C')",
      [id, TENANT, `M-${i}`, segment],
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
  const users = [...ROLES.map((r) => `${r}`), 'asha', 'bina'];
  for (const name of users) {
    const id = randomUUID();
    person.set(name, id);
    await db.admin.query(
      "INSERT INTO person (id, tenant_id, name, team, title) VALUES ($1, $2, $3, 'maintenance', 'Technician')",
      [id, TENANT, name],
    );
    await db.admin.query(
      'INSERT INTO login (tenant_id, person_id, username, password_hash, role, shared) VALUES ($1, $2, $3, $4, $5, false)',
      [TENANT, id, name, passwordHash, ROLES.includes(name as Role) ? name : 'technician'],
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
  await app.close();
  await db.stop();
});

type Setup = 'open' | 'working' | 'waiting' | 'crewed' | 'running' | 'stoppedAgain';
let nextMachine = 0;
/** A ticket in the state an action needs, raised and led by asha; `crewed` has bina on it as a primary. */
async function ticketIn(setup: Setup): Promise<string> {
  const raised = await call('POST', '/api/v1/tickets', 'asha', {
    machineId: machines[nextMachine++],
    problem: 'Spindle alarm',
  });
  expect(raised.statusCode).toBe(201);
  const id = raised.json().ticket.id as string;
  if (setup === 'open') return id;
  expect((await act(id, 'start', 'asha')).statusCode).toBe(200);
  if (setup === 'crewed') await act(id, 'join', 'bina', { role: 'primary' });
  if (setup === 'running' || setup === 'stoppedAgain') await act(id, 'machine-running', 'asha');
  if (setup === 'stoppedAgain') await act(id, 'machine-stopped', 'asha');
  if (setup === 'waiting') await act(id, 'pause', 'asha', { reasonCode: 'spare' });
  return id;
}

const ACTIONS: Array<[action: string, setup: Setup, body: object, spareBody?: object]> = [
  ['start', 'open', {}],
  ['update', 'working', { text: 'Replaced the belt' }],
  ['pause', 'working', { reasonCode: 'spare' }],
  ['resume', 'waiting', {}],
  ['join', 'working', { role: 'support' }],
  ['leave', 'crewed', { reason: 'Shift over' }],
  ['transfer', 'working', { note: 'Next shift takes over' }],
  ['machine-running', 'working', {}],
  ['machine-stopped', 'running', {}],
];

describe('who may work a ticket', () => {
  it.each(ACTIONS)(
    '%s: technician and above yes; operator, plant head and board no',
    async (action, setup, body) => {
      for (const role of ROLES) {
        const id = await ticketIn(setup);
        // leave: the person leaving must be on the crew, so a role that may work joins first
        if (action === 'leave' && MAY_WORK.includes(role))
          await act(id, 'join', role, { role: 'support' });
        const res = await act(id, action, role, body);
        const want = MAY_WORK.includes(role) ? 200 : 403;
        expect(`${role} ${action} ${res.statusCode}`).toBe(`${role} ${action} ${want}`);
      }
    },
  );

  it('a personal login may only act as its own person', async () => {
    const id = await ticketIn('working');
    const res = await call('POST', `/api/v1/tickets/${id}/update`, 'asha', {
      personId: person.get('bina'),
      text: 'x',
    });
    expect(res.statusCode).toBe(403);
  });
});

/** Two people try the same action on the same ticket at once: one wins, the other is told it is already done. */
describe('a second person racing the same action', () => {
  const sorted = (a: Res, b: Res): number[] => [a.statusCode, b.statusCode].sort();

  it.each([
    ['start', 'open', {}],
    ['pause', 'working', { reasonCode: 'spare' }],
    ['resume', 'waiting', {}],
    ['transfer', 'working', { note: 'handover' }],
    ['machine-running', 'working', {}],
    ['machine-stopped', 'running', {}],
  ] as Array<[string, Setup, object]>)('%s gives 200 and 409', async (action, setup, body) => {
    const id = await ticketIn(setup);
    const [a, b] = await Promise.all([
      act(id, action, 'asha', body),
      act(id, action, 'bina', body),
    ]);
    expect(sorted(a, b)).toEqual([200, 409]);
    const loser = a.statusCode === 409 ? a : b;
    expect(loser.json().error.code).toBe('conflict');
  });

  it('joining twice and leaving twice give 409', async () => {
    const id = await ticketIn('working');
    const [j1, j2] = await Promise.all([
      act(id, 'join', 'bina', { role: 'support' }),
      act(id, 'join', 'bina', { role: 'support' }),
    ]);
    expect(sorted(j1, j2)).toEqual([200, 409]);
    const [l1, l2] = await Promise.all([
      act(id, 'leave', 'bina', { reason: 'done' }),
      act(id, 'leave', 'bina', { reason: 'done' }),
    ]);
    expect(sorted(l1, l2)).toEqual([200, 409]);
  });

  it('an update after the ticket was cancelled is 409, and a stopped machine marked running twice too', async () => {
    const id = await ticketIn('working');
    expect((await act(id, 'cancel', 'asha', { reason: 'mistake' })).statusCode).toBe(200);
    expect((await act(id, 'update', 'bina', { text: 'late' })).statusCode).toBe(409);
    const again = await ticketIn('running');
    expect((await act(again, 'machine-running', 'bina')).statusCode).toBe(409);
  });
});

describe('what the person running the job may and may not do', () => {
  it('the lead leaves only when a primary takes over; the primary then leads', async () => {
    const lone = await ticketIn('working');
    expect((await act(lone, 'leave', 'asha', { reason: 'ill' })).statusCode).toBe(409);
    const id = await ticketIn('crewed');
    const left = await act(id, 'leave', 'asha', { reason: 'shift over' });
    expect(left.statusCode).toBe(200);
    expect(left.json().ticket.leadPersonId).toBe(person.get('bina'));
  });

  it('refuses a join by the person running the job', async () => {
    const id = await ticketIn('working');
    expect((await act(id, 'join', 'asha', { role: 'support' })).statusCode).toBe(409);
  });

  it('a pick-up can be back-dated to the transfer past an update written in between', async () => {
    const id = await ticketIn('working');
    expect((await act(id, 'transfer', 'asha', { note: 'handover' })).statusCode).toBe(200);
    const detail = await call('GET', `/api/v1/tickets/${id}`, 'asha');
    const transferAt = new Date(detail.json().ticket.handoverSince as string);
    expect((await act(id, 'update', 'bina', { text: 'note while open' })).statusCode).toBe(200);
    const back = new Date(transferAt.getTime() + 1).toISOString();
    const pickup = await act(id, 'start', 'bina', { at: back });
    expect(pickup.statusCode).toBe(200);
    const after = await call('GET', `/api/v1/tickets/${id}`, 'asha');
    expect(after.json().ticket.leadPersonId).toBe(person.get('bina'));
    expect(after.json().intervals.at(-1).startedAt).toBe(back);
  });

  it('a machine that ran again can be stopped again and run again', async () => {
    const id = await ticketIn('stoppedAgain');
    expect((await act(id, 'machine-running', 'asha')).statusCode).toBe(200);
  });

  it('a raise that starts the work at once works (two events, one request)', async () => {
    const raised = await call('POST', '/api/v1/tickets', 'asha', {
      machineId: machines[nextMachine++],
      problem: 'Found while walking past',
      startNow: true,
      startByPersonId: person.get('asha'),
    });
    expect(raised.statusCode).toBe(201);
    expect(raised.json().ticket.status).toBe('working');
  });
});
