import type { PoolClient } from 'pg';

type Db = Pick<PoolClient, 'query'>;

/** Lock every ticket of a machine; rows carry what severity needs. */
export async function machineTicketsForUpdate(
  tx: Db,
  tenantId: string,
  machineId: string,
): Promise<{ id: string; kind: 'stopped' | 'support' | 'general'; urgent: boolean | null }[]> {
  const tickets = await tx.query(
    'SELECT id, kind, urgent FROM ticket WHERE tenant_id = $1 AND machine_id = $2 ORDER BY id FOR UPDATE',
    [tenantId, machineId],
  );
  return tickets.rows;
}

export async function setSeverities(
  tx: Db,
  input: { ids: string[]; severities: string[]; tenantId: string },
): Promise<void> {
  await tx.query(
    `UPDATE ticket AS t SET severity = v.severity
         FROM UNNEST($1::uuid[], $2::text[]) AS v(id, severity)
         WHERE t.id = v.id AND t.tenant_id = $3`,
    [input.ids, input.severities, input.tenantId],
  );
}
