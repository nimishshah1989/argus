import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { Pool } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { tolerateShutdown } from './harness.js';

const shutdown = () =>
  Object.assign(new Error('terminating connection due to administrator command'), {
    code: '57P01',
  });

describe('tolerate shutdown', () => {
  it('T13 re-throws 57P01 before shutdown begins', async () => {
    const pool = new Pool();
    tolerateShutdown(pool);
    expect(() => pool.emit('error', shutdown())).toThrow('terminating connection');
    await pool.end();
  });

  it('T14 swallows 57P01 once shutdown has begun', async () => {
    const pool = new Pool();
    const begin = tolerateShutdown(pool);
    begin();
    expect(() => pool.emit('error', shutdown())).not.toThrow();
    await pool.end();
  });

  it('T15 re-throws any other code after shutdown begins', async () => {
    const pool = new Pool();
    const begin = tolerateShutdown(pool);
    begin();
    const other = Object.assign(new Error('connection failure'), { code: '08006' });
    expect(() => pool.emit('error', other)).toThrow('connection failure');
    await pool.end();
  });

  it('T16 a stopped container emits 57P01 and the guarded pool still ends', async () => {
    const container = await new PostgreSqlContainer('postgres:16-alpine').start();
    const url = container.getConnectionUri();
    const observed = new Pool({ connectionString: url, max: 1 });
    const guarded = new Pool({ connectionString: url, max: 1 });
    await observed.query('select 1');
    await guarded.query('select 1');
    const seen = new Promise<Error>((resolve) => observed.once('error', resolve));
    tolerateShutdown(guarded)();

    await container.stop();

    expect(((await seen) as { code?: string }).code).toBe('57P01');
    await vi.waitFor(() => expect(guarded.totalCount).toBe(0));
    expect(guarded.listenerCount('error')).toBe(1);
    await expect(guarded.end()).resolves.toBeUndefined();
    await expect(observed.end()).resolves.toBeUndefined();
  }, 60_000);
});
