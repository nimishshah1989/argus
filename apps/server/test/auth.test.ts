import { readFileSync } from 'node:fs';
import { hash } from '@node-rs/argon2';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';

type App = Awaited<ReturnType<typeof buildApp>>;
type InjectResponse = Awaited<ReturnType<App['inject']>>;
import { hashToken } from '../src/session.js';

const A = '10000000-0000-0000-0000-000000000001';
const B = '20000000-0000-0000-0000-000000000001';
const PERSON_A = '10000000-0000-0000-0000-000000000002';
const PERSON_B = '20000000-0000-0000-0000-000000000002';
const LOGIN_A = '10000000-0000-0000-0000-000000000003';
const LOGIN_B = '20000000-0000-0000-0000-000000000003';
const PASSWORD = 'correct-horse-battery';

let container: StartedPostgreSqlContainer;
let pool: Pool;
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
  container = await new PostgreSqlContainer('postgres:16-alpine').start();
  pool = new Pool({ connectionString: container.getConnectionUri(), max: 1 });
  await pool.query(
    readFileSync(
      new URL('../../../packages/db/migrations/0001_schema_v1.sql', import.meta.url),
      'utf8',
    ),
  );
  const passwordHash = await hash(PASSWORD, {
    algorithm: 2, // Argon2id
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
  await pool.query(
    "INSERT INTO tenant (id, slug, name) VALUES ($1, 'cosmos', 'Cosmos'), ($2, 'plant-two', 'Plant Two')",
    [A, B],
  );
  await pool.query(
    "INSERT INTO person (id, tenant_id, name, team, title) VALUES ($1, $3, 'Asha', 'maintenance', 'Technician'), ($2, $4, 'Bina', 'maintenance', 'Technician')",
    [PERSON_A, PERSON_B, A, B],
  );
  await pool.query(
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
  app = await buildApp({ pool, logger: false, rateLimitMax: 100000 });
}, 120_000);

afterAll(async () => {
  await app.close();
  await pool.end();
  await container.stop();
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

  it('requires and records the acting person on a shared phone', async () => {
    const missing = await post('/api/v1/auth/login', 'plant-two.localhost', {
      username: 'cell-phone',
      password: PASSWORD,
    });
    expect(missing.statusCode).toBe(422);
    expect(missing.json().error.field).toBe('actingPersonId');
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

  it('slides the session forward on use', async () => {
    const login = await post('/api/v1/auth/login', 'cosmos.localhost', {
      username: 'asha',
      password: 'new-password-123',
    });
    const token = login.json().token as string;
    const before = (
      await pool.query('SELECT expires_at FROM session WHERE token_hash = $1', [hashToken(token)])
    ).rows[0].expires_at as Date;
    await get('/api/v1/auth/me', 'cosmos.localhost', token);
    await get('/api/v1/auth/me', 'cosmos.localhost', token);
    const after = (
      await pool.query('SELECT expires_at FROM session WHERE token_hash = $1', [hashToken(token)])
    ).rows[0].expires_at as Date;
    expect(after.getTime()).toBeGreaterThan(before.getTime());
  });

  it('trusts the token, not the host, after login', async () => {
    const login = await post('/api/v1/auth/login', 'cosmos.localhost', {
      username: 'asha',
      password: 'new-password-123',
    });
    const token = login.json().token as string;
    const me = await get('/api/v1/auth/me', 'plant-two.localhost', token);
    expect(me.statusCode).toBe(200);
    expect(me.json().user.username).toBe('asha');
  });
});
