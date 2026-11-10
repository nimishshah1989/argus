import { hash } from '@node-rs/argon2';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import webpush from 'web-push';
import { buildApp } from '../src/app.js';
import { startTestDb, type TestDb } from './harness.js';

const TENANT = '10000000-0000-0000-0000-000000000001';
const TENANT_2 = '20000000-0000-0000-0000-000000000001';
const PERSON_1 = '10000000-0000-0000-0000-000000000002';
const PERSON_2 = '20000000-0000-0000-0000-000000000002';
const LOGIN_1 = '10000000-0000-0000-0000-000000000003';
const LOGIN_2 = '20000000-0000-0000-0000-000000000003';
const PASSWORD = 'correct-horse-battery';

const SUBSCRIPTION = {
  endpoint: 'https://push.example/endpoint-1',
  keys: { p256dh: 'test-p256dh', auth: 'test-auth' },
};

type App = Awaited<ReturnType<typeof buildApp>>;
type Res = Awaited<ReturnType<App['inject']>>;

let db: TestDb;
let app: App;
let token1 = '';
let token2 = '';
let vapidPublic = '';

function post(url: string, token: string, payload: unknown): Promise<Res> {
  return app.inject({
    method: 'POST',
    url,
    headers: {
      host: 'cosmos.localhost',
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    payload: payload as object,
  });
}

function get(url: string, token?: string): Promise<Res> {
  return app.inject({
    method: 'GET',
    url,
    headers: { host: 'cosmos.localhost', ...(token ? { authorization: `Bearer ${token}` } : {}) },
  });
}

async function login(username: string, host: string): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    headers: { host, 'content-type': 'application/json' },
    payload: { username, password: PASSWORD },
  });
  expect(res.statusCode).toBe(200);
  return res.json().token as string;
}

async function clearVapid<T>(run: () => Promise<T>): Promise<T> {
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  delete process.env.VAPID_PUBLIC_KEY;
  delete process.env.VAPID_PRIVATE_KEY;
  try {
    return await run();
  } finally {
    process.env.VAPID_PUBLIC_KEY = pub;
    process.env.VAPID_PRIVATE_KEY = priv;
  }
}

beforeAll(async () => {
  const keys = webpush.generateVAPIDKeys();
  vapidPublic = keys.publicKey;
  process.env.VAPID_PUBLIC_KEY = keys.publicKey;
  process.env.VAPID_PRIVATE_KEY = keys.privateKey;

  db = await startTestDb();
  const passwordHash = await hash(PASSWORD, {
    algorithm: 2,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
  await db.admin.query(
    "INSERT INTO tenant (id, slug, name) VALUES ($1, 'cosmos', 'Cosmos'), ($2, 'plant-two', 'Plant Two')",
    [TENANT, TENANT_2],
  );
  await db.admin.query(
    `INSERT INTO person (id, tenant_id, name, team) VALUES
     ($1, $3, 'Asha', 'maintenance'), ($2, $4, 'Bina', 'maintenance')`,
    [PERSON_1, PERSON_2, TENANT, TENANT_2],
  );
  await db.admin.query(
    `INSERT INTO login (id, tenant_id, person_id, username, password_hash, role, shared) VALUES
     ($1, $3, $5, 'asha', $7, 'technician', false),
     ($2, $4, $6, 'bina', $7, 'technician', false)`,
    [LOGIN_1, LOGIN_2, TENANT, TENANT_2, PERSON_1, PERSON_2, passwordHash],
  );

  app = await buildApp({ pool: db.app, logger: false, rateLimitMax: 100000 });
  token1 = await login('asha', 'cosmos.localhost');
  token2 = await login('bina', 'plant-two.localhost');
}, 120_000);

afterAll(async () => {
  await app.close();
  await db.stop();
});

describe('web push', () => {
  it('requires authentication', async () => {
    expect((await get('/api/v1/push/key')).statusCode).toBe(401);
  });

  it('returns the configured public key and 503 when unset', async () => {
    const ok = await get('/api/v1/push/key', token1);
    expect(ok.statusCode).toBe(200);
    expect(ok.json()).toEqual({ publicKey: vapidPublic });

    await clearVapid(async () => {
      const missing = await get('/api/v1/push/key', token1);
      expect(missing.statusCode).toBe(503);
      expect(missing.json().error.code).toBe('not_configured');
    });
  });

  it('upserts a subscription per tenant and endpoint', async () => {
    const first = await post('/api/v1/push/subscribe', token1, {
      subscription: SUBSCRIPTION,
      actingPersonId: PERSON_1,
    });
    expect(first.statusCode).toBe(200);

    const replay = await post('/api/v1/push/subscribe', token1, {
      subscription: SUBSCRIPTION,
      actingPersonId: PERSON_1,
    });
    expect(replay.statusCode).toBe(200);

    const rows = await db.admin.query('SELECT * FROM push_subscription');
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0].tenant_id).toBe(TENANT);
    expect(rows.rows[0].login_id).toBe(LOGIN_1);
    expect(rows.rows[0].acting_person_id).toBe(PERSON_1);

    // The same endpoint in another tenant is a separate row.
    await post('/api/v1/push/subscribe', token2, {
      subscription: SUBSCRIPTION,
      actingPersonId: PERSON_2,
    });
    const after = await db.admin.query(
      'SELECT tenant_id FROM push_subscription ORDER BY tenant_id',
    );
    expect(after.rows.map((r: { tenant_id: string }) => r.tenant_id)).toEqual([TENANT, TENANT_2]);
  });

  it('unsubscribes only the caller tenant row', async () => {
    await post('/api/v1/push/unsubscribe', token1, { endpoint: SUBSCRIPTION.endpoint });
    const rows = await db.admin.query('SELECT tenant_id FROM push_subscription');
    expect(rows.rows.map((r: { tenant_id: string }) => r.tenant_id)).toEqual([TENANT_2]);
  });

  it('sends a test push as a no-op success (503 when unset)', async () => {
    await post('/api/v1/push/subscribe', token1, {
      subscription: SUBSCRIPTION,
      actingPersonId: PERSON_1,
    });
    const ok = await post('/api/v1/push/test', token1, {});
    expect(ok.statusCode).toBe(200);

    await clearVapid(async () => {
      const missing = await post('/api/v1/push/test', token1, {});
      expect(missing.statusCode).toBe(503);
      expect(missing.json().error.code).toBe('not_configured');
    });
  });
});
