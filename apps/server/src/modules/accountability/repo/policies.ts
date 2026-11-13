import type { PoolClient } from 'pg';
import type { SlaPolicy } from '@uptimo/domain';
import type { SlaPolicy as SlaPolicyReply } from '@uptimo/shared';

type Db = Pick<PoolClient, 'query'>;

export async function tenantPolicies(tx: Db, tenantId: string): Promise<SlaPolicy[]> {
  return (
    await tx.query<SlaPolicy>(
      'SELECT id, severity, ack_minutes AS "ackMinutes", restore_minutes AS "restoreMinutes", business_hours_only AS "businessHoursOnly" FROM sla_policy WHERE tenant_id = $1',
      [tenantId],
    )
  ).rows;
}

export async function currentPolicies(tx: Db): Promise<Record<string, unknown>[]> {
  return (
    await tx.query(
      'SELECT severity, ack_minutes, restore_minutes, business_hours_only FROM sla_policy ORDER BY severity',
    )
  ).rows;
}

export async function upsertPolicy(
  tx: Db,
  tenantId: string,
  policy: {
    severity: string;
    ackMinutes: number;
    restoreMinutes: number;
    businessHoursOnly: boolean;
  },
): Promise<void> {
  await tx.query(
    `INSERT INTO sla_policy (tenant_id, severity, ack_minutes, restore_minutes, business_hours_only)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (tenant_id, severity) DO UPDATE SET
         ack_minutes = EXCLUDED.ack_minutes,
         restore_minutes = EXCLUDED.restore_minutes,
         business_hours_only = EXCLUDED.business_hours_only,
         updated_at = now()`,
    [tenantId, policy.severity, policy.ackMinutes, policy.restoreMinutes, policy.businessHoursOnly],
  );
}

function slaPolicyDto(row: Record<string, unknown>): SlaPolicyReply {
  return {
    id: row.id as string,
    severity: row.severity as SlaPolicyReply['severity'],
    ackMinutes: row.ack_minutes as number,
    restoreMinutes: row.restore_minutes as number,
    businessHoursOnly: row.business_hours_only as boolean,
  };
}

export async function loadSlaPolicies(client: Db): Promise<SlaPolicyReply[]> {
  const rows = await client.query(
    'SELECT id, severity, ack_minutes, restore_minutes, business_hours_only FROM sla_policy ORDER BY severity',
  );
  return rows.rows.map(slaPolicyDto);
}
