import { hash } from '@node-rs/argon2';
import type { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { loggerOptions } from '../src/kernel/logging.js';
import { hashToken } from '../src/modules/identity/index.js';
import { startTestDb, type TestDb } from './harness.js';

const TENANT = '10000000-0000-0000-0000-000000000001';
const PERSON = '10000000-0000-0000-0000-000000000002';
const LOGIN = '10000000-0000-0000-0000-000000000003';
const FAKE_TOKEN = 'fake-session-token-for-tests';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

type Line = Record<string, unknown>;
let db: TestDb;
let admin: Pool;
let app: Awaited<ReturnType<typeof buildApp>>;
const lines: string[] = [];
const logged = (): Line[] => lines.map((l) => JSON.parse(l) as Line);

beforeAll(async () => {
  db = await startTestDb();
  admin = db.admin;
  const passwordHash = await hash('fake-password-for-tests');
  await admin.query("INSERT INTO tenant (id, slug, name) VALUES ($1, 'cosmos', 'Cosmos')", [
    TENANT,
  ]);
  await admin.query(
    "INSERT INTO person (id, tenant_id, name, team, title) VALUES ($1, $2, 'Ravi Test', 'maintenance', 'Technician')",
    [PERSON, TENANT],
  );
  await admin.query(
    "INSERT INTO login (id, tenant_id, person_id, username, password_hash, role, shared) VALUES ($1, $2, $3, 'ravi-test', $4, 'technician', false)",
    [LOGIN, TENANT, PERSON, passwordHash],
  );
  await admin.query(
    "INSERT INTO session (tenant_id, login_id, token_hash, expires_at, acting_person_id) VALUES ($1, $2, $3, now() + interval '1 day', $4)",
    [TENANT, LOGIN, hashToken(FAKE_TOKEN), PERSON],
  );
  app = await buildApp({
    pool: db.app,
    rateLimitMax: 100000,
    logger: loggerOptions({ write: (l) => lines.push(l) }),
  });
  app.get('/boom', () => {
    throw new Error('boom');
  });
}, 120_000);

afterAll(async () => {
  await app.close();
  await db.stop();
});

const me = () =>
  app.inject({
    method: 'GET',
    url: '/api/v1/auth/me',
    headers: { host: 'cosmos.localhost', authorization: `Bearer ${FAKE_TOKEN}` },
  });

describe('logging', () => {
  it('every request is logged with a request id and no client address', async () => {
    lines.length = 0;
    const res = await app.inject({ method: 'GET', url: '/api/v1/health?probe=1' });
    const id = res.headers['x-request-id'];
    expect(id).toMatch(UUID);
    const mine = logged();
    expect(mine.length).toBeGreaterThanOrEqual(2);
    expect(mine.every((l) => l.requestId === id)).toBe(true);
    expect(mine.find((l) => l.msg === 'incoming request')?.req).toEqual({
      method: 'GET',
      url: '/api/v1/health',
    });
    for (const banned of ['remoteAddress', 'remotePort', '"ip"', 'hostname', 'x-forwarded-for'])
      expect(lines.join('')).not.toContain(banned);
  });

  it('an authenticated request is logged with its tenant and login', async () => {
    lines.length = 0;
    expect((await me()).statusCode).toBe(200);
    const done = logged().find((l) => l.msg === 'request completed');
    expect(done).toMatchObject({ tenantId: TENANT, loginId: LOGIN });
  });

  it('names, credentials and bodies are redacted', async () => {
    lines.length = 0;
    app.log.info({ body: { name: 'Ravi Test' } });
    app.log.info({ person: { name: 'Ravi Test', phone: '9000000000' } });
    await me();
    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { host: 'cosmos.localhost', 'content-type': 'application/json' },
      payload: { username: 'ravi-test', password: 'wrong-password' },
    });
    const out = lines.join('');
    for (const secret of ['Ravi Test', '9000000000', 'ravi-test', 'wrong-password', FAKE_TOKEN])
      expect(out).not.toContain(secret);
    expect(out).toContain('[redacted]');
    const completed = logged().filter((l) => l.msg === 'request completed');
    expect(completed.at(-1)).toMatchObject({ tenantId: TENANT });
  });

  it('an unhandled error is logged at level 50 with its request id', async () => {
    lines.length = 0;
    const res = await app.inject({
      method: 'GET',
      url: '/boom',
      headers: { host: 'cosmos.localhost', authorization: `Bearer ${FAKE_TOKEN}` },
    });
    expect(res.statusCode).toBe(500);
    expect(res.json().error.code).toBe('internal');
    const errors = logged().filter((l) => l.level === 50);
    expect(errors).toHaveLength(1);
    expect(errors[0]?.requestId).toBe(res.headers['x-request-id']);
  });
});
