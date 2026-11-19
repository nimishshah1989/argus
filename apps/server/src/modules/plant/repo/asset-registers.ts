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

/**
 * The plant's register rows as the engine reads them (51c, R12): the note carries the AMC type, the legal
 * name/form and the not-renewing flag back, and `ends_on`/`due_on` are the stored days the reminder and the
 * sheets print. Every column the engine needs, tenant-scoped like every other store read.
 */
export async function assetRegistersForEngine(tx: Db, tenantId: string): Promise<Row[]> {
  return (
    await tx.query(
      `SELECT id, kind, machine_id, vendor, reference, starts_on::text AS starts_on,
              ends_on::text AS ends_on, due_on::text AS due_on, lead_days, notes
         FROM asset_register WHERE tenant_id = $1 ${ORDER}`,
      [tenantId],
    )
  ).rows as Row[];
}

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

/** One row whose notice window is open: the job tells its owner (R8–R10). */
export interface DueRegisterItem {
  id: string;
  ownerPersonId: string;
  /** `due_on ?? ends_on`, the day the notice names; `YYYY-MM-DD` in the plant's calendar. */
  watchOn: string;
  leadDays: number;
}

/**
 * The plant's rows due a notice on `today`, the rule behind the `register.due` job (R8, R11): an owner, a watch date
 * (`due_on ?? ends_on`, never `starts_on`), and a window that opened inclusive at `watchOn − lead_days`. There is no
 * upper bound, so an overdue row still answers; the caller's dedupe key makes it one message per item per date.
 */
export async function dueRegisterItems(
  tx: Db,
  tenantId: string,
  today: string,
): Promise<DueRegisterItem[]> {
  return (
    await tx.query(
      `SELECT id, owner_person_id AS "ownerPersonId", COALESCE(due_on, ends_on)::text AS "watchOn",
              lead_days AS "leadDays"
         FROM asset_register
        WHERE tenant_id = $1 AND owner_person_id IS NOT NULL
          AND COALESCE(due_on, ends_on) IS NOT NULL
          AND COALESCE(due_on, ends_on) - lead_days <= $2::date
        ORDER BY COALESCE(due_on, ends_on), id`,
      [tenantId, today],
    )
  ).rows as DueRegisterItem[];
}
