import type { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { startTestDb, type TestDb } from './harness.js';

const TENANT = '10000000-0000-0000-0000-000000000001';
// What one address may ask of the company-name and logo addresses, and of sign-in, in one minute.
const READ_LIMIT = 300;
const SIGN_IN_LIMIT = 60;

let db: TestDb;
let app: Awaited<ReturnType<typeof buildApp>>;

const visit = (url: string, from: string) =>
  app.inject({ method: 'GET', url, remoteAddress: from, headers: { host: 'cosmos.localhost' } });

async function statuses(url: string, from: string, times: number): Promise<number[]> {
  const out: number[] = [];
  for (let i = 0; i < times; i++) out.push((await visit(url, from)).statusCode);
  return out;
}

beforeAll(async () => {
  db = await startTestDb();
  await (db.admin as Pool).query(
    "INSERT INTO tenant (id, slug, name) VALUES ($1, 'cosmos', 'Cosmos')",
    [TENANT],
  );
  // The default limits, as production runs them: no `rateLimitMax` override.
  app = await buildApp({ pool: db.app, logger: false });
}, 120_000);

afterAll(async () => {
  await app.close();
  await db.stop();
});

describe('the unsigned company-name and logo addresses', () => {
  it('answer one client up to the limit, then 429 for that client only', async () => {
    const first = await statuses('/api/v1/brand', '198.51.100.31', READ_LIMIT);
    expect(new Set(first)).toEqual(new Set([200]));

    const blocked = await visit('/api/v1/brand', '198.51.100.31');
    expect(blocked.statusCode).toBe(429);
    expect(blocked.json().error.code).toBe('rate_limited');
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);

    expect((await visit('/api/v1/brand', '198.51.100.32')).statusCode).toBe(200);
  });

  it('limit the logo address the same way', async () => {
    const first = await statuses('/api/v1/brand/logo', '198.51.100.33', READ_LIMIT);
    expect(first.every((code) => code !== 429)).toBe(true);
    expect((await visit('/api/v1/brand/logo', '198.51.100.33')).statusCode).toBe(429);
    expect((await visit('/api/v1/brand/logo', '198.51.100.34')).statusCode).not.toBe(429);
  });

  it('let a plant of phones behind one address load the page at shift start', async () => {
    const phones = await statuses('/api/v1/brand', '198.51.100.35', 100);
    expect(new Set(phones)).toEqual(new Set([200]));
  });
});

describe('sign-in', () => {
  it('stays at 60 a minute per client', async () => {
    const from = '198.51.100.36';
    const attempt = (name: string) =>
      app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        remoteAddress: from,
        headers: { host: 'cosmos.localhost', 'content-type': 'application/json' },
        payload: { username: name, password: 'wrong-password' },
      });
    for (let i = 0; i < SIGN_IN_LIMIT; i++)
      expect((await attempt(`nobody-${i}`)).statusCode).toBe(401);
    const blocked = await attempt('nobody-last');
    expect(blocked.statusCode).toBe(429);
    expect(blocked.json().error.code).toBe('rate_limited');
  }, 60_000);
});

describe('an explicit rateLimitMax', () => {
  it('raises the company-name cap as well', async () => {
    const lifted = await buildApp({ pool: db.app, logger: false, rateLimitMax: READ_LIMIT + 50 });
    try {
      for (let i = 0; i <= READ_LIMIT; i++) {
        const res = await lifted.inject({
          method: 'GET',
          url: '/api/v1/brand',
          remoteAddress: '198.51.100.37',
          headers: { host: 'cosmos.localhost' },
        });
        expect(res.statusCode).toBe(200);
      }
    } finally {
      await lifted.close();
    }
  }, 60_000);
});
