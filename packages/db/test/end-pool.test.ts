import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Pool } from 'pg';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { endPool } from './end-pool.js';

let container: StartedPostgreSqlContainer;

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:16-alpine').start();
}, 120_000);

afterAll(async () => {
  await container?.stop();
});

/** Opens three connections, closes the pool the given way, and says how many sockets were closed by then. */
async function closedWhenDone(close: (pool: Pool) => Promise<void>) {
  const pool = new Pool({ connectionString: container.getConnectionUri(), max: 3 });
  let opened = 0;
  let closed = 0;
  pool.on('connect', (client) => {
    opened += 1;
    client.on('end', () => (closed += 1));
  });
  await Promise.all([1, 2, 3].map(() => pool.query('SELECT pg_sleep(0.02)')));
  await close(pool);
  return { opened, closed };
}

// The failure this guards against: plain pool.end() resolves before the sockets close, so a container stopped
// right after kills a backend whose client is still ending (57P01, an unhandled error in vitest).
it('plain pool.end() resolves while connections are still open (why endPool exists)', async () => {
  const { opened, closed } = await closedWhenDone((pool) => pool.end());
  expect(opened).toBe(3);
  expect(closed).toBeLessThan(3);
});

it('endPool resolves only after every connection is closed', async () => {
  for (let round = 0; round < 5; round += 1) {
    expect(await closedWhenDone(endPool)).toEqual({ opened: 3, closed: 3 });
  }
});

it('resolves at once for a pool that never connected', async () => {
  const pool = new Pool({ connectionString: container.getConnectionUri() });
  await endPool(pool);
  expect(pool.ended).toBe(true);
});
