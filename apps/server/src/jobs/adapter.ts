import type { PoolClient } from 'pg';
import type { Db } from 'pg-boss';

/** Run pg-boss writes inside the caller's existing tenant transaction. */
export function jobDb(client: PoolClient): Db {
  return { executeSql: (text, values) => client.query(text, values) };
}
