import { hash } from '@node-rs/argon2';
import type { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { startTestDb, type TestDb } from './harness.js';

type App = Awaited<ReturnType<typeof buildApp>>;
type InjectResponse = Awaited<ReturnType<App['inject']>>;
import { hashToken } from '../src/modules/identity/index.js';

const A = '10000000-0000-0000-0000-000000000001';
const B = '20000000-0000-0000-0000-000000000001';
const PERSON_A = '10000000-0000-0000-0000-000000000002';
const PERSON_B = '20000000-0000-0000-0000-000000000002';
const LOGIN_A = '10000000-0000-0000-0000-000000000003';
const LOGIN_B = '20000000-0000-0000-0000-000000000003';
const PASSWORD = 'correct-horse-battery';

let db: TestDb;
let admin: Pool;
let app: Awaited<ReturnType<typeof buildApp>>;

function post(
  url: string,
  host: string,
  payload: object,
  authorization?: string,
): Promise<InjectResponse> {
  const options = {
    method: 'POST',
    url,
    headers: {
      host,
      'content-type': 'application/json',
      ...(authorization ? { authorization: `Bearer ${authorization}` } : {}),
    },
    payload,
  };
  return app.inject(options);
}

function get(url: string, host: string, authorization?: string): Promise<InjectResponse> {
  const options = {
    method: 'GET',
    url,
    headers: { host, ...(authorization ? { authorization: `Bearer ${authorization}` } : {}) },
  };
  return app.inject(options);
}

beforeAll(async () => {
  db = await startTestDb();
  admin = db.admin;
  const passwordHash = await hash(PASSWORD, {
    algorithm: 2, // Argon2id
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
  await admin.query(
    "INSERT INTO tenant (id, slug, name) VALUES ($1, 'cosmos', 'Cosmos'), ($2, 'plant-two', 'Plant Two')",
    [A, B],
  );
  await admin.query(
    "INSERT INTO person (id, tenant_id, name, team, title) VALUES ($1, $3, 'Asha', 'maintenance', 'Technician'), ($2, $4, 'Bina', 'maintenance', 'Technician')",
    [PERSON_A, PERSON_B, A, B],
  );
  await admin.query(
    `INSERT INTO login (id, tenant_id, person_id, username, password_hash, role, shared)
     VALUES ($1, $3, $5, $6, $7, $8, false), ($2, $4, NULL, $9, $7, $10, true)`,
    [
      LOGIN_A,
      LOGIN_B,
      A,
      B,
      PERSON_A,
      'asha',
      passwordHash,
      'technician',
      'cell-phone',
      'operator',
    ],
  );
  app = await buildApp({ pool: db.app, logger: false, rateLimitMax: 100000 });
}, 120_000);

afterAll(async () => {
  await app.close();
  await db.stop();
});

describe('auth', () => {
  it('resolves the tenant from the host for /brand', async () => {
    expect((await get('/api/v1/brand', 'cosmos.localhost')).json()).toEqual({
      company: 'Cosmos',
      logo: null,
    });
    expect((await get('/api/v1/brand', 'plant-two.localhost')).json()).toEqual({
      company: 'Plant Two',
      logo: null,
    });
    expect((await get('/api/v1/brand', 'unknown.localhost')).statusCode).toBe(404);
    expect((await get('/api/v1/brand', 'localhost')).statusCode).toBe(404);
  });

  it('signs a personal login in and returns the user on /me', async () => {
    const login = await post('/api/v1/auth/login', 'cosmos.localhost', {
      username: 'asha',
      password: PASSWORD,
    });
    expect(login.statusCode).toBe(200);
    const body = login.json();
    expect(typeof body.token).toBe('string');
    expect(body.user).toMatchObject({
      username: 'asha',
      name: 'Asha',
      role: 'technician',
      shared: false,
    });
    const me = await get('/api/v1/auth/me', 'cosmos.localhost', body.token);
    expect(me.json().user.username).toBe('asha');
  });

  it('returns the same unauthenticated error for a wrong password or unknown username', async () => {
    const wrong = await post('/api/v1/auth/login', 'cosmos.localhost', {
      username: 'asha',
      password: 'wrong',
    });
    const unknown = await post('/api/v1/auth/login', 'cosmos.localhost', {
      username: 'nobody',
      password: PASSWORD,
    });
    expect(wrong.statusCode).toBe(401);
    expect(unknown.statusCode).toBe(401);
    expect(wrong.json()).toEqual(unknown.json());
    expect(wrong.json().error.code).toBe('unauthenticated');
  });

  it('records the acting person on a shared phone when one is chosen, and checks it', async () => {
    const unknown = await post('/api/v1/auth/login', 'plant-two.localhost', {
      username: 'cell-phone',
      password: PASSWORD,
      actingPersonId: PERSON_A,
    });
    expect(unknown.statusCode).toBe(422);
    expect(unknown.json().error.field).toBe('actingPersonId');
    const ok = await post('/api/v1/auth/login', 'plant-two.localhost', {
      username: 'cell-phone',
      password: PASSWORD,
      actingPersonId: PERSON_B,
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().user).toMatchObject({ shared: true, name: 'Bina', actingPersonId: PERSON_B });
  });

  it('logs out and revokes the session', async () => {
    const login = await post('/api/v1/auth/login', 'cosmos.localhost', {
      username: 'asha',
      password: PASSWORD,
    });
    const token = login.json().token as string;
    await post('/api/v1/auth/logout', 'cosmos.localhost', {}, token);
    const me = await get('/api/v1/auth/me', 'cosmos.localhost', token);
    expect(me.statusCode).toBe(401);
  });

  it('changes the password, keeps the current session and revokes the others', async () => {
    const one = await post('/api/v1/auth/login', 'cosmos.localhost', {
      username: 'asha',
      password: PASSWORD,
    });
    const two = await post('/api/v1/auth/login', 'cosmos.localhost', {
      username: 'asha',
      password: PASSWORD,
    });
    const token1 = one.json().token as string;
    const token2 = two.json().token as string;
    const wrongOld = await post(
      '/api/v1/auth/password',
      'cosmos.localhost',
      { old: 'nope', password: 'new-password-123' },
      token1,
    );
    expect(wrongOld.statusCode).toBe(401);
    const short = await post(
      '/api/v1/auth/password',
      'cosmos.localhost',
      { old: PASSWORD, password: 'short' },
      token1,
    );
    expect(short.statusCode).toBe(422);
    const changed = await post(
      '/api/v1/auth/password',
      'cosmos.localhost',
      { old: PASSWORD, password: 'new-password-123' },
      token1,
    );
    expect(changed.statusCode).toBe(200);
    expect((await get('/api/v1/auth/me', 'cosmos.localhost', token2)).statusCode).toBe(401);
    expect((await get('/api/v1/auth/me', 'cosmos.localhost', token1)).statusCode).toBe(200);
    const oldLogin = await post('/api/v1/auth/login', 'cosmos.localhost', {
      username: 'asha',
      password: PASSWORD,
    });
    const newLogin = await post('/api/v1/auth/login', 'cosmos.localhost', {
      username: 'asha',
      password: 'new-password-123',
    });
    expect(oldLogin.statusCode).toBe(401);
    expect(newLogin.statusCode).toBe(200);
  });

  it('slides the session forward on use, at most once in five minutes', async () => {
    const login = await post('/api/v1/auth/login', 'cosmos.localhost', {
      username: 'asha',
      password: 'new-password-123',
    });
    const token = login.json().token as string;
    const row = async () =>
      (
        await admin.query('SELECT last_seen_at, expires_at FROM session WHERE token_hash = $1', [
          hashToken(token),
        ])
      ).rows[0] as { last_seen_at: Date; expires_at: Date };

    // Seen a minute ago with 20 days left: a burst of reads rewrites nothing.
    await admin.query(
      "UPDATE session SET last_seen_at = now() - interval '1 minute', expires_at = now() + interval '20 days' WHERE token_hash = $1",
      [hashToken(token)],
    );
    const fresh = await row();
    for (let i = 0; i < 5; i += 1)
      expect((await get('/api/v1/auth/me', 'cosmos.localhost', token)).statusCode).toBe(200);
    expect(await row()).toEqual(fresh);

    // Last seen ten minutes ago: the next read slides it forward to 30 days, and only that one.
    await admin.query(
      "UPDATE session SET last_seen_at = now() - interval '10 minutes' WHERE token_hash = $1",
      [hashToken(token)],
    );
    await get('/api/v1/auth/me', 'cosmos.localhost', token);
    const slid = await row();
    expect(slid.expires_at.getTime()).toBeGreaterThan(fresh.expires_at.getTime() + 5 * 86400_000);
    expect(Date.now() - slid.last_seen_at.getTime()).toBeLessThan(60_000);
    await get('/api/v1/auth/me', 'cosmos.localhost', token);
    expect(await row()).toEqual(slid);
  });

  it('checks a session in one transaction and writes nothing when it is fresh', async () => {
    const login = await post('/api/v1/auth/login', 'cosmos.localhost', {
      username: 'asha',
      password: 'new-password-123',
    });
    const token = login.json().token as string;
    const statements: string[] = [];
    const pool = db.app as unknown as {
      connect: (cb?: unknown) => unknown;
    };
    const realConnect = pool.connect.bind(pool);
    const record = (args: unknown[]) => {
      const first = args[0] as { text?: string } | string;
      statements.push(typeof first === 'string' ? first : String(first?.text));
    };
    const wrapped = new WeakSet<object>();
    const counted = (client: { query: (...a: unknown[]) => unknown }) => {
      if (wrapped.has(client)) return client;
      wrapped.add(client);
      const query = client.query.bind(client);
      client.query = (...args: unknown[]) => {
        record(args);
        return query(...args);
      };
      return client;
    };
    pool.connect = (cb?: unknown) =>
      typeof cb === 'function'
        ? realConnect((err: unknown, client: never, done: unknown) =>
            (cb as (...a: unknown[]) => void)(err, client && counted(client), done),
          )
        : (realConnect() as Promise<never>).then(counted);
    try {
      const res = await get('/api/v1/auth/me', 'cosmos.localhost', token);
      expect(res.statusCode).toBe(200);
    } finally {
      pool.connect = realConnect;
    }
    expect(statements.filter((sql) => /update\s+session/i.test(sql))).toEqual([]);
    expect(statements.length).toBeLessThanOrEqual(6);
  });

  it("refuses a session on another customer's host, and shows nothing of either customer", async () => {
    const asha = (
      await post('/api/v1/auth/login', 'cosmos.localhost', {
        username: 'asha',
        password: 'new-password-123',
      })
    ).json().token as string;
    const cell = (
      await post('/api/v1/auth/login', 'plant-two.localhost', {
        username: 'cell-phone',
        password: PASSWORD,
        actingPersonId: PERSON_B,
      })
    ).json().token as string;
    expect((await get('/api/v1/auth/me', 'cosmos.localhost', asha)).statusCode).toBe(200);
    expect((await get('/api/v1/auth/me', 'plant-two.localhost', cell)).statusCode).toBe(200);
    for (const [token, host] of [
      [asha, 'plant-two.localhost'],
      [cell, 'cosmos.localhost'],
      [asha, 'plant-two.example.com'],
    ] as const) {
      for (const url of ['/api/v1/auth/me', '/api/v1/config']) {
        const res = await get(url, host, token);
        expect(res.statusCode, `${url} on ${host}`).toBe(401);
        expect(res.body).not.toMatch(/Asha|Bina/);
      }
    }
  });

  it('applies the default customer to a bare IP address, so the other customer is refused there', async () => {
    const asha = (
      await post('/api/v1/auth/login', 'cosmos.localhost', {
        username: 'asha',
        password: 'new-password-123',
      })
    ).json().token as string;
    const cell = (
      await post('/api/v1/auth/login', 'plant-two.localhost', {
        username: 'cell-phone',
        password: PASSWORD,
        actingPersonId: PERSON_B,
      })
    ).json().token as string;
    expect((await get('/api/v1/auth/me', '10.0.0.7:3001', asha)).statusCode).toBe(200);
    expect((await get('/api/v1/auth/me', '10.0.0.7:3001', cell)).statusCode).toBe(401);
  });
});

describe('login guard', () => {
  const HOST = 'plant-two.localhost';
  const attempt = (username: string, password: string, from: string, extra: object = {}) =>
    app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      remoteAddress: from,
      headers: { host: HOST, 'content-type': 'application/json' },
      payload: { username, password, ...extra },
    });
  const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;

  it('takes as long to refuse an unknown username as a wrong password', async () => {
    const unknown: number[] = [];
    const wrong: number[] = [];
    for (let i = 0; i < 7; i++) {
      let t = performance.now();
      await attempt(`nobody-${i}`, 'wrong-password', '198.51.100.20');
      unknown.push(performance.now() - t);
      t = performance.now();
      await attempt('cell-phone', 'wrong-password', '198.51.100.20');
      wrong.push(performance.now() - t);
    }
    expect(median(unknown)).toBeGreaterThan(median(wrong) * 0.5);
  });

  it('stops guessing one username after twenty misses, but only for that sender and name', async () => {
    const from = '198.51.100.21';
    for (let i = 0; i < 20; i++) {
      expect((await attempt('cell-phone', `guess-${i}`, from)).statusCode).toBe(401);
    }
    const blocked = await attempt('cell-phone', PASSWORD, from, { actingPersonId: PERSON_B });
    expect(blocked.statusCode).toBe(429);
    expect(blocked.json().error.code).toBe('rate_limited');
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
    const otherSender = await attempt('cell-phone', PASSWORD, '198.51.100.22', {
      actingPersonId: PERSON_B,
    });
    expect(otherSender.statusCode).toBe(200);
    expect((await attempt('nobody-else', 'x', from)).statusCode).toBe(401);
  });

  it('lets a whole shift sign in on one shared login from one address', async () => {
    const codes: number[] = [];
    for (let wave = 0; wave < 8; wave++) {
      const people = await Promise.all(
        Array.from({ length: 5 }, () =>
          attempt('cell-phone', PASSWORD, '198.51.100.23', { actingPersonId: PERSON_B }),
        ),
      );
      codes.push(...people.map((r) => r.statusCode));
    }
    expect(codes).toEqual(Array(40).fill(200));
  });

  it('does not let one person spraying many names lock the rest of the plant out', async () => {
    const from = '198.51.100.24';
    for (let i = 0; i < 100; i++) {
      expect((await attempt(`spray-${i}`, 'x', from)).statusCode).toBe(401);
    }
    const ok = await attempt('cell-phone', PASSWORD, from, { actingPersonId: PERSON_B });
    expect(ok.statusCode).toBe(200);
  });

  it('refuses an erased login like any wrong password, in similar time, not with a 500', async () => {
    await admin.query(
      `INSERT INTO login (id, tenant_id, person_id, username, password_hash, role, shared)
       VALUES (gen_random_uuid(), $1, $2, 'erased', '!', 'technician', false)`,
      [B, PERSON_B],
    );
    const erased: number[] = [];
    const wrong: number[] = [];
    for (let i = 0; i < 7; i++) {
      let t = performance.now();
      const res = await attempt('erased', PASSWORD, '198.51.100.25');
      erased.push(performance.now() - t);
      expect(res.statusCode).toBe(401);
      expect(res.json().error.code).toBe('unauthenticated');
      t = performance.now();
      await attempt('cell-phone', 'wrong-password', '198.51.100.25');
      wrong.push(performance.now() - t);
    }
    expect(median(erased)).toBeGreaterThan(median(wrong) * 0.5);
  });

  it('limits guessing the old password when changing a password', async () => {
    const passwordHash = await hash(PASSWORD, {
      algorithm: 2,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });
    await admin.query(
      `INSERT INTO login (id, tenant_id, person_id, username, password_hash, role, shared)
       VALUES (gen_random_uuid(), $1, $2, 'changer', $3, 'technician', false)`,
      [B, PERSON_B, passwordHash],
    );
    const token = (await attempt('changer', PASSWORD, '198.51.100.26')).json().token as string;
    const change = (old: string, from: string) =>
      app.inject({
        method: 'POST',
        url: '/api/v1/auth/password',
        remoteAddress: from,
        headers: {
          host: HOST,
          'content-type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        payload: { old, password: 'a-brand-new-password' },
      });
    const from = '198.51.100.27';
    for (let i = 0; i < 20; i++) expect((await change(`guess-${i}`, from)).statusCode).toBe(401);
    const blocked = await change(PASSWORD, from);
    expect(blocked.statusCode).toBe(429);
    expect(blocked.json().error.code).toBe('rate_limited');
    // Another address is not held back, and a right old password gives its attempt back.
    expect((await change(PASSWORD, '198.51.100.28')).statusCode).toBe(200);
  });
});
