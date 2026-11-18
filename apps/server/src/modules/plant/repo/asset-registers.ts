import type { PoolClient } from 'pg';
import type { Store } from './plant-settings.js';
import { ASSET_COLUMNS, insertAssetRow, type AssetKind } from './records.js';

/**
 * The register rows the generated `/settings/registers` screen reads and writes (ticket 51a, R6/R7). It shares the
 * one INSERT and column list with the 46b write seam (`records.ts`); `remove` is what `active: false` does (the row
 * goes, the audit keeps what it held, R7).
 */

type Db = Pick<PoolClient, 'query'>;
type Row = Record<string, unknown>;

/** The one ordering: kind, then the watch day (`due_on` wins over `ends_on`), undated last, then id. */
const ORDER = 'ORDER BY kind, COALESCE(due_on, ends_on) NULLS LAST, id';

/** A resource's camelCase field value as the draft `insertAssetRow` takes it. */
const inputOf = (values: Row) => ({
  kind: values.kind as AssetKind,
  machineId: (values.machine_id as string | null | undefined) ?? null,
  vendor: (values.vendor as string | null | undefined) ?? null,
  reference: (values.reference as string | null | undefined) ?? null,
  startsOn: (values.starts_on as string | null | undefined) ?? null,
  endsOn: (values.ends_on as string | null | undefined) ?? null,
  dueOn: (values.due_on as string | null | undefined) ?? null,
  leadDays: (values.lead_days as number | undefined) ?? 0,
  ownerPersonId: (values.owner_person_id as string | null | undefined) ?? null,
  notes: (values.notes as string | null | undefined) ?? null,
});

export const registerStore: Store = {
  async all(tx) {
    return (await tx.query(`SELECT ${ASSET_COLUMNS} FROM asset_register ${ORDER}`)).rows as Row[];
  },
  async one(tx, id) {
    return (
      await tx.query(`SELECT ${ASSET_COLUMNS} FROM asset_register WHERE id = $1 FOR UPDATE`, [id])
    ).rows[0] as Row | undefined;
  },
  async insert(tx, tenantId, values) {
    return insertAssetRow(tx, tenantId, inputOf(values));
  },
  async update(tx, id, values) {
    const sets = Object.keys(values).map((column, index) => `${column} = $${index + 2}`);
    return (
      await tx.query(
        `UPDATE asset_register SET ${[...sets, 'updated_at = now()'].join(', ')}
          WHERE id = $1 RETURNING ${ASSET_COLUMNS}`,
        [id, ...Object.values(values)],
      )
    ).rows[0] as Row;
  },
  async remove(tx: Db, id: string) {
    await tx.query('DELETE FROM asset_register WHERE id = $1', [id]);
  },
};
