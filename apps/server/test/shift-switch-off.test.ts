import { hash } from '@node-rs/argon2';
import type { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { startTestDb, type TestDb } from './harness.js';

// Switching a shift off changes what the floor and the roster offer, never a deadline or a past result.
const TENANT = '50000000-0000-0000-0000-0000000000a1';
const PERSON = '50000000-0000-0000-0000-0000000000a2';
const LOGIN = '50000000-0000-0000-0000-0000000000a3';
const MACHINE = '50000000-0000-0000-0000-0000000000a4';
const PASSWORD = 'correct-horse-battery';

type App = Awaited<ReturnType<typeof buildApp>>;
let db: TestDb;
let admin: Pool;
let app: App;
let token = '';
let key = 0;
const shiftIds: Record<string, string> = {};

function call(method: 'GET' | 'PUT' | 'POST', url: string, payload?: object) {
  key += 1;
  return app.inject({
    method,
    url,
    headers: {
      host: 'sla.localhost',
      'content-type': 'application/json',
      'idempotency-key': `switch-${key}`,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    ...(payload ? { payload } : {}),
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
  await admin.query("INSERT INTO tenant (id, slug, name) VALUES ($1, 'sla', 'SLA')", [TENANT]);
  await admin.query(
    "INSERT INTO person (id, tenant_id, name, team) VALUES ($1, $2, 'Admin', 'maintenance')",
    [PERSON, TENANT],
  );
  await admin.query(
    "INSERT INTO login (id, tenant_id, person_id, username, password_hash, role, shared) VALUES ($1, $2, $3, 'admin', $4, 'admin', false)",
    [LOGIN, TENANT, PERSON, passwordHash],
  );
  await admin.query(
    "INSERT INTO machine (id, tenant_id, code, criticality) VALUES ($1, $2, 'VC-SW', 'A')",
    [MACHINE, TENANT],
  );
  await admin.query(
    `INSERT INTO shift (tenant_id, code, name, starts_at, ends_at, crosses_midnight) VALUES
       ($1, '1', 'Shift 1', '08:00', '18:30', false), ($1, '2', 'Shift 2', '18:29', '05:00', true)`,
    [TENANT],
  );
  for (const row of (await admin.query('SELECT id, code FROM shift WHERE tenant_id = $1', [TENANT]))
    .rows) {
    shiftIds[row.code] = row.id;
  }
  app = await buildApp({ pool: db.app, logger: false, rateLimitMax: 100000 });
  const login = await call('POST', '/api/v1/auth/login', { username: 'admin', password: PASSWORD });
  token = login.json().token;
  // Business hours only, with deadlines long enough to run across both shifts whatever the time of day.
  const policies = [
    { severity: 'S1', ackMinutes: 1000, restoreMinutes: 3000, businessHoursOnly: true },
    { severity: 'S2', ackMinutes: 90, restoreMinutes: 360, businessHoursOnly: false },
    { severity: 'S3', ackMinutes: 120, restoreMinutes: 480, businessHoursOnly: false },
    { severity: 'S4', ackMinutes: 180, restoreMinutes: 720, businessHoursOnly: false },
  ];
  const saved = await call('PUT', '/api/v1/settings/sla-policies', { policies });
  expect(saved.statusCode, saved.body).toBe(200);
}, 180_000);

afterAll(async () => {
  await app.close();
  await db.stop();
});

describe('switching a shift off', () => {
  it('leaves every due time of a running ticket where it was', async () => {
    const raised = await call('POST', '/api/v1/tickets', {
      machineId: MACHINE,
      problem: 'Business hours SLA',
    });
    expect(raised.statusCode, raised.body).toBe(201);
    const id = raised.json().ticket.id as string;
    const due = async () => (await call('GET', `/api/v1/tickets/${id}`)).json().ticket.sla;
    const before = await due();
    expect(before).toBeTruthy();
    const off = await call('PUT', `/api/v1/shifts/${shiftIds['2']}`, { active: false });
    expect(off.statusCode, off.body).toBe(200);
    expect(await due()).toEqual(before);
    await call('PUT', `/api/v1/shifts/${shiftIds['2']}`, { active: true });
    expect(await due()).toEqual(before);
  });

  it('is refused for the last shift still in use, so the plant always has one', async () => {
    expect(
      (await call('PUT', `/api/v1/shifts/${shiftIds['2']}`, { active: false })).statusCode,
    ).toBe(200);
    const last = await call('PUT', `/api/v1/shifts/${shiftIds['1']}`, { active: false });
    expect(last.statusCode).toBe(409);
    expect(last.json().error.field).toBe('active');
    expect((await call('GET', '/api/v1/tickets')).statusCode).toBe(200);
  });
});
