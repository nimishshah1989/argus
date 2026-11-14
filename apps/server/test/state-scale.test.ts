import { hash } from '@node-rs/argon2';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { startTestDb, type TestDb } from './harness.js';

const TENANT = '10000000-0000-0000-0000-000000000001';
const SEGMENT = '10000000-0000-0000-0000-000000000002';
const HEAD = '10000000-0000-0000-0000-000000000006';
const PASSWORD = 'correct-horse-battery';
const HOST = 'scale.localhost';
const MACHINES = 500;
const BREAKDOWNS_OPEN = 90;
const BREAKDOWNS_WORKING = 45;
const BREAKDOWNS_WAITING = 15;
const CLOSED_NO_REPORT = 30;
const CALLS = 40;
const P95_BUDGET_MS = 300;

type App = Awaited<ReturnType<typeof buildApp>>;

let db: TestDb;
let app: App;
let token = '';
let key = 0;

const machineId = (n: number) => `30000000-0000-0000-0000-${String(n).padStart(12, '0')}`;

function send(method: 'GET' | 'POST', url: string, payload?: object) {
  return app.inject({
    method,
    url,
    headers: {
      host: HOST,
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
      'idempotency-key': `scale-${++key}`,
    },
    ...(payload ? { payload } : {}),
  });
}

async function raise(n: number): Promise<string> {
  const res = await send('POST', '/api/v1/tickets', {
    machineId: machineId(n),
    problem: 'Stopped',
  });
  expect(res.statusCode).toBe(201);
  return res.json().ticket.id as string;
}

async function start(id: string): Promise<void> {
  expect((await send('POST', `/api/v1/tickets/${id}/start`, { personId: HEAD })).statusCode).toBe(
    200,
  );
}

async function pause(id: string): Promise<void> {
  const res = await send('POST', `/api/v1/tickets/${id}/pause`, {
    personId: HEAD,
    reasonCode: 'spare',
  });
  expect(res.statusCode, res.body).toBe(200);
}

beforeAll(async () => {
  db = await startTestDb();
  const passwordHash = await hash(PASSWORD, {
    algorithm: 2,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
  const sql = (text: string, params: unknown[] = []) => db.admin.query(text, [TENANT, ...params]);
  await sql("INSERT INTO tenant (id, slug, name) VALUES ($1, 'scale', 'Scale Plant')");
  await sql(
    "INSERT INTO segment (id, tenant_id, code, name, sort) VALUES ($2, $1, 'CNC', 'CNC', 0)",
    [SEGMENT],
  );
  await sql(
    `INSERT INTO machine (id, tenant_id, code, segment_id, category, cell)
     SELECT ('30000000-0000-0000-0000-' || lpad(g::text, 12, '0'))::uuid, $1, 'M-' || lpad(g::text, 3, '0'), $2,
       'VMC', 'Cell-' || (g % 25) FROM generate_series(1, ${MACHINES}) g`,
    [SEGMENT],
  );
  await sql(
    "INSERT INTO list_item (tenant_id, list, code, label, pauses_sla) VALUES ($1, 'wait_reason', 'spare', 'Waiting for spare', false)",
  );
  await sql(
    `INSERT INTO machine_group (id, tenant_id, segment_id, code, name, sort)
     SELECT ('40000000-0000-0000-0000-' || lpad(g::text, 12, '0'))::uuid, $1, $2, 'G' || g, 'Group ' || g, g
     FROM generate_series(0, 24) g`,
    [SEGMENT],
  );
  await sql(
    `UPDATE machine SET group_id = ('40000000-0000-0000-0000-' || lpad((substring(cell from 6)::int)::text, 12, '0'))::uuid
     WHERE tenant_id = $1`,
  );
  await sql(
    "INSERT INTO person (id, tenant_id, name, team) VALUES ($2, $1, 'Head', 'maintenance')",
    [HEAD],
  );
  await sql(
    "INSERT INTO login (tenant_id, person_id, username, password_hash, role, shared) VALUES ($1, $2, 'head', $3, 'head', false)",
    [HEAD, passwordHash],
  );
  app = await buildApp({ pool: db.app, logger: false, rateLimitMax: 100000 });
  const login = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    headers: { host: HOST, 'content-type': 'application/json' },
    payload: { username: 'head', password: PASSWORD },
  });
  token = login.json().token as string;

  // A busy afternoon: ~18% of the machines have an open breakdown, half of them being worked, and a day's
  // worth of closed tickets still need their report.
  for (let n = 1; n <= BREAKDOWNS_OPEN; n++) {
    const id = await raise(n);
    if (n <= BREAKDOWNS_WORKING) await start(id);
    if (n <= BREAKDOWNS_WAITING) await pause(id);
  }
  for (let n = 101; n <= 100 + CLOSED_NO_REPORT; n++) {
    const id = await raise(n);
    await start(id);
    await send('POST', `/api/v1/tickets/${id}/close`, { personId: HEAD, kind: 'no_report' });
  }
}, 300_000);

afterAll(async () => {
  await app.close();
  await db.stop();
});

// An early-warning check, not a load test: /state's cost grows with the open and need-report tickets more than with
// the machine count, so the fixture carries 25 groups, tickets being worked and tickets waiting on a reason.
describe('GET /state on a 500-machine plant', () => {
  it(`answers with p95 under ${P95_BUDGET_MS} ms while carrying every open and need-report ticket`, async () => {
    for (let i = 0; i < 5; i++) await send('GET', '/api/v1/state');
    const times: number[] = [];
    let last: Awaited<ReturnType<typeof send>> | undefined;
    for (let i = 0; i < CALLS; i++) {
      const started = performance.now();
      last = await send('GET', '/api/v1/state');
      times.push(performance.now() - started);
    }
    const body = last!.json();
    expect(last!.statusCode).toBe(200);
    expect(body.open).toHaveLength(BREAKDOWNS_OPEN);
    expect(body.needReport).toHaveLength(CLOSED_NO_REPORT);

    const sorted = [...times].sort((a, b) => a - b);
    const p95 = sorted[Math.ceil(0.95 * sorted.length) - 1]!;
    console.info(
      `state p95 ${p95.toFixed(1)} ms, median ${sorted[Math.floor(sorted.length / 2)]!.toFixed(1)} ms over ${CALLS} calls`,
    );
    expect(p95).toBeLessThan(P95_BUDGET_MS);
  });
});
