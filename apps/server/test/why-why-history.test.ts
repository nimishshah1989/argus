import { randomUUID } from 'node:crypto';
import { hash } from '@node-rs/argon2';
import type { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { startTestDb, type TestDb } from './harness.js';

// A saved Why-Why is a `why_why` line in the ticket's history (D31). Ticket 41 writes it; until then nothing reads it,
// so the first thing to prove is that a ticket carrying one still loads, lists and works.
const TENANT = '82000000-0000-0000-0000-000000000001';
const HOST = 'why.localhost';
const PASSWORD = 'correct-horse-battery';

type App = Awaited<ReturnType<typeof buildApp>>;
let db: TestDb;
let admin: Pool;
let app: App;
let token = '';
let ticketId = '';

const call = (method: 'GET' | 'POST', url: string, payload?: object) =>
  app.inject({
    method,
    url,
    headers: {
      host: HOST,
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      'idempotency-key': randomUUID(),
    },
    ...(payload ? { payload } : {}),
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
  await admin.query("INSERT INTO tenant (id, slug, name) VALUES ($1, 'why', 'Why plant')", [
    TENANT,
  ]);
  const person = (
    await admin.query(
      "INSERT INTO person (tenant_id, name, team) VALUES ($1, 'Asha', 'maintenance') RETURNING id",
      [TENANT],
    )
  ).rows[0].id;
  await admin.query(
    "INSERT INTO login (tenant_id, person_id, username, password_hash, role, shared) VALUES ($1, $2, 'asha', $3, 'admin', false)",
    [TENANT, person, passwordHash],
  );
  await admin.query(
    "INSERT INTO ref_counter (tenant_id, prefix, next_value) VALUES ($1, 'BD', 1)",
    [TENANT],
  );
  const machine = (
    await admin.query(
      "INSERT INTO machine (tenant_id, code, criticality) VALUES ($1, 'VC-1', 'A') RETURNING id",
      [TENANT],
    )
  ).rows[0].id;
  await admin.query(
    `INSERT INTO sla_policy (tenant_id, severity, ack_minutes, restore_minutes) VALUES
      ($1, 'S1', 60, 240), ($1, 'S2', 90, 360), ($1, 'S3', 120, 480), ($1, 'S4', 180, 720)`,
    [TENANT],
  );
  app = await buildApp({ pool: db.app, logger: false, rateLimitMax: 100000 });
  const login = await call('POST', '/api/v1/auth/login', { username: 'asha', password: PASSWORD });
  expect(login.statusCode, login.body).toBe(200);
  token = login.json().token as string;
  const raised = await call('POST', '/api/v1/tickets', { machineId: machine, problem: 'Spindle' });
  expect(raised.statusCode, raised.body).toBe(201);
  ticketId = raised.json().ticket.id as string;
}, 120_000);

afterAll(async () => {
  await app?.close();
  await db?.stop();
});

describe('a ticket whose history holds a saved Why-Why', () => {
  it('still opens, shows the line in its history and answers the live board', async () => {
    const before = await call('GET', `/api/v1/tickets/${ticketId}`);
    expect(before.statusCode, before.body).toBe(200);
    await admin.query(
      `INSERT INTO ticket_event (tenant_id, ticket_id, seq, type, payload)
       SELECT tenant_id, id, last_event_seq + 1, 'why_why', $2 FROM ticket WHERE id = $1`,
      [ticketId, JSON.stringify({ whys: ['a', 'b', 'c', 'd', 'e'], conclusion: 'worn bearing' })],
    );
    await admin.query('UPDATE ticket SET last_event_seq = last_event_seq + 1 WHERE id = $1', [
      ticketId,
    ]);

    const detail = await call('GET', `/api/v1/tickets/${ticketId}`);
    expect(detail.statusCode, detail.body).toBe(200);
    expect(detail.json().ticket.status).toBe(before.json().ticket.status);
    expect((await call('GET', '/api/v1/state')).statusCode).toBe(200);
    expect(detail.json().events.map((e: { type: string }) => e.type)).toContain('why_why');
  });
});
