import type { PoolClient } from 'pg';

type Db = Pick<PoolClient, 'query'>;

/**
 * One list entry, added only when the list has no entry for that code (in any letter case): a row that is
 * already there, switched on or off, is left exactly as it is. True when a row was written.
 */
export async function insertListEntryIfMissing(
  tx: Db,
  tenantId: string,
  row: { list: string; code: string; label: string; active: boolean },
): Promise<boolean> {
  const done = await tx.query(
    `INSERT INTO list_item (tenant_id, list, code, label, active)
     SELECT $1, $2, $3, $4, $5
      WHERE NOT EXISTS (
        SELECT 1 FROM list_item WHERE tenant_id = $1 AND list = $2 AND upper(code) = upper($3))
     ON CONFLICT (tenant_id, list, code) DO NOTHING`,
    [tenantId, row.list, row.code, row.label, row.active],
  );
  return (done.rowCount ?? 0) > 0;
}

/** Switches an existing entry back on (the importer reads active entries only). True when a row was switched on. */
export async function activateListEntry(
  tx: Db,
  tenantId: string,
  row: { list: string; code: string },
): Promise<boolean> {
  const done = await tx.query(
    `UPDATE list_item SET active = true, updated_at = now()
      WHERE tenant_id = $1 AND list = $2 AND upper(code) = upper($3) AND NOT active`,
    [tenantId, row.list, row.code],
  );
  return (done.rowCount ?? 0) > 0;
}
