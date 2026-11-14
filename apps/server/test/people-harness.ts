import { randomUUID } from 'node:crypto';
import { hash } from '@node-rs/argon2';
import { expect } from 'vitest';
import { buildApp } from '../src/app.js';
import { startTestDb, type TestDb } from './harness.js';

/** Two customers, an admin in each, and one personal login per other role in the first. Invented data only. */
export const A = '10000000-0000-4000-8000-0000000000a1';
export const B = '10000000-0000-4000-8000-0000000000b1';
export const PASSWORD = 'correct-horse-battery';
export const ROLES = ['operator', 'technician', 'supervisor', 'head', 'plant_head', 'board'];

type App = Awaited<ReturnType<typeof buildApp>>;
export type Res = Awaited<ReturnType<App['inject']>>;

type Call = (
  method: 'GET' | 'POST' | 'PATCH',
  url: string,
  token?: string,
  payload?: object,
) => Promise<Res>;

export interface PeopleApp {
  db: TestDb;
  app: App;
  /** A request to the first customer's host (`cosmos.localhost`), as production picks a customer by host. */
  call: Call;
  /** The same, to the second customer's host (`plant-two.localhost`). */
  callB: Call;
  signIn: (username: string, host?: string, password?: string) => Promise<string>;
  stop: () => Promise<void>;
}

async function seed(db: TestDb, passwordHash: string): Promise<void> {
  await db.admin.query(
    "INSERT INTO tenant (id, slug, name) VALUES ($1, 'cosmos', 'Cosmos'), ($2, 'plant-two', 'Plant Two')",
    [A, B],
  );
  const people: [string, string, string][] = [
    [A, 'Asha Admin', 'admin'],
    [B, 'Bina Admin', 'b-admin'],
    ...ROLES.map((role): [string, string, string] => [A, `Pat ${role}`, role]),
  ];
  for (const [tenant, name, username] of people) {
    const person = (
      await db.admin.query(
        "INSERT INTO person (tenant_id, name, team, title) VALUES ($1, $2, 'maintenance', 'Staff') RETURNING id",
        [tenant, name],
      )
    ).rows[0].id as string;
    const role = username === 'b-admin' ? 'admin' : username;
    await db.admin.query(
      'INSERT INTO login (tenant_id, person_id, username, password_hash, role, shared) VALUES ($1, $2, $3, $4, $5, false)',
      [tenant, person, username, passwordHash, role],
    );
  }
}

export async function startPeopleApp(): Promise<PeopleApp> {
  const db = await startTestDb();
  const passwordHash = await hash(PASSWORD, {
    algorithm: 2,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
  await seed(db, passwordHash);
  const app = await buildApp({ pool: db.app, logger: false, rateLimitMax: 100000 });
  const on =
    (host: string): Call =>
    (method, url, token, payload) =>
      app.inject({
        method,
        url,
        headers: {
          host,
          'content-type': 'application/json',
          'idempotency-key': randomUUID(),
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        ...(payload ? { payload } : {}),
      });
  const call = on('cosmos.localhost');
  const callB = on('plant-two.localhost');
  const signIn: PeopleApp['signIn'] = async (username, host, password = PASSWORD) => {
    const send = host === 'plant-two.localhost' ? callB : call;
    const res = await send('POST', '/api/v1/auth/login', undefined, { username, password });
    expect(res.statusCode, `sign in as ${username}`).toBe(200);
    return res.json().token as string;
  };
  return {
    db,
    app,
    call,
    callB,
    signIn,
    stop: async () => {
      await app.close();
      await db.stop();
    },
  };
}

/** A transaction that holds a lock until `release()`, so a request can be made to wait at a known point. */
export async function holdLock(db: TestDb, sql: string, params: unknown[] = []) {
  const client = await db.admin.connect();
  await client.query('BEGIN');
  await client.query(sql, params);
  return {
    query: (text: string, values?: unknown[]) => client.query(text, values),
    release: async () => {
      await client.query('COMMIT');
      client.release();
    },
  };
}

/** The key the people routes take per customer (one writer at a time). */
export const PEOPLE_LOCK = 'SELECT pg_advisory_xact_lock(hashtext($1))';
export const peopleLockKey = (tenantId: string): string => `people:${tenantId}`;

/** Waits until some request is blocked on a lock. */
export async function waitUntilBlocked(db: TestDb): Promise<void> {
  for (let i = 0; i < 100; i += 1) {
    const { rows } = await db.admin.query(
      "SELECT 1 FROM pg_stat_activity WHERE wait_event_type = 'Lock' AND datname = current_database()",
    );
    if (rows.length > 0) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error('no request was waiting on a lock');
}
