import { hash } from '@node-rs/argon2';
import type { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { startTestDb, type TestDb } from './harness.js';

// Test the M2-2.1 severity matrix: severity is derived from machine criticality
// at report time and stored on the ticket row, then projected to clients.
const TENANT = '30000000-0000-0000-0000-000000000001';
const MACHINE_A = '30000000-0000-0000-0000-000000000002'; // criticality A
const MACHINE_C = '30000000-0000-0000-0000-000000000003'; // criticality C
const MACHINE_NONE = '30000000-0000-0000-0000-000000000004'; // no criticality
const ASHA = '30000000-0000-0000-0000-000000000007';
const LOGIN_ASHA = '30000000-0000-0000-0000-00000000000b';
const PASSWORD = 'correct-horse-battery';

type App = Awaited<ReturnType<typeof buildApp>>;
type Res = Awaited<ReturnType<App['inject']>>;

let db: TestDb;
let admin: Pool;
let app: App;
let ashaToken = '';
let keyCounter = 0;

function post(url: string, token: string, payload: unknown): Promise<Res> {
  keyCounter += 1;
  return app.inject({
    method: 'POST',
    url,
    headers: {
      host: 'severity.localhost',
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
      'idempotency-key': `sev-${keyCounter}`,
    },
    payload: payload as object,
  });
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
  await admin.query("INSERT INTO tenant (id, slug, name) VALUES ($1, 'severity', 'Severity')", [
    TENANT,
  ]);
  await admin.query(
    `INSERT INTO machine (id, tenant_id, code, criticality) VALUES
     ($1, $4, 'VC-A', 'A'),
     ($2, $4, 'VC-C', 'C'),
     ($3, $4, 'VC-N', NULL)`,
    [MACHINE_A, MACHINE_C, MACHINE_NONE, TENANT],
  );
  await admin.query(
    "INSERT INTO person (id, tenant_id, name, team, title) VALUES ($1, $2, 'Asha', 'maintenance', 'Technician')",
    [ASHA, TENANT],
  );
  await admin.query(
    "INSERT INTO login (id, tenant_id, person_id, username, password_hash, role, shared) VALUES ($1, $2, $3, 'asha', $4, 'technician', false)",
    [LOGIN_ASHA, TENANT, ASHA, passwordHash],
  );
  await admin.query(
    "INSERT INTO ref_counter (tenant_id, prefix, next_value) VALUES ($1, 'BD', 1)",
    [TENANT],
  );

  app = await buildApp({ pool: db.app, logger: false, rateLimitMax: 100000 });
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    headers: { host: 'severity.localhost', 'content-type': 'application/json' },
    payload: { username: 'asha', password: PASSWORD },
  });
  expect(res.statusCode).toBe(200);
  ashaToken = res.json().token as string;
}, 120_000);

afterAll(async () => {
  await app.close();
  await db.stop();
});

