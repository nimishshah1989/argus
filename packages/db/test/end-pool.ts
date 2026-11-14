import type { Pool } from 'pg';

/**
 * Ends a pool and waits until every connection's socket is closed. `pool.end()` alone resolves as soon as the
 * pool has forgotten its clients, before their sockets close (pg-pool 3.x `_pulseQueue`); stopping the
 * container in that gap kills the backend, and the still-ending client raises an unhandled
 * `57P01 terminating connection due to administrator command`.
 */
export async function endPool(pool: Pool): Promise<void> {
  const open = pool.totalCount;
  let closed = 0;
  const allClosed = new Promise<void>((resolve) => {
    if (open === 0) resolve();
    pool.on('remove', () => {
      closed += 1;
      if (closed === open) resolve();
    });
  });
  await pool.end();
  await allClosed;
}
