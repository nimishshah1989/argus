import type { PoolClient } from 'pg';
import { LIST_NAMES } from '@uptimo/shared';

type Db = Pick<PoolClient, 'query'>;
type Row = Record<string, unknown>;

/** Every machine of the plant, switched off or scrapped ones too (history names them), with its segment's code. */
export async function machinesForEngine(tx: Db): Promise<Row[]> {
  return (
    await tx.query(
      `SELECT m.id, m.code, s.code AS segment, m.category, m.cell, m.location, m.make, m.model, m.controller,
              m.year, m.purchased_on::text AS purchased_on, m.power_kw::float8 AS power_kw,
              m.capacity_kva::float8 AS capacity_kva, m.asset_code, m.status, m.criticality, m.metadata
         FROM machine m LEFT JOIN segment s ON s.id = m.segment_id
        ORDER BY m.code, m.id`,
    )
  ).rows;
}

export async function movesForEngine(tx: Db): Promise<Row[]> {
  return (
    await tx.query(
      `SELECT id, machine_id, from_cell, to_cell, effective_from::text AS effective_from
         FROM machine_move ORDER BY effective_from, id`,
    )
  ).rows;
}

/** The plant's lists, off entries included, so a report that names a code since switched off still resolves. */
export async function listsForEngine(tx: Db): Promise<Row[]> {
  return (
    await tx.query(
      'SELECT list, code, label, active FROM list_item WHERE list = ANY($1) ORDER BY list, sort, code',
      [LIST_NAMES],
    )
  ).rows;
}

/**
 * The one row holding a plant's value for a setting key, made from `defaults` when the plant never set it.
 * A second call changes nothing.
 */
export async function ensureSettingRow(
  tx: Db,
  tenantId: string,
  key: string,
  defaults: Record<string, unknown>,
): Promise<void> {
  await tx.query(
    'INSERT INTO setting (tenant_id, key, value) VALUES ($1, $2, $3) ON CONFLICT (tenant_id, key) DO NOTHING',
    [tenantId, key, JSON.stringify(defaults)],
  );
}
