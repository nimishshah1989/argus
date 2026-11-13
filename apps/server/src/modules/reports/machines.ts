import type { PoolClient } from 'pg';
import { machinesByIds } from '../plant/index.js';

type Row = Record<string, unknown>;

/** Adds the machine's current code, category and cell to ticket rows (plant owns `machine`). */
export async function withMachines(
  tx: Pick<PoolClient, 'query'>,
  tenantId: string,
  rows: Row[],
): Promise<Row[]> {
  const ids = [
    ...new Set(rows.map((row) => row.machine_id).filter((id) => typeof id === 'string')),
  ];
  const byId = new Map(
    (ids.length > 0 ? await machinesByIds(tx, tenantId, ids) : []).map((m) => [m.id, m]),
  );
  return rows.map((row) => {
    const m = byId.get(row.machine_id as string);
    return {
      ...row,
      machine_code: m?.code ?? null,
      machine_category: m?.category ?? null,
      machine_cell: m?.cell ?? null,
    };
  });
}
