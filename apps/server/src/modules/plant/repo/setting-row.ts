import type { PoolClient } from 'pg';
import type { Row, Store } from './plant-settings.js';

type Db = Pick<PoolClient, 'query'>;

/**
 * A resource whose one row is a plant setting's JSON object (the analytics profile): the generated screen lists
 * that row and edits its fields. A field the stored object lacks reads as its default, so adding a field later
 * needs no data change. The row's id is the `setting` row's own id.
 */
export function settingRowStore(key: string, defaults: Record<string, unknown>): Store {
  const merged = (row: Row | undefined): Row | undefined =>
    row && { id: row.id, ...defaults, ...(row.value as Row) };
  return {
    all: async (tx: Db) =>
      (await tx.query('SELECT id, value FROM setting WHERE key = $1', [key])).rows.map((row) =>
        merged(row)!,
      ),
    one: async (tx: Db, id: string) =>
      merged(
        (
          await tx.query('SELECT id, value FROM setting WHERE id = $1 AND key = $2 FOR UPDATE', [
            id,
            key,
          ])
        ).rows[0],
      ),
    insert: () => Promise.reject(new Error(`${key} is one row; it is created by its first read`)),
    update: async (tx: Db, id: string, values: Record<string, unknown>) =>
      merged(
        (
          await tx.query(
            `UPDATE setting SET value = value || $2::jsonb, updated_at = now()
              WHERE id = $1 RETURNING id, value`,
            [id, JSON.stringify(values)],
          )
        ).rows[0],
      )!,
  };
}
