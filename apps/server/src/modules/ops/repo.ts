import type { PoolClient } from 'pg';

export interface AuditEntry {
  tenantId: string;
  loginId: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  before: unknown;
  after: unknown;
}

export async function recordAudit(tx: Pick<PoolClient, 'query'>, entry: AuditEntry): Promise<void> {
  await tx.query(
    'INSERT INTO audit_log (tenant_id, login_id, action, entity, entity_id, before, after) VALUES ($1, $2, $3, $4, $5, $6, $7)',
    [
      entry.tenantId,
      entry.loginId,
      entry.action,
      entry.entity,
      entry.entityId ?? null,
      JSON.stringify(entry.before),
      JSON.stringify(entry.after),
    ],
  );
}

export async function countAuditRows(
  tx: Pick<PoolClient, 'query'>,
  tenantId: string,
): Promise<number> {
  const result = await tx.query('SELECT count(*)::int AS n FROM audit_log WHERE tenant_id = $1', [
    tenantId,
  ]);
  return result.rows[0].n as number;
}
