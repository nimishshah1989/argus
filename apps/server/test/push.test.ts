import { hash } from '@node-rs/argon2';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
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
  endpoint: 'https://fcm.googleapis.com/fcm/send/endpoint-1',
  keys: { p256dh: 'test-p256dh', auth: 'test-auth' },
};

type App = Awaited<ReturnType<typeof buildApp>>;
type Res = Awaited<ReturnType<App['inject']>>;

let db: TestDb;
let app: App;
let token1 = '';
let token2 = '';
let vapidPublic = '';

function post(
  url: string,
  token: string,
  payload: unknown,
  host = 'cosmos.localhost',
): Promise<Res> {
  return app.inject({
    method: 'POST',
    url,
    headers: {
      host,
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
  // No test may reach a real push service.
  vi.spyOn(webpush, 'sendNotification').mockResolvedValue({
    statusCode: 201,
    body: '',
    headers: {},
  });
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
    await post(
      '/api/v1/push/subscribe',
      token2,
      { subscription: SUBSCRIPTION, actingPersonId: PERSON_2 },
      'plant-two.localhost',
    );
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

describe('the test button on a shared phone', () => {
  it('asks to choose who is using the phone instead of answering "sent: 0"', async () => {
    await db.admin.query(
      `INSERT INTO login (tenant_id, person_id, username, password_hash, role, shared)
       SELECT tenant_id, NULL, 'cell-phone', password_hash, 'operator', true FROM login WHERE id = $1`,
      [LOGIN_1],
    );
    const shared = await login('cell-phone', 'cosmos.localhost');
    const res = await post('/api/v1/push/test', shared, {});
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('choose_acting_person');
  });
});

describe('which addresses a push subscription may name', () => {
  const subscribe = (endpoint: string) =>
    post('/api/v1/push/subscribe', token1, {
      subscription: { endpoint, keys: SUBSCRIPTION.keys },
      actingPersonId: PERSON_1,
    });

  it('refuses addresses that are not a real push service, and stores nothing', async () => {
    await db.admin.query('DELETE FROM push_subscription');
    const bad = [
      'http://169.254.169.254/latest/meta-data/',
      'https://169.254.169.254/',
      'https://evil.example/endpoint',
      'https://[::1]/',
      'http://fcm.googleapis.com/fcm/send/x',
      'https://fcm.googleapis.com:8443/fcm/send/x',
      'https://fcm.googleapis.com@evil.example/fcm/send/x',
      'https://user:secret@fcm.googleapis.com/fcm/send/x',
      'https://fcm.googleapis.com.evil.example/fcm/send/x',
      'https://evilpush.apple.com/x',
      'https://push.apple.com.evil.example/x',
      'https://notify.windows.com.evil.example/x',
      'ftp://fcm.googleapis.com/x',
      'not a url',
      // web-push connects with Node's legacy url.parse, which reads these hosts differently from new URL().
      'https://localhost%2e.push.apple.com/x',
      'https://127.0.0.1%2e.push.apple.com/x',
      'https://169.254.169.254%2e.push.apple.com/',
      'https://evil.com%2e.notify.windows.com/x',
      'https:/fcm.googleapis.com/x',
      'https://fcm%2egoogleapis.com/',
      'https://fcm.googleapis.com\\@evil.example/x',
      'https://fcm.googleapis.com\\x',
      'https://fcm.googleapis.com /x',
      'https://fcm.googleapis.com/x\ny',
    ];
    for (const endpoint of bad) {
      const res = await subscribe(endpoint);
      expect(res.statusCode, endpoint).toBe(422);
    }
    expect((await db.admin.query('SELECT 1 FROM push_subscription')).rows).toEqual([]);
  });

  it('accepts the real push services', async () => {
    const good = [
      'https://fcm.googleapis.com/fcm/send/abc',
      'https://updates.push.services.mozilla.com/wpush/v2/abc',
      'https://web.push.apple.com/abc',
      'https://wns2-par02p.notify.windows.com/w/?token=abc',
      'https://fcm.googleapis.com:443/fcm/send/abc',
    ];
    for (const endpoint of good) {
      expect((await subscribe(endpoint)).statusCode, endpoint).toBe(200);
    }
  });

  it('never sends to an address saved before the rule, such as an internal one', async () => {
    await db.admin.query('DELETE FROM push_subscription');
    await db.admin.query(
      `INSERT INTO push_subscription (tenant_id, login_id, acting_person_id, endpoint, keys, role)
       VALUES ($1, $2, $3, 'http://169.254.169.254/latest/meta-data/', '{"p256dh":"a","auth":"b"}', 'technician'),
              ($1, $2, $3, 'https://localhost%2e.push.apple.com/x', '{"p256dh":"a","auth":"b"}', 'technician'),
              ($1, $2, $3, 'https://169.254.169.254%2e.push.apple.com/', '{"p256dh":"a","auth":"b"}', 'technician'),
              ($1, $2, $3, 'https:/fcm.googleapis.com/x', '{"p256dh":"a","auth":"b"}', 'technician'),
              ($1, $2, $3, 'https://fcm.googleapis.com/fcm/send/ok', '{"p256dh":"a","auth":"b"}', 'technician')`,
      [TENANT, LOGIN_1, PERSON_1],
    );
    const send = vi.mocked(webpush.sendNotification);
    send.mockClear();
    const res = await post('/api/v1/push/test', token1, {});
    expect(res.json()).toEqual({ sent: 1 });
    expect(send.mock.calls.map(([sub]) => (sub as { endpoint: string }).endpoint)).toEqual([
      'https://fcm.googleapis.com/fcm/send/ok',
    ]);
  });

  it('stores and sends the one normalised spelling of an address', async () => {
    await db.admin.query('DELETE FROM push_subscription');
    expect((await subscribe('HTTPS://FCM.googleapis.com:443/fcm/send/Mixed')).statusCode).toBe(200);
    const rows = await db.admin.query('SELECT endpoint FROM push_subscription');
    expect(rows.rows).toEqual([{ endpoint: 'https://fcm.googleapis.com/fcm/send/Mixed' }]);
  });
});
