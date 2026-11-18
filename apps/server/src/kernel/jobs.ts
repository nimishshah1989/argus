import type { Pool, PoolClient } from 'pg';
import type { Db, PgBoss } from 'pg-boss';

export type JobRole = 'all' | 'api' | 'worker';

export interface JobsHandle {
  boss: PgBoss;
  close: () => Promise<void>;
}

/** Run pg-boss writes inside the caller's existing tenant transaction. */
export function jobDb(client: PoolClient): Db {
  return { executeSql: (text, values) => client.query(text, values) };
}

const DAY = 86_400_000;
/** A job whose clock is further than this from the database's refuses to run: a wrong clock would write the wrong day. */
const MAX_CLOCK_SKEW_MS = DAY;

/**
 * Refuses a job clock more than 24 hours from the database's. A test pins the clock by passing `allowFakeClock` and
 * skips this; a real run never does.
 */
export async function assertClockNearDatabase(pool: Pool, name: string, now: Date): Promise<void> {
  const row = (await pool.query('SELECT clock_timestamp() AS t')).rows[0] as { t: Date };
  if (Math.abs(row.t.getTime() - now.getTime()) > MAX_CLOCK_SKEW_MS)
    throw new Error(
      `${name}: the clock (${now.toISOString()}) is more than 24 hours from the database's ` +
        `(${row.t.toISOString()}); nothing was changed`,
    );
}
