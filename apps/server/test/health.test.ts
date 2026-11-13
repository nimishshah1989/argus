import { Pool } from 'pg';
import type { PgBoss } from 'pg-boss';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import type { AppConfig } from '../src/kernel/index.js';
import { startTestDb, type TestDb } from './harness.js';

let db: TestDb;
let config: AppConfig;
let app: Awaited<ReturnType<typeof buildApp>>;
const extra: Array<Awaited<ReturnType<typeof buildApp>>> = [];

beforeAll(async () => {
  db = await startTestDb();
  config = { pool: db.app, logger: false, rateLimitMax: 1 };
  app = await buildApp(config);
}, 120_000);

afterAll(async () => {
  for (const a of [app, ...extra]) await a.close();
  await db.stop();
});

describe('health', () => {
  it('health answers 200 when the database and queue are up', async () => {
    await app.inject({ method: 'GET', url: '/api/v1/brand' });
    for (let i = 0; i < 3; i++) {
      const res = await app.inject({ method: 'GET', url: '/api/v1/health' });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ status: 'ok' });
    }
  });

  it('health answers 503 when the database is down', async () => {
    const dead = new Pool({ connectionString: db.app.options.connectionString });
    await dead.end();
    const down = await buildApp({
      pool: dead,
      logger: false,
      rateLimitMax: 100000,
      jobBoss: config.jobBoss,
    });
    extra.push(down);
    const res = await down.inject({ method: 'GET', url: '/api/v1/health' });
    expect(res.statusCode).toBe(503);
    expect(res.json()).toEqual({ status: 'down', db: false, queue: true });
  });

  it('health answers 503 when the queue is down', async () => {
    const broken = await buildApp({
      pool: db.app,
      logger: false,
      rateLimitMax: 100000,
      jobBoss: { getQueue: () => Promise.reject(new Error('queue gone')) } as unknown as PgBoss,
    });
    extra.push(broken);
    const res = await broken.inject({ method: 'GET', url: '/api/v1/health' });
    expect(res.statusCode).toBe(503);
    expect(res.json()).toEqual({ status: 'down', db: true, queue: false });
    expect(res.body).not.toContain('queue gone');
  });
});