describe('M2-2.1 severity matrix', () => {
  it('derives S1 for a stopped ticket on an A-criticality machine', async () => {
    const raised = await post('/api/v1/tickets', ashaToken, {
      machineId: MACHINE_A,
      problem: 'Spindle alarm',
    });
    expect(raised.statusCode).toBe(201);
    const ticket = raised.json().ticket;
    expect(ticket.severity).toBe('S1');
    expect(ticket.criticalitySnapshot).toBe('A');
  });

  it('derives S2 for a support ticket on an A-criticality machine', async () => {
    await admin.query("UPDATE ticket SET status = 'closed' WHERE machine_id = $1", [MACHINE_A]);
    const raised = await post('/api/v1/tickets', ashaToken, {
      machineId: MACHINE_A,
      kind: 'support',
      problem: 'Need help with setup',
    });
    expect(raised.statusCode).toBe(201);
    expect(raised.json().ticket.severity).toBe('S2');
  });

  it('derives S3 for stopped and S4 for support on a C-criticality machine', async () => {
    const stopped = await post('/api/v1/tickets', ashaToken, {
      machineId: MACHINE_C,
      problem: 'Machine down',
    });
    expect(stopped.statusCode).toBe(201);
    expect(stopped.json().ticket.severity).toBe('S3');
    expect(stopped.json().ticket.criticalitySnapshot).toBe('C');
  });

  it('derives S4 for a general ticket regardless of criticality', async () => {
    const raised = await post('/api/v1/tickets', ashaToken, {
      kind: 'general',
      location: 'Cell A',
      workType: 'Clean',
      problem: 'Sweep the aisle',
    });
    expect(raised.statusCode).toBe(201);
    expect(raised.json().ticket.severity).toBe('S4');
    expect(raised.json().ticket.criticalitySnapshot).toBeNull();
  });

  it('derives S3 for an urgent general ticket', async () => {
    const raised = await post('/api/v1/tickets', ashaToken, {
      kind: 'general',
      location: 'Cell A',
      workType: 'Clean',
      urgent: true,
      problem: 'Urgent cleaning',
    });
    expect(raised.statusCode).toBe(201);
    expect(raised.json().ticket.severity).toBe('S3');
  });

  it('treats a machine with no criticality as C (S3 stopped)', async () => {
    const raised = await post('/api/v1/tickets', ashaToken, {
      machineId: MACHINE_NONE,
      problem: 'Unknown criticality',
    });
    expect(raised.statusCode).toBe(201);
    expect(raised.json().ticket.severity).toBe('S3');
    expect(raised.json().ticket.criticalitySnapshot).toBeNull();
  });

  it('persists severity on the ticket row and returns it on GET detail', async () => {
    // Close the earlier stopped ticket on MACHINE_C so the support raise does not conflict.
    await admin.query("UPDATE ticket SET status = 'closed' WHERE machine_id = $1", [MACHINE_C]);
    const raised = await post('/api/v1/tickets', ashaToken, {
      machineId: MACHINE_C,
      kind: 'support',
      problem: 'Check alignment',
    });
    expect(raised.statusCode).toBe(201);
    const id = raised.json().ticket.id as string;
    expect(raised.json().ticket.severity).toBe('S4');

    const row = await admin.query(
      'SELECT severity, criticality_snapshot FROM ticket WHERE id = $1',
      [id],
    );
    expect(row.rows[0].severity).toBe('S4');
    expect(row.rows[0].criticality_snapshot).toBe('C');

    const detail = await app.inject({
      method: 'GET',
      url: `/api/v1/tickets/${id}`,
      headers: { host: 'severity.localhost', authorization: `Bearer ${ashaToken}` },
    });
    expect(detail.statusCode).toBe(200);
    expect(detail.json().ticket.severity).toBe('S4');
    expect(detail.json().ticket.criticalitySnapshot).toBe('C');
  });

  it('recalculates severity when a correction changes the machine', async () => {
    // Fresh machines so the correction does not trip the duplicate-open rule.
    const MACHINE_FROM = '30000000-0000-0000-0000-000000000011';
    const MACHINE_TO = '30000000-0000-0000-0000-000000000012';
    await admin.query(
      "INSERT INTO machine (id, tenant_id, code, criticality) VALUES ($1, $3, 'VC-FROM', 'C'), ($2, $3, 'VC-TO', 'A')",
      [MACHINE_FROM, MACHINE_TO, TENANT],
    );
    const raised = await post('/api/v1/tickets', ashaToken, {
      machineId: MACHINE_FROM,
      problem: 'Wrong machine reported',
    });
    expect(raised.statusCode).toBe(201);
    const id = raised.json().ticket.id as string;
    expect(raised.json().ticket.severity).toBe('S3'); // C stopped

    // Admin performs the correction (technician role lacks canCorrect).
    await admin.query(
      "INSERT INTO login (id, tenant_id, person_id, username, password_hash, role, shared) VALUES ($1, $2, $3, 'sevadmin', (SELECT password_hash FROM login WHERE id = $4), 'admin', false)",
      ['30000000-0000-0000-0000-000000000013', TENANT, ASHA, LOGIN_ASHA],
    );
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { host: 'severity.localhost', 'content-type': 'application/json' },
      payload: { username: 'sevadmin', password: PASSWORD },
    });
    expect(login.statusCode).toBe(200);
    const adminToken = login.json().token as string;

    const corrected = await post(`/api/v1/tickets/${id}/correct`, adminToken, {
      reason: 'Reported against the wrong machine',
      changes: { machineId: MACHINE_TO },
    });
    expect(corrected.statusCode).toBe(200);
    expect(corrected.json().ticket.severity).toBe('S1'); // A stopped
    expect(corrected.json().ticket.criticalitySnapshot).toBe('A');
  });
});
