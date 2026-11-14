import type { PoolClient } from 'pg';

type Db = Pick<PoolClient, 'query'>;

/** Whether the person has a roster line for this plant date and shift (any level). */
export async function onRosterLine(
  tx: Db,
  tenantId: string,
  line: { personId: string; date: string; shiftId: string },
): Promise<boolean> {
  const { rowCount } = await tx.query(
    `SELECT 1 FROM roster_entry
      WHERE tenant_id = $1 AND person_id = $2 AND date = $3::date AND shift_id = $4 LIMIT 1`,
    [tenantId, line.personId, line.date, line.shiftId],
  );
  return (rowCount ?? 0) > 0;
}
