import { hash } from '@node-rs/argon2';
import type { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { startTestDb, type TestDb } from './harness.js';

const A = '10000000-0000-0000-0000-000000000001';
const ADMIN_PERSON = '10000000-0000-0000-0000-000000000021';
const TECH_PERSON = '10000000-0000-0000-0000-000000000022';
const ADMIN_LOGIN = '10000000-0000-0000-0000-000000000023';
const TECH_LOGIN = '10000000-0000-0000-0000-000000000024';
const ITEM_SPARE = '10000000-0000-0000-0000-000000000031';
const ITEM_VENDOR = '10000000-0000-0000-0000-000000000032';
const PASSWORD = 'correct-horse-battery';

type App = Awaited<ReturnType<typeof buildApp>>;
type Res = Awaited<ReturnType<App['inject']>>;

let db: TestDb;
let admin: Pool;
let app: App;

function req(
  method: 'GET' | 'PUT' | 'POST' | 'DELETE',
  url: string,
  token?: string,
  payload?: object,
): Promise<Res> {
  return app.inject({
    method,
    url,
    headers: {
      host: 'cosmos.localhost',
      'content-type': 'application/json',
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
  await admin.query("INSERT INTO tenant (id, slug, name) VALUES ($1, 'cosmos', 'Cosmos')", [A]);
  await admin.query(
    "INSERT INTO person (id, tenant_id, name, team, title) VALUES ($1, $3, 'Admin', 'maintenance', 'Head'), ($2, $3, 'Tech', 'maintenance', 'Technician')",
    [ADMIN_PERSON, TECH_PERSON, A],
  );
  await admin.query(
    `INSERT INTO login (id, tenant_id, person_id, username, password_hash, role, shared)
     VALUES ($1, $3, $5, 'admin', $7, 'admin', false), ($2, $4, $6, 'tech', $7, 'technician', false)`,
    [ADMIN_LOGIN, TECH_LOGIN, A, A, ADMIN_PERSON, TECH_PERSON, passwordHash],
  );
  await admin.query(
    "INSERT INTO list_item (id, tenant_id, list, code, label, label_gu, sort, active) VALUES ($1, $3, 'wait_reason', 'spare', 'Waiting for spare', NULL, 0, true), ($2, $3, 'wait_reason', 'vendor', 'Sent to vendor', 'વેન્ડર', 1, true)",
    [ITEM_SPARE, ITEM_VENDOR, A],
  );
  await admin.query(
    'INSERT INTO setting (tenant_id, key, value) VALUES ($1, \'features\', \'{"general": true, "pause": true}\')',
    [A],
  );
  app = await buildApp({ pool: db.app, logger: false, rateLimitMax: 100000 });
}, 120_000);

afterAll(async () => {
  await app.close();
  await db.stop();
});

async function loginAs(username: string): Promise<string> {
  const res = await req('POST', '/api/v1/auth/login', undefined, { username, password: PASSWORD });
  expect(res.statusCode).toBe(200);
  return res.json().token as string;
}

describe('settings and config', () => {
  it('returns the full config with a fingerprint and lists the missing translations', async () => {
    const token = await loginAs('admin');
    const cfg = await req('GET', '/api/v1/config', token);
    expect(cfg.statusCode).toBe(200);
    const body = cfg.json();
    expect(typeof body.fp).toBe('string');
    expect(body.features.general).toBe(true);
    expect(body.language).toBe('en');
    expect(body.lists.wait_reason).toHaveLength(2);
    const missing = await req('GET', '/api/v1/translations/missing', token);
    const codes = missing.json().map((row: { code: string }) => row.code);
    expect(codes).toContain('spare');
    expect(codes).not.toContain('vendor');
  });

  it('returns same:true for an unchanged fingerprint and changes it after an edit', async () => {
    const token = await loginAs('admin');
    const before = (await req('GET', '/api/v1/config', token)).json().fp as string;
    const same = await req('GET', `/api/v1/config?fp=${before}`, token);
    expect(same.json()).toEqual({ same: true, fp: before });
    const edit = await req('PUT', '/api/v1/lists/wait_reason/vendor', token, {
      label: 'Sent to vendor (changed)',
    });
    expect(edit.statusCode).toBe(200);
    const after = (await req('GET', '/api/v1/config', token)).json();
    expect(after.fp).not.toBe(before);
    expect(
      after.lists.wait_reason.find((row: { code: string }) => row.code === 'vendor').label,
    ).toBe('Sent to vendor (changed)');
  });

  it('only admin or head may write', async () => {
    const tech = await loginAs('tech');
    const denied = await req('PUT', '/api/v1/lists/wait_reason/vendor', tech, { label: 'x' });
    expect(denied.statusCode).toBe(403);
    expect(denied.json().error.code).toBe('forbidden');
  });

  it('updates features through /settings and reflects them in /config', async () => {
    const token = await loginAs('admin');
    const put = await req('PUT', '/api/v1/settings/features', token, {
      value: { general: false, pause: true },
    });
    expect(put.statusCode).toBe(200);
    const cfg = await req('GET', '/api/v1/config', token);
    expect(cfg.json().features.general).toBe(false);
  });

  it('fills a missing translation and removes it from the list', async () => {
    const token = await loginAs('admin');
    const put = await req('PUT', `/api/v1/translations/${ITEM_SPARE}`, token, { labelGu: 'સ્પેર' });
    expect(put.statusCode).toBe(200);
    const missing = await req('GET', '/api/v1/translations/missing', token);
    expect(missing.json().map((row: { code: string }) => row.code)).not.toContain('spare');
  });

  it('rejects unauthenticated /config', async () => {
    const cfg = await req('GET', '/api/v1/config');
    expect(cfg.statusCode).toBe(401);
  });
});
