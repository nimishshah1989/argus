import { hash } from '@node-rs/argon2';
import type { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { startTestDb, type TestDb } from './harness.js';

// Test the M2-2.1 severity matrix: severity is derived from machine criticality
// at report time and stored on the ticket row, then projected to clients.
const TENANT = '30000000-0000-0000-0000-000000000001';
const TENANT_2 = '30000000-0000-0000-0000-000000000101';
const MACHINE_2 = '30000000-0000-0000-0000-000000000102';
const PERSON_2 = '30000000-0000-0000-0000-000000000103';
const LOGIN_2 = '30000000-0000-0000-0000-000000000104';
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

function post(
  url: string,
  token: string,
  payload: unknown,
  host = 'severity.localhost',
): Promise<Res> {
  keyCounter += 1;
  return app.inject({
    method: 'POST',
    url,
    headers: {
      host,
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
    "INSERT INTO login (id, tenant_id, person_id, username, password_hash, role, shared) VALUES ($1, $2, $3, 'sevadmin', $4, 'admin', false)",
    ['30000000-0000-0000-0000-000000000013', TENANT, ASHA, passwordHash],
  );
  await admin.query(
    "INSERT INTO ref_counter (tenant_id, prefix, next_value) VALUES ($1, 'BD', 1)",
    [TENANT],
  );
  await admin.query(
    "INSERT INTO tenant (id, slug, name) VALUES ($1, 'severity-two', 'Severity Two')",
    [TENANT_2],
  );
  await admin.query(
    "INSERT INTO machine (id, tenant_id, code, criticality) VALUES ($1, $2, 'VC-TWO', 'A')",
    [MACHINE_2, TENANT_2],
  );
  await admin.query(
    "INSERT INTO person (id, tenant_id, name, team) VALUES ($1, $2, 'Other Asha', 'maintenance')",
    [PERSON_2, TENANT_2],
  );
  await admin.query(
    "INSERT INTO login (id, tenant_id, person_id, username, password_hash, role, shared) VALUES ($1, $2, $3, 'asha2', $4, 'technician', false)",
    [LOGIN_2, TENANT_2, PERSON_2, passwordHash],
  );
  await admin.query(
    "INSERT INTO ref_counter (tenant_id, prefix, next_value) VALUES ($1, 'BD', 1)",
    [TENANT_2],
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
    expect(corrected.json().ticket.criticalitySnapshot).toBe('C'); // report-time snapshot is immutable
  });

  it('recalculates existing tickets when machine criticality changes', async () => {
    const MACHINE = '30000000-0000-0000-0000-000000000015';
    await admin.query(
      "INSERT INTO machine (id, tenant_id, code, criticality) VALUES ($1, $2, 'VC-CHANGE', 'A')",
      [MACHINE, TENANT],
    );
    const raised = await post('/api/v1/tickets', ashaToken, {
      machineId: MACHINE,
      problem: 'Criticality changes later',
    });
    const id = raised.json().ticket.id as string;
    expect(raised.json().ticket.severity).toBe('S1');

    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { host: 'severity.localhost', 'content-type': 'application/json' },
      payload: { username: 'sevadmin', password: PASSWORD },
    });
    const adminToken = login.json().token as string;
    const updated = await app.inject({
      method: 'PUT',
      url: `/api/v1/machines/${MACHINE}/criticality`,
      headers: {
        host: 'severity.localhost',
        'content-type': 'application/json',
        authorization: `Bearer ${adminToken}`,
      },
      payload: { criticality: 'C' },
    });
    expect(updated.statusCode).toBe(200);

    const stored = await admin.query(
      'SELECT severity, criticality_snapshot FROM ticket WHERE id = $1',
      [id],
    );
    expect(stored.rows[0]).toEqual({ severity: 'S3', criticality_snapshot: 'A' });
    const detail = await app.inject({
      method: 'GET',
      url: `/api/v1/tickets/${id}`,
      headers: { host: 'severity.localhost', authorization: `Bearer ${ashaToken}` },
    });
    expect(detail.json().ticket.severity).toBe('S3');
    expect(detail.json().ticket.criticalitySnapshot).toBe('A');
  });

  it('recalculates severity when support is upgraded to stopped', async () => {
    const MACHINE_B = '30000000-0000-0000-0000-000000000014';
    await admin.query(
      "INSERT INTO machine (id, tenant_id, code, criticality) VALUES ($1, $2, 'VC-B', 'B')",
      [MACHINE_B, TENANT],
    );
    const raised = await post('/api/v1/tickets', ashaToken, {
      machineId: MACHINE_B,
      kind: 'support',
      problem: 'Support becomes a stoppage',
    });
    expect(raised.statusCode).toBe(201);
    const id = raised.json().ticket.id as string;
    expect(raised.json().ticket.severity).toBe('S3');

    // The machine is now A, but the report-time snapshot stays B after recalculation.
    await admin.query("UPDATE machine SET criticality = 'A' WHERE id = $1", [MACHINE_B]);
    const upgraded = await post(`/api/v1/tickets/${id}/upgrade-kind`, ashaToken, {});
    expect(upgraded.statusCode).toBe(200);
    expect(upgraded.json().ticket.kind).toBe('stopped');
    expect(upgraded.json().ticket.severity).toBe('S1');
    expect(upgraded.json().ticket.criticalitySnapshot).toBe('B');
  });

  it('uses a tenant custom matrix for new tickets without rewriting old ones', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { host: 'severity.localhost', 'content-type': 'application/json' },
      payload: { username: 'sevadmin', password: PASSWORD },
    });
    const adminToken = login.json().token as string;
    const matrix = {
      default: {
        A: { stopped: 'S4', support: 'S2' },
        B: { stopped: 'S2', support: 'S3' },
        C: { stopped: 'S3', support: 'S4' },
      },
      workRequest: 'S4',
      urgentWorkRequest: 'S3',
    };
    const updated = await app.inject({
      method: 'PUT',
      url: '/api/v1/settings/severity_matrix',
      headers: {
        host: 'severity.localhost',
        'content-type': 'application/json',
        authorization: `Bearer ${adminToken}`,
      },
      payload: { value: matrix },
    });
    expect(updated.statusCode).toBe(200);

    await admin.query("UPDATE ticket SET status = 'closed' WHERE machine_id = $1", [MACHINE_A]);
    const raised = await post('/api/v1/tickets', ashaToken, {
      machineId: MACHINE_A,
      problem: 'Custom matrix ticket',
    });
    expect(raised.statusCode).toBe(201);
    expect(raised.json().ticket.severity).toBe('S4');

    const old = await admin.query("SELECT severity FROM ticket WHERE problem = 'Spindle alarm'");
    expect(old.rows[0].severity).toBe('S1');
  });

  it('isolates tenant matrices and never reads another tenant ticket', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { host: 'severity-two.localhost', 'content-type': 'application/json' },
      payload: { username: 'asha2', password: PASSWORD },
    });
    expect(login.statusCode).toBe(200);
    const token2 = login.json().token as string;
    const adminLogin = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { host: 'severity.localhost', 'content-type': 'application/json' },
      payload: { username: 'sevadmin', password: PASSWORD },
    });
    expect(adminLogin.statusCode).toBe(200);
    const adminToken = adminLogin.json().token as string;
    const customMatrix = {
      default: {
        A: { stopped: 'S4', support: 'S2' },
        B: { stopped: 'S2', support: 'S3' },
        C: { stopped: 'S3', support: 'S4' },
      },
      workRequest: 'S4',
      urgentWorkRequest: 'S3',
    };
    const configured = await app.inject({
      method: 'PUT',
      url: '/api/v1/settings/severity_matrix',
      headers: {
        host: 'severity.localhost',
        'content-type': 'application/json',
        authorization: `Bearer ${adminToken}`,
      },
      payload: { value: customMatrix },
    });
    expect(configured.statusCode).toBe(200);
    const other = await post(
      '/api/v1/tickets',
      token2,
      { machineId: MACHINE_2, problem: 'Tenant two default matrix' },
      'severity-two.localhost',
    );
    expect(other.statusCode).toBe(201);
    expect(other.json().ticket.severity).toBe('S1');

    await admin.query("UPDATE ticket SET status = 'closed' WHERE machine_id = $1", [MACHINE_A]);
    const custom = await post('/api/v1/tickets', ashaToken, {
      machineId: MACHINE_A,
      problem: 'Tenant one custom matrix',
    });
    expect(custom.json().ticket.severity).toBe('S4');

    const crossRead = await app.inject({
      method: 'GET',
      url: `/api/v1/tickets/${custom.json().ticket.id}`,
      headers: { host: 'severity-two.localhost', authorization: `Bearer ${token2}` },
    });
    expect(crossRead.statusCode).toBe(404);
  });

  it('keeps each raise on a complete matrix during concurrent setting updates', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { host: 'severity.localhost', 'content-type': 'application/json' },
      payload: { username: 'sevadmin', password: PASSWORD },
    });
    expect(login.statusCode).toBe(200);
    const adminToken = login.json().token as string;
    const config = await app.inject({
      method: 'GET',
      url: '/api/v1/config',
      headers: { host: 'severity.localhost', authorization: `Bearer ${adminToken}` },
    });
    expect(config.statusCode).toBe(200);
    const current = config.json().severityMatrix;
    const alternate = {
      ...current,
      default: {
        ...current.default,
        A: {
          ...current.default.A,
          stopped: current.default.A.stopped === 'S1' ? 'S4' : 'S1',
        },
      },
    };
    const matrices = [current, alternate];
    const allowed = new Set(matrices.map((matrix) => matrix.default.A.stopped));
    const machineIds = [20, 21, 22, 23].map(
      (suffix) => `30000000-0000-0000-0000-0000000000${suffix}`,
    );
    for (const machineId of machineIds) {
      await admin.query(
        "INSERT INTO machine (id, tenant_id, code, criticality) VALUES ($1, $2, $3, 'A')",
        [machineId, TENANT, `VC-RACE-${machineId.slice(-2)}`],
      );
    }

    await Promise.all(
      machineIds.map(async (machineId, index) => {
        const [written, raised] = await Promise.all([
          app.inject({
            method: 'PUT',
            url: '/api/v1/settings/severity_matrix',
            headers: {
              host: 'severity.localhost',
              'content-type': 'application/json',
              authorization: `Bearer ${adminToken}`,
            },
            payload: { value: matrices[index % 2] },
          }),
          post('/api/v1/tickets', ashaToken, {
            machineId,
            problem: `Concurrent matrix ${index}`,
          }),
        ]);
        expect(written.statusCode).toBe(200);
        expect(raised.statusCode).toBe(201);
        expect(allowed.has(raised.json().ticket.severity)).toBe(true);
        expect(raised.json().ticket.criticalitySnapshot).toBe('A');
      }),
    );
  });
});
