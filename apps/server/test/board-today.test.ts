import { hash } from '@node-rs/argon2';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { replyProblem } from '../src/kernel/index.js';
import { buildApp } from '../src/app.js';
import { startTestDb, type TestDb } from './harness.js';

type App = Awaited<ReturnType<typeof buildApp>>;
type Res = Awaited<ReturnType<App['inject']>>;

const PASSWORD = 'correct-horse-battery';
const uuid = (tenant: number, n: number) =>
  `${tenant}0000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const PLANT = uuid(1, 1);
const PLANT_B = uuid(2, 1);
const ASHA = uuid(1, 10);
const BINA = uuid(1, 11);
const BOB = uuid(2, 10);
const machine = (n: number) => uuid(1, 100 + n);
const machineB = (n: number) => uuid(2, 100 + n);
const ROLES = ['operator', 'supervisor', 'head', 'plant_head', 'admin', 'board'] as const;

/** Plant A is Asia/Kolkata (UTC+5:30); "now" is 12:00 local on 14 Nov 2026, so its day is 13 Nov 18:30Z to 14 Nov 18:30Z. */
const NOW = '2026-11-14T06:30:00.000Z';
const DAY = { from: '2026-11-13T18:30:00.000Z', to: '2026-11-14T18:30:00.000Z' };

let db: TestDb;
let app: App;
const tokens: Record<string, string> = {};
const ids: Record<string, string> = {};
let keys = 0;

/** `who` is a username: it picks the token, and the plant's host name. */
function call(method: 'GET' | 'POST', url: string, who: string, payload?: object) {
  keys += 1;
  return app.inject({
    method,
    url,
    headers: {
      host: who === 'bob' ? 'plant-two.localhost' : 'cosmos.localhost',
      authorization: `Bearer ${tokens[who]}`,
      'content-type': 'application/json',
      'idempotency-key': `key-${keys}`,
    },
    ...(payload ? { payload } : {}),
  });
}

async function login(username: string, host = 'cosmos.localhost'): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    headers: { host, 'content-type': 'application/json' },
    payload: { username, password: PASSWORD },
  });
  expect(res.statusCode).toBe(200);
  return res.json().token as string;
}

type Step = [at: string, act: () => Promise<Res>];

/** Plays the steps in time order, the clock set to each one's minute, so figures come from the real commands. */
async function play(steps: Step[]): Promise<void> {
  for (const [at, act] of [...steps].sort((a, b) => a[0].localeCompare(b[0]))) {
    vi.setSystemTime(new Date(at));
    const res = await act();
    expect(res.statusCode, `${at} ${res.body}`).toBeLessThan(300);
  }
}

const PERSON: Record<string, string> = { asha: ASHA, bina: BINA };
const raise =
  (key: string, machineId: string, who = 'asha'): (() => Promise<Res>) =>
  async () => {
    const res = await call('POST', '/api/v1/tickets', who, { machineId, problem: `Fault ${key}` });
    ids[key] = res.json().ticket?.id as string;
    return res;
  };
const act =
  (key: string, command: string, who: string, body: object = {}): (() => Promise<Res>) =>
  () =>
    call('POST', `/api/v1/tickets/${ids[key]}/${command}`, who, { personId: PERSON[who], ...body });
const close = (key: string, who: string) =>
  act(key, 'close', who, { kind: 'no_report', note: 'Done' });
const board = (who: string) => call('GET', '/api/v1/board/today', who);

beforeAll(async () => {
  db = await startTestDb();
  const passwordHash = await hash(PASSWORD, {
    algorithm: 2,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
  const { admin } = db;
  await admin.query(
    "INSERT INTO tenant (id, slug, name, time_zone) VALUES ($1, 'cosmos', 'Cosmos', 'Asia/Kolkata'), ($2, 'plant-two', 'Plant Two', 'America/New_York')",
    [PLANT, PLANT_B],
  );
  await admin.query(
    "INSERT INTO segment (id, tenant_id, code, name, sort) VALUES ($1, $2, 'CNC', 'CNC', 0), ($3, $4, 'CNC', 'CNC', 0)",
    [uuid(1, 2), PLANT, uuid(2, 2), PLANT_B],
  );
  for (let n = 1; n <= 7; n += 1) {
    await admin.query(
      "INSERT INTO machine (id, tenant_id, code, segment_id, category, cell) VALUES ($1, $2, $3, $4, 'VMC', 'Cell-1')",
      [machine(n), PLANT, `VC-${n}`, uuid(1, 2)],
    );
  }
  for (let n = 1; n <= 2; n += 1) {
    await admin.query(
      "INSERT INTO machine (id, tenant_id, code, segment_id, category, cell) VALUES ($1, $2, $3, $4, 'VMC', 'Cell-1')",
      [machineB(n), PLANT_B, `VC-${n}`, uuid(2, 2)],
    );
  }
  const people: Array<[string, number, string, string, string]> = [
    [ASHA, 1, 'Asha', 'asha', 'technician'],
    [BINA, 1, 'Bina', 'bina', 'technician'],
    [BOB, 2, 'Bob', 'bob', 'technician'],
    ...ROLES.map((role, i): [string, number, string, string, string] => [
      uuid(1, 20 + i),
      1,
      `Person ${role}`,
      role,
      role,
    ]),
  ];
  for (const [id, tenant, name, username, role] of people) {
    const tenantId = tenant === 1 ? PLANT : PLANT_B;
    await admin.query(
      "INSERT INTO person (id, tenant_id, name, team) VALUES ($1, $2, $3, 'maintenance')",
      [id, tenantId, name],
    );
    await admin.query(
      'INSERT INTO login (tenant_id, person_id, username, password_hash, role, shared) VALUES ($1, $2, $3, $4, $5, false)',
      [tenantId, id, username, passwordHash, role],
    );
  }
  for (const tenantId of [PLANT, PLANT_B]) {
    await admin.query(
      "INSERT INTO ref_counter (tenant_id, prefix, next_value) VALUES ($1, 'BD', 1)",
      [tenantId],
    );
    await admin.query(
      "INSERT INTO list_item (tenant_id, list, code, label, pauses_sla, is_vendor) VALUES ($1, 'wait_reason', 'spare', 'Spare part', false, false), ($1, 'wait_reason', 'vendor', 'At vendor', true, true)",
      [tenantId],
    );
  }
  await admin.query(
    "INSERT INTO setting (tenant_id, key, value) VALUES ($1, 'features', '{\"floorLive\": false}')",
    [PLANT],
  );

  app = await buildApp({ pool: db.app, logger: false, rateLimitMax: 100000 });
  for (const [, , , username] of people) {
    tokens[username] = await login(
      username,
      username === 'bob' ? 'plant-two.localhost' : 'cosmos.localhost',
    );
  }
  vi.useFakeTimers({ toFake: ['Date'] });
  const { raise: r, act: a } = { raise, act };
  await play([
    // Yesterday, still open: not in today's set.
    ['2026-11-13T04:30:00Z', r('G', machine(7))],
    ['2026-11-13T04:40:00Z', a('G', 'start', 'asha')],
    // A: reported 23:50 local yesterday, closed 00:10 local today.
    ['2026-11-13T18:20:00Z', r('A', machine(1))],
    ['2026-11-13T18:25:00Z', a('A', 'start', 'asha')],
    ['2026-11-13T18:40:00Z', close('A', 'asha')],
    // B: reported 00:05 local today, waited twice (20 and 15 minutes), closed 02:15 local.
    ['2026-11-13T18:35:00Z', r('B', machine(2))],
    ['2026-11-13T18:45:00Z', a('B', 'start', 'asha')],
    ['2026-11-13T19:00:00Z', a('B', 'pause', 'asha', { reasonCode: 'spare' })],
    ['2026-11-13T19:20:00Z', a('B', 'resume', 'asha')],
    ['2026-11-13T19:40:00Z', a('B', 'pause', 'asha', { reasonCode: 'spare' })],
    ['2026-11-13T19:55:00Z', a('B', 'resume', 'asha')],
    ['2026-11-13T20:45:00Z', close('B', 'asha')],
    // C: started, then paused at a vendor and still there at "now".
    ['2026-11-14T02:30:00Z', r('C', machine(3))],
    ['2026-11-14T02:50:00Z', a('C', 'start', 'asha')],
    ['2026-11-14T03:30:00Z', a('C', 'pause', 'asha', { reasonCode: 'vendor' })],
    // D: nobody has started it.
    ['2026-11-14T05:30:00Z', r('D', machine(4))],
    // E: started, handed over, picked up by someone else, closed.
    ['2026-11-14T03:30:00Z', r('E', machine(5))],
    ['2026-11-14T03:40:00Z', a('E', 'start', 'asha')],
    ['2026-11-14T04:00:00Z', a('E', 'transfer', 'asha', { note: 'Shift change' })],
    ['2026-11-14T04:30:00Z', a('E', 'start', 'bina')],
    ['2026-11-14T05:30:00Z', close('E', 'bina')],
    // F: cancelled today.
    ['2026-11-14T01:30:00Z', r('F', machine(6))],
    ['2026-11-14T01:40:00Z', a('F', 'cancel', 'asha', { reason: 'Raised twice' })],
    // Plant two (New York): 23:00 yesterday and 01:00 today, local.
    ['2026-11-14T04:00:00Z', r('B1', machineB(1), 'bob')],
    ['2026-11-14T06:00:00Z', r('B2', machineB(2), 'bob')],
  ]);
  vi.setSystemTime(new Date(NOW));
}, 180_000);

afterAll(async () => {
  vi.useRealTimers();
  await app.close();
  await db.stop();
});

describe('GET /api/v1/board/today', () => {
  it('scores the plant day: response, repair with its waits inside, and waiting beside it', async () => {
    const res = await board('asha');
    expect(res.statusCode).toBe(200);
    expect(replyProblem('GET /api/v1/board/today', 200, res.json())).toBeNull();
    // A 5/15/0, B 10/120/35, C 20/220/180 (to now), E 10/110/0; D has no work start; F cancelled; G is yesterday's.
    expect(res.json()).toEqual({
      now: NOW,
      ...DAY,
      tickets: 5,
      notStarted: 1,
      stillOpen: 2,
      responseMin: 11,
      repairMin: 116,
      waitingMin: 54,
    });
  });

  it("moves the day at the plant's own midnight, not at UTC's", async () => {
    // 23:51 local on 13 Nov: that day holds G (reported 10:00) and A (reported 23:50), not B (reported 00:05 next day).
    vi.setSystemTime(new Date('2026-11-13T18:21:00Z'));
    const yesterday = (await board('asha')).json();
    expect(yesterday).toMatchObject({
      from: '2026-11-12T18:30:00.000Z',
      to: DAY.from,
      tickets: 2,
      stillOpen: 1,
      responseMin: 8,
      repairMin: 418,
      waitingMin: 0,
    });
    vi.setSystemTime(new Date(NOW));
  });

  it('is null, not 0, on a day with no tickets', async () => {
    vi.setSystemTime(new Date('2026-12-01T06:30:00Z'));
    expect((await board('asha')).json()).toMatchObject({
      tickets: 0,
      notStarted: 0,
      stillOpen: 0,
      responseMin: null,
      repairMin: null,
      waitingMin: null,
    });
    vi.setSystemTime(new Date(NOW));
  });

  it("uses each plant's own day and never shows another plant's tickets", async () => {
    const bob = (await board('bob')).json();
    // New York is UTC-5: its 04:00Z ticket was reported 23:00 yesterday and still open, so only the 06:00Z one is today's.
    expect(bob).toMatchObject({
      from: '2026-11-14T05:00:00.000Z',
      tickets: 1,
      notStarted: 1,
      responseMin: null,
    });
    expect((await board('asha')).json().tickets).toBe(5);
  });

  it('answers every role the live board is open to, and an operator only when the plant shows it to the floor', async () => {
    for (const role of ROLES.filter((name) => name !== 'operator')) {
      expect((await board(role)).statusCode, role).toBe(200);
    }
    expect((await board('operator')).statusCode).toBe(403);
    await db.admin.query(
      "UPDATE setting SET value = '{\"floorLive\": true}' WHERE tenant_id = $1 AND key = 'features'",
      [PLANT],
    );
    expect((await board('operator')).statusCode).toBe(200);
    await db.admin.query(
      "UPDATE setting SET value = '{\"floorLive\": false}' WHERE tenant_id = $1 AND key = 'features'",
      [PLANT],
    );
  });

  it('needs a signed-in login', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/board/today',
      headers: { host: 'cosmos.localhost' },
    });
    expect(res.statusCode).toBe(401);
  });

  it("shows a ticket's own waiting minutes beside its repair on the ticket reply", async () => {
    const res = await call('GET', `/api/v1/tickets/${ids.B}`, 'asha');
    expect(res.json().ticket.figures).toMatchObject({
      responseMin: 10,
      repairMin: 120,
      waitMin: 35,
    });
  });
});
