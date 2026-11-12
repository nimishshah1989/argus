import { hash } from '@node-rs/argon2';
import type { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { startTestDb, type TestDb } from './harness.js';

const TENANT = '50000000-0000-0000-0000-000000000001';
const ADMIN_PERSON = '50000000-0000-0000-0000-000000000002';
const ADMIN_LOGIN = '50000000-0000-0000-0000-000000000003';
const TECH_LOGIN = '50000000-0000-0000-0000-000000000004';
const HEAD_LOGIN = '50000000-0000-0000-0000-000000000005';
const PASSWORD = 'correct-horse-battery';

type App = Awaited<ReturnType<typeof buildApp>>;
type Res = Awaited<ReturnType<App['inject']>>;
let db: TestDb;
let admin: Pool;
let app: App;

function req(
  method: 'GET' | 'PUT' | 'POST',
  url: string,
  token?: string,
  payload?: object,
): Promise<Res> {
  return app.inject({
    method,
    url,
    headers: {
      host: 'sla.localhost',
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    ...(payload ? { payload } : {}),
  });
}

async function login(username: string): Promise<string> {
  const res = await req('POST', '/api/v1/auth/login', undefined, {
    username,
    password: PASSWORD,
  });
  expect(res.statusCode).toBe(200);
  return res.json().token as string;
}

function body() {
  return {
    policies: [
      { severity: 'S1', ackMinutes: 5, restoreMinutes: 60, businessHoursOnly: false },
      { severity: 'S2', ackMinutes: 10, restoreMinutes: 120, businessHoursOnly: false },
      { severity: 'S3', ackMinutes: 15, restoreMinutes: 240, businessHoursOnly: false },
      { severity: 'S4', ackMinutes: 30, restoreMinutes: 480, businessHoursOnly: false },
    ],
  };
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
    [ADMIN_PERSON, TENANT],
  );
  await admin.query(
    `INSERT INTO login (id, tenant_id, person_id, username, password_hash, role, shared) VALUES
      ($1, $4, $5, 'admin', $6, 'admin', false),
      ($2, $4, $5, 'tech', $6, 'technician', false),
      ($3, $4, $5, 'head', $6, 'head', false)`,
    [ADMIN_LOGIN, TECH_LOGIN, HEAD_LOGIN, TENANT, ADMIN_PERSON, passwordHash],
  );
  app = await buildApp({ pool: db.app, logger: false, rateLimitMax: 100000 });
}, 120_000);

afterAll(async () => {
  await app.close();
  await db.stop();
});

describe('SLA policy settings', () => {
  it('starts with no policies and validates the complete four-policy body', async () => {
    const token = await login('admin');
    const initial = await req('GET', '/api/v1/config', token);
    expect(initial.statusCode).toBe(200);
    expect(initial.json().slaPolicies).toEqual([]);

    expect(
      (await req('PUT', '/api/v1/settings/sla-policies', token, { policies: [] })).statusCode,
    ).toBe(422);
    const duplicate = body();
    duplicate.policies[1]!.severity = 'S1';
    expect((await req('PUT', '/api/v1/settings/sla-policies', token, duplicate)).statusCode).toBe(
      422,
    );
    const zero = body();
    zero.policies[0]!.ackMinutes = 0;
    expect((await req('PUT', '/api/v1/settings/sla-policies', token, zero)).statusCode).toBe(422);
    const businessHours = body();
    businessHours.policies[0]!.businessHoursOnly = true;
    expect(
      (await req('PUT', '/api/v1/settings/sla-policies', token, businessHours)).statusCode,
    ).toBe(422);
  });

  it('creates stable policies atomically, audits once, and allows admin/head only', async () => {
    const token = await login('admin');
    const saved = await req('PUT', '/api/v1/settings/sla-policies', token, body());
    expect(saved.statusCode).toBe(200);
    const cfg = await req('GET', '/api/v1/config', token);
    expect(cfg.json().slaPolicies).toHaveLength(4);
    const firstIds = cfg.json().slaPolicies.map((p: { id: string }) => p.id);
    expect((await req('PUT', '/api/v1/settings/sla-policies', token, body())).statusCode).toBe(200);
    const secondIds = (await req('GET', '/api/v1/config', token))
      .json()
      .slaPolicies.map((p: { id: string }) => p.id);
    expect(secondIds).toEqual(firstIds);
    expect((await admin.query('SELECT count(*)::int AS n FROM audit_log')).rows[0].n).toBe(1);
    expect(
      (await req('PUT', '/api/v1/settings/sla-policies', await login('tech'), body())).statusCode,
    ).toBe(403);
    expect(
      (await req('PUT', '/api/v1/settings/sla-policies', await login('head'), body())).statusCode,
    ).toBe(200);
  });
});
