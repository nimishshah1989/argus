import { hash } from '@node-rs/argon2';
import type { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { startTestDb, type TestDb } from './harness.js';

// Ticket 15: what the floor gets when a machine already has an open ticket.
const TENANT = '10000000-0000-0000-0000-000000000001';
const SEGMENT = '10000000-0000-0000-0000-000000000002';
const ASHA = '10000000-0000-0000-0000-000000000009';
const ADMIN_PERSON = '10000000-0000-0000-0000-00000000000c';
const OPERATOR = '10000000-0000-0000-0000-00000000000b';
const PASSWORD = 'correct-horse-battery';
const machineId = (n: number): string =>
  `10000000-0000-0000-0000-0000000001${String(n).padStart(2, '0')}`;
const ROUNDS = 6;

type App = Awaited<ReturnType<typeof buildApp>>;
let db: TestDb;
let admin: Pool;
let app: App;
let ashaToken = '';
let opToken = '';
let adminToken = '';
let keyCounter = 0;

function post(url: string, token: string, payload: unknown) {
  keyCounter += 1;
  return app.inject({
    method: 'POST',
    url,
    headers: {
      host: 'cosmos.localhost',
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
      'idempotency-key': `open-${keyCounter}`,
    },
    payload: payload as object,
  });
}

async function login(username: string): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    headers: { host: 'cosmos.localhost', 'content-type': 'application/json' },
    payload: { username, password: PASSWORD },
  });
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
  await admin.query("INSERT INTO tenant (id, slug, name) VALUES ($1, 'cosmos', 'Cosmos')", [
    TENANT,
  ]);
  await admin.query(
    "INSERT INTO segment (id, tenant_id, code, name, sort) VALUES ($1, $2, 'CNC', 'CNC', 0)",
    [SEGMENT, TENANT],
  );
  for (let n = 1; n <= ROUNDS + 4; n += 1) {
    await admin.query(
      "INSERT INTO machine (id, tenant_id, code, segment_id, category, cell) VALUES ($1, $2, $3, $4, 'VMC', 'Cell-1')",
      [machineId(n), TENANT, `VC-${n}`, SEGMENT],
    );
  }
  await admin.query(
    `INSERT INTO person (id, tenant_id, name, team, title) VALUES
     ($1, $3, 'Asha', 'maintenance', 'Technician'), ($2, $3, 'Opera', 'production', 'Operator'),
     ($4, $3, 'Admin', 'maintenance', 'Head')`,
    [ASHA, OPERATOR, TENANT, ADMIN_PERSON],
  );
  await admin.query(
    `INSERT INTO login (id, tenant_id, person_id, username, password_hash, role, shared) VALUES
     ('10000000-0000-0000-0000-00000000000d', $3, $1, 'asha', $4, 'technician', false),
     ('10000000-0000-0000-0000-00000000000f', $3, $2, 'op', $4, 'operator', false),
     ('10000000-0000-0000-0000-000000000011', $3, $5, 'admin', $4, 'admin', false)`,
    [ASHA, OPERATOR, TENANT, passwordHash, ADMIN_PERSON],
  );
  app = await buildApp({ pool: db.app, logger: false, rateLimitMax: 100000 });
  ashaToken = await login('asha');
  opToken = await login('op');
  adminToken = await login('admin');
}, 120_000);

afterAll(async () => {
  await app.close();
  await db.stop();
});

describe('a machine that already has an open ticket', () => {
  it('answers "already open" to a simultaneous second report, never a 500', async () => {
    for (let n = 1; n <= ROUNDS; n += 1) {
      const payload = { machineId: machineId(n), problem: 'Spindle alarm' };
      const [a, b] = await Promise.all([
        post('/api/v1/tickets', ashaToken, payload),
        post('/api/v1/tickets', opToken, payload),
      ]);
      expect([a.statusCode, b.statusCode].sort()).toEqual([201, 409]);
      const loser = a.statusCode === 409 ? a : b;
      expect(loser.json().error.code).toBe('conflict');
    }
  });
  it('answers "already open" when the other report commits at the same instant', async () => {
    // A report that is not committed yet is invisible to the duplicate check, so the second one
    // only meets it at the database's own guard: the one-open-breakdown-per-machine rule.
    const other = await admin.connect();
    await other.query('BEGIN');
    await other.query(
      "INSERT INTO ticket (tenant_id, ref, kind, status, problem, reported_at, severity, machine_id) VALUES ($1, 'BD-8001', 'stopped', 'open', 'Other phone', now(), 'S3', $2)",
      [TENANT, machineId(ROUNDS + 1)],
    );
    const pending = post('/api/v1/tickets', ashaToken, {
      machineId: machineId(ROUNDS + 1),
      problem: 'Same machine, same moment',
    });
    await new Promise((resolve) => setTimeout(resolve, 300));
    await other.query('COMMIT');
    other.release();
    const reply = await pending;
    expect(reply.statusCode).toBe(409);
    expect(reply.json().error.code).toBe('conflict');
  });

  it('answers "already open" when a restore would put a second open ticket on a machine', async () => {
    const machine = machineId(ROUNDS + 2);
    const first = await post('/api/v1/tickets', ashaToken, { machineId: machine, problem: 'Belt' });
    const firstId = first.json().ticket.id as string;
    const cancel = await post(`/api/v1/tickets/${firstId}/cancel`, ashaToken, {
      personId: ASHA,
      reason: 'Raised by mistake',
    });
    expect(cancel.statusCode).toBe(200);
    const second = await post('/api/v1/tickets', ashaToken, {
      machineId: machine,
      problem: 'Belt',
    });
    expect(second.statusCode).toBe(201);

    const restore = await post(`/api/v1/tickets/${firstId}/restore`, adminToken, {
      personId: ADMIN_PERSON,
      reason: 'Wrong cancel',
    });
    expect(restore.statusCode).toBe(409);
    expect(restore.json().error.code).toBe('conflict');
  });
});
