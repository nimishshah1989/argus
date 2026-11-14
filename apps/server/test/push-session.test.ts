import { hash } from '@node-rs/argon2';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import webpush from 'web-push';
import { withTenant } from '@uptimo/db';
import { buildApp } from '../src/app.js';
import { hashToken } from '../src/modules/identity/index.js';
import { startTestDb, type TestDb } from './harness.js';

const TENANT = '10000000-0000-0000-0000-000000000001';
const PERSON = '10000000-0000-0000-0000-000000000002';
const LOGIN = '10000000-0000-0000-0000-000000000003';
const PASSWORD = 'correct-horse-battery';
const HOST = 'cosmos.localhost';

type App = Awaited<ReturnType<typeof buildApp>>;

let db: TestDb;
let app: App;
let send: ReturnType<typeof vi.spyOn>;

const device = (n: number) => ({
  endpoint: `https://fcm.googleapis.com/fcm/send/device-${n}`,
  keys: { p256dh: `p256dh-${n}`, auth: `auth-${n}` },
});

const call = (method: 'POST' | 'DELETE', url: string, token: string | null, payload?: object) =>
  app.inject({
    method,
    url,
    headers: {
      host: HOST,
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    payload: payload ?? {},
  });

async function signIn(username = 'asha'): Promise<string> {
  const res = await call('POST', '/api/v1/auth/login', null, {
    username,
    password: PASSWORD,
  });
  expect(res.statusCode).toBe(200);
  return res.json().token as string;
}

async function register(token: string, n: number): Promise<void> {
  const res = await call('POST', '/api/v1/push/subscribe', token, {
    subscription: device(n),
    actingPersonId: PERSON,
  });
  expect(res.statusCode).toBe(200);
}

/** Which devices a push to the person reaches right now, as the push service sees them. */
async function devicesReached(token: string): Promise<string[]> {
  send.mockClear();
  expect((await call('POST', '/api/v1/push/test', token)).statusCode).toBe(200);
  return send.mock.calls.map((c: unknown[]) => (c[0] as { endpoint: string }).endpoint).sort();
}

beforeAll(async () => {
  send = vi
    .spyOn(webpush, 'sendNotification')
    .mockResolvedValue({ statusCode: 201, body: '', headers: {} });
  const keys = webpush.generateVAPIDKeys();
  process.env.VAPID_PUBLIC_KEY = keys.publicKey;
  process.env.VAPID_PRIVATE_KEY = keys.privateKey;
  db = await startTestDb();
  const passwordHash = await hash(PASSWORD, {
    algorithm: 2,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
  await db.admin.query("INSERT INTO tenant (id, slug, name) VALUES ($1, 'cosmos', 'Cosmos')", [
    TENANT,
  ]);
  await db.admin.query(
    "INSERT INTO person (id, tenant_id, name, team) VALUES ($1, $2, 'Asha', 'maintenance')",
    [PERSON, TENANT],
  );
  await db.admin.query(
    "INSERT INTO login (id, tenant_id, person_id, username, password_hash, role, shared) VALUES ($1, $2, $3, 'asha', $4, 'technician', false)",
    [LOGIN, TENANT, PERSON, passwordHash],
  );
  app = await buildApp({ pool: db.app, logger: false, rateLimitMax: 100000 });
}, 120_000);

afterAll(async () => {
  await app.close();
  await db.stop();
});

describe('a signed-out device stops getting pushes', () => {
  beforeEach(async () => {
    await db.admin.query('DELETE FROM push_subscription');
  });

  it('signing out one phone drops its registration and leaves the other phone alone', async () => {
    const [phone, tablet] = [await signIn(), await signIn()];
    await register(phone, 1);
    await register(tablet, 2);
    expect(await devicesReached(tablet)).toEqual([device(1).endpoint, device(2).endpoint]);

    expect((await call('POST', '/api/v1/auth/logout', phone)).statusCode).toBe(200);

    expect(await devicesReached(tablet)).toEqual([device(2).endpoint]);
  });

  it('a session ended any other way drops its phone too, whoever ends it', async () => {
    const [phone, tablet] = [await signIn(), await signIn()];
    await register(phone, 3);
    await register(tablet, 4);
    // What the device list's "sign out" does: it marks the session revoked and calls nothing else.
    await withTenant(db.app, TENANT, (client) =>
      client.query('UPDATE session SET revoked_at = now() WHERE token_hash = $1', [
        hashToken(phone),
      ]),
    );
    expect(await devicesReached(tablet)).toEqual([device(4).endpoint]);
  });

  it('a phone that registers again after signing back in is reached again', async () => {
    const phone = await signIn();
    await register(phone, 5);
    expect(await devicesReached(phone)).toContain(device(5).endpoint);
    await call('POST', '/api/v1/auth/logout', phone);
    const again = await signIn();
    await register(again, 5);
    expect(await devicesReached(again)).toContain(device(5).endpoint);
  });

  it('refuses to register a phone for a session that has already ended', async () => {
    const phone = await signIn();
    await call('POST', '/api/v1/auth/logout', phone);
    const res = await call('POST', '/api/v1/push/subscribe', phone, {
      subscription: device(6),
      actingPersonId: PERSON,
    });
    expect(res.statusCode).toBe(401);
  });
});
