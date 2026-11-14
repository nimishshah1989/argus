import type { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { startTestDb, type TestDb } from './harness.js';

const TENANT = '10000000-0000-0000-0000-000000000001';
// What an unsigned visitor may ask of the company-name and logo addresses in one minute.
const LIMIT = 60;

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
  it('answer a client up to the limit, then 429 for that client only', async () => {
    const first = await statuses('/api/v1/brand', '198.51.100.31', LIMIT);
    expect(new Set(first)).toEqual(new Set([200]));

    const blocked = await visit('/api/v1/brand', '198.51.100.31');
    expect(blocked.statusCode).toBe(429);
    expect(blocked.json().error.code).toBe('rate_limited');

    expect((await visit('/api/v1/brand', '198.51.100.32')).statusCode).toBe(200);
  });

  it('limit the logo address the same way', async () => {
    const first = await statuses('/api/v1/brand/logo', '198.51.100.33', LIMIT);
    expect(first.every((code) => code !== 429)).toBe(true);
    expect((await visit('/api/v1/brand/logo', '198.51.100.33')).statusCode).toBe(429);
    expect((await visit('/api/v1/brand/logo', '198.51.100.34')).statusCode).not.toBe(429);
  });
});
