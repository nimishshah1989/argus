import type { PoolClient } from 'pg';
import type { Criticality } from '@uptimo/shared';

type Db = Pick<PoolClient, 'query'>;

export interface MachineRow {
  id: string;
  code: string;
  category: string | null;
  cell: string | null;
  criticality: Criticality | null;
  status: string;
}

export async function machinesByIds(
  tx: Db,
  tenantId: string,
  ids: readonly string[],
  lock?: 'share',
): Promise<MachineRow[]> {
  return (
    await tx.query(
      `SELECT id, code, category, cell, criticality, status FROM machine WHERE tenant_id = $1 AND id = ANY($2::uuid[]) ORDER BY id${lock === 'share' ? ' FOR SHARE' : ''}`,
      [tenantId, ids],
    )
  ).rows;
}

export async function shiftWindows(tx: Db): Promise<Record<string, unknown>[]> {
  return (
    await tx.query(
      'SELECT code, starts_at::text, ends_at::text, crosses_midnight FROM shift WHERE active ORDER BY code',
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

/** The shift in force at `at` in the tenant zone (switched-off shifts do not count); the later-starting shift owns an overlap. */
export async function shiftCodeAt(
  tx: Db,
  timeZone: string | null,
  at: Date,
): Promise<string | undefined> {
  return (
    await tx.query(
      `WITH local_time AS (SELECT ($2::timestamptz AT TIME ZONE $1)::time AS t)
       SELECT code FROM shift, local_time
       WHERE active AND ((NOT crosses_midnight AND t >= starts_at AND t < ends_at)
          OR (crosses_midnight AND (t >= starts_at OR t < ends_at)))
       ORDER BY starts_at DESC LIMIT 1`,
      [timeZone, at],
    )
  ).rows[0]?.code;
}

export async function activeMachineByCode(
  tx: Db,
  tenantId: string,
  code: string,
): Promise<MachineRow[]> {
  return (
    await tx.query(
      'SELECT id, code, category, cell, criticality FROM machine WHERE tenant_id = $1 AND code = $2 AND status = $3',
      [tenantId, code, 'active'],
    )
  ).rows;
}

export async function activeListItems(
  tx: Db,
  tenantId: string,
  lists: readonly string[],
): Promise<Record<string, unknown>[]> {
  return (
    await tx.query(
      `SELECT list, code, is_vendor, pauses_sla FROM list_item
     WHERE tenant_id = $1 AND active AND list = ANY($2)`,
      [tenantId, lists],
    )
  ).rows;
}

export async function shiftsOf(tx: Db, tenantId: string): Promise<Record<string, unknown>[]> {
  return (
    await tx.query(
      'SELECT code, starts_at, ends_at, crosses_midnight FROM shift WHERE tenant_id = $1',
      [tenantId],
    )
  ).rows;
}

export interface MachineFamily {
  machine: {
    id: string;
    code: string;
    make: string | null;
    model: string | null;
    category: string | null;
  };
  siblings: { id: string; code: string }[]; // same model and make, this machine excluded
}

export async function machineFamily(
  tx: Db,
  tenantId: string,
  machineId: string,
): Promise<MachineFamily | null> {
  const machine = (
    await tx.query(
      'SELECT id, code, make, model, category FROM machine WHERE tenant_id = $1 AND id = $2',
      [tenantId, machineId],
    )
  ).rows[0];
  if (!machine) return null;
  if (!machine.model?.trim()) return { machine, siblings: [] };
  const siblings = (
    await tx.query(
      `SELECT id, code FROM machine
        WHERE tenant_id = $1 AND id <> $2
          AND lower(btrim(model)) = lower(btrim($3))
          AND lower(btrim(COALESCE(make, ''))) = lower(btrim(COALESCE($4, '')))
        ORDER BY code LIMIT 50`,
      [tenantId, machineId, machine.model, machine.make],
    )
  ).rows;
  return { machine, siblings };
}
