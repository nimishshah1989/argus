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
