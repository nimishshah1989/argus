import type { PoolClient } from 'pg';
import type { SlaPolicy } from '@uptimo/domain';
import type { SlaPolicy as SlaPolicyReply } from '@uptimo/shared';

type Db = Pick<PoolClient, 'query'>;

export async function tenantPolicies(tx: Db, tenantId: string): Promise<SlaPolicy[]> {
  return (
    await tx.query<SlaPolicy>(
      `SELECT id, severity, ack_minutes AS "ackMinutes", restore_minutes AS "restoreMinutes",
        pause_max_minutes AS "pauseMaxMinutes", handback_minutes AS "handbackMinutes",
        business_hours_only AS "businessHoursOnly"
       FROM sla_policy WHERE tenant_id = $1`,
      [tenantId],
    )
  ).rows;
}

/** Whether the plant has switched its clocks on (any policy row): escalation follows the clocks, never runs without them. */
export async function plantHasPolicies(tx: Db): Promise<boolean> {
  return ((await tx.query('SELECT 1 FROM sla_policy LIMIT 1')).rowCount ?? 0) > 0;
}

export async function currentPolicies(tx: Db): Promise<Record<string, unknown>[]> {
  return (
    await tx.query(
      'SELECT severity, ack_minutes, restore_minutes, pause_max_minutes, handback_minutes, business_hours_only FROM sla_policy ORDER BY severity',
    )
  ).rows;
}

/** One policy as saved. A limit left out keeps the stored value; `null` clears it. */
export type PolicyInput = Omit<SlaPolicyReply, 'id'>;

export async function upsertPolicy(tx: Db, tenantId: string, policy: PolicyInput): Promise<void> {
  await tx.query(
    `INSERT INTO sla_policy
       (tenant_id, severity, ack_minutes, restore_minutes, pause_max_minutes, handback_minutes, business_hours_only)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (tenant_id, severity) DO UPDATE SET
         ack_minutes = EXCLUDED.ack_minutes,
         restore_minutes = EXCLUDED.restore_minutes,
         pause_max_minutes = CASE WHEN $8 THEN EXCLUDED.pause_max_minutes ELSE sla_policy.pause_max_minutes END,
         handback_minutes = CASE WHEN $9 THEN EXCLUDED.handback_minutes ELSE sla_policy.handback_minutes END,
         business_hours_only = EXCLUDED.business_hours_only,
         updated_at = now()`,
    [
      tenantId,
      policy.severity,
      policy.ackMinutes,
      policy.restoreMinutes,
      policy.pauseMaxMinutes ?? null,
      policy.handbackMinutes ?? null,
      policy.businessHoursOnly,
      policy.pauseMaxMinutes !== undefined,
      policy.handbackMinutes !== undefined,
    ],
  );
}

function slaPolicyDto(row: Record<string, unknown>): SlaPolicyReply {
  return {
    id: row.id as string,
    severity: row.severity as SlaPolicyReply['severity'],
    ackMinutes: row.ack_minutes as number,
    restoreMinutes: row.restore_minutes as number,
    pauseMaxMinutes: row.pause_max_minutes as number | null,
    handbackMinutes: row.handback_minutes as number | null,
    businessHoursOnly: row.business_hours_only as boolean,
  };
}

export async function loadSlaPolicies(client: Db): Promise<SlaPolicyReply[]> {
  const rows = await client.query(
    'SELECT id, severity, ack_minutes, restore_minutes, pause_max_minutes, handback_minutes, business_hours_only FROM sla_policy ORDER BY severity',
  );
  return rows.rows.map(slaPolicyDto);
}
