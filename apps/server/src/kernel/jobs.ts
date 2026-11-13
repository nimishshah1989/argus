import type { PoolClient } from 'pg';
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
