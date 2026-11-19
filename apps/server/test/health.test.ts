import { readdirSync } from 'node:fs';
import { Pool } from 'pg';
import type { PgBoss } from 'pg-boss';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../src/app.js';
import { releaseFromEnv, type AppConfig } from '../src/kernel/index.js';
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
      expect(res.json().status).toBe('ok');
    }
  });

  it('keeps the reply contract when the pool answers nothing and no release is set', async () => {
    // The guard test's setup, with the reply check CI turns on: a bare pool and no `release`.
    vi.stubEnv('CHECK_REPLIES', '1');
    const bare = {
      query: async () => ({ rows: [], rowCount: 0 }),
    } as unknown as Pool;
    const checked = await buildApp({
      pool: bare,
      logger: false,
      rateLimitMax: 100000,
      jobBoss: { getQueue: async () => ({}) } as unknown as PgBoss,
    });
    vi.unstubAllEnvs();
    extra.push(checked);
    const res = await checked.inject({ method: 'GET', url: '/api/v1/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      status: 'ok',
      commit: null,
      migrations: { applied: null, expected: null },
    });
  });

  describe('names the release it is running', () => {
    const repoRoot = new URL('../../../', import.meta.url).pathname;
    const files = readdirSync(new URL('packages/db/migrations/', `file://${repoRoot}`))
      .filter((name) => name.endsWith('.sql'))
      .sort();
    const commit = '1d94e963000e073881615253753312465ff2b080';

    async function healthOf(release: AppConfig['release']) {
      const named = await buildApp({ ...config, rateLimitMax: 100000, release });
      extra.push(named);
      return named.inject({ method: 'GET', url: '/api/v1/health' });
    }

    async function ledger(applied: string[]) {
      await db.admin.query('DROP TABLE IF EXISTS schema_migration');
      await db.admin.query(
        'CREATE TABLE schema_migration (filename text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())',
      );
      for (const file of applied)
        await db.admin.query('INSERT INTO schema_migration (filename) VALUES ($1)', [file]);
      // The migration runner creates the ledger before 0001, whose grant on every public table then covers it.
      await db.admin.query('GRANT SELECT ON schema_migration TO app_user');
    }

    it('says which commit runs and that every migration file is applied', async () => {
      await ledger(files);
      const res = await healthOf(releaseFromEnv({ GIT_COMMIT: commit }, repoRoot));
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({
        status: 'ok',
        commit,
        migrations: { applied: files.length, expected: files.length },
      });
      expect(files.length).toBeGreaterThanOrEqual(15);
    });

    it('shows a database that is behind its code, and does not call that down', async () => {
      await ledger(files.slice(0, -1));
      const res = await healthOf(releaseFromEnv({ GIT_COMMIT: commit }, repoRoot));
      expect(res.statusCode).toBe(200);
      expect(res.json().migrations).toEqual({ applied: files.length - 1, expected: files.length });
    });

    it('answers null, not a guess, when the commit or the ledger is unknown', async () => {
      await db.admin.query('DROP TABLE IF EXISTS schema_migration');
      const res = await healthOf(releaseFromEnv({}, repoRoot));
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({
        status: 'ok',
        commit: null,
        migrations: { applied: null, expected: files.length },
      });
      const bare = await healthOf(undefined);
      expect(bare.json()).toEqual({
        status: 'ok',
        commit: null,
        migrations: { applied: null, expected: null },
      });
    });
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
