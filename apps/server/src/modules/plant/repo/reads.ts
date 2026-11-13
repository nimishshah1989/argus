import type { PoolClient } from 'pg';
import type { Criticality } from '@uptimo/shared';

type Db = Pick<PoolClient, 'query'>;

export interface MachineRow {
  id: string;
  code: string;
  category: string | null;
  cell: string | null;
  criticality: Criticality | null;
}

export async function machinesByIds(
  tx: Db,
  tenantId: string,
  ids: readonly string[],
  lock?: 'share',
): Promise<MachineRow[]> {
  return (
    await tx.query(
      `SELECT id, code, category, cell, criticality FROM machine WHERE tenant_id = $1 AND id = ANY($2::uuid[]) ORDER BY id${lock === 'share' ? ' FOR SHARE' : ''}`,
      [tenantId, ids],
    )
  ).rows;
}

export async function shiftWindows(tx: Db): Promise<Record<string, unknown>[]> {
  return (
    await tx.query(
      'SELECT code, starts_at::text, ends_at::text, crosses_midnight FROM shift ORDER BY code',
    )
  ).rows;
}

export async function setting(tx: Db, tenantId: string, key: string): Promise<unknown> {
  return (
    await tx.query('SELECT value FROM setting WHERE tenant_id = $1 AND key = $2', [tenantId, key])
  ).rows[0]?.value;
}

export async function listItem(
  tx: Db,
  tenantId: string,
  list: string,
  code: string,
): Promise<{ is_vendor: boolean; pauses_sla: boolean } | undefined> {
  return (
    await tx.query(
      'SELECT is_vendor, pauses_sla FROM list_item WHERE tenant_id = $1 AND list = $2 AND code = $3',
      [tenantId, list, code],
    )
  ).rows[0];
}

/** Active values of the given lists, optionally narrowed to one list. */
export async function listItemsOf(
  tx: Db,
  tenantId: string,
  lists: readonly string[],
  only: string | null,
): Promise<Record<string, unknown>[]> {
  return (
    await tx.query(
      `SELECT id, list, code, label, label_gu, label_hi, active, sort FROM list_item
     WHERE tenant_id = $1 AND list = ANY($2::text[]) AND active = true
       AND ($3::text IS NULL OR list = $3)
     ORDER BY array_position($2::text[], list), sort, code`,
      [tenantId, lists, only],
    )
  ).rows;
}

export async function listItemOf(
  tx: Db,
  tenantId: string,
  id: string,
  lists: readonly string[],
): Promise<Record<string, unknown> | undefined> {
  return (
    await tx.query(
      `SELECT id, list, code, label, label_gu, label_hi, active, sort FROM list_item
     WHERE tenant_id = $1 AND id = $2 AND list = ANY($3::text[])`,
      [tenantId, id, lists],
    )
  ).rows[0];
}

export async function listItemsByIds(
  tx: Db,
  tenantId: string,
  ids: readonly string[],
  lists: readonly string[],
): Promise<Record<string, unknown>[]> {
  return (
    await tx.query(
      `SELECT id, list, code, label, label_gu, label_hi, active, sort FROM list_item
     WHERE tenant_id = $1 AND id = ANY($2::uuid[]) ORDER BY array_position($3::text[], list), sort, code`,
      [tenantId, ids, lists],
    )
  ).rows;
}

/** The shift covering `at` in the tenant zone; the later-starting shift owns an overlap. */
export async function shiftCodeAt(
  tx: Db,
  timeZone: string | null,
  at: Date,
): Promise<string | undefined> {
  return (
    await tx.query(
      `WITH local_time AS (SELECT ($2::timestamptz AT TIME ZONE $1)::time AS t)
       SELECT code FROM shift, local_time
       WHERE (NOT crosses_midnight AND t >= starts_at AND t < ends_at)
          OR (crosses_midnight AND (t >= starts_at OR t < ends_at))
       ORDER BY starts_at DESC LIMIT 1`,
      [timeZone, at],
    )
  ).rows[0]?.code;
}
