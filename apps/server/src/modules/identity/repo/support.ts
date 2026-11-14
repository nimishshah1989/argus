import type { PoolClient } from 'pg';

type Db = Pick<PoolClient, 'query'>;

/**
 * Support access (`platform_access`, D27). Every statement names the customer as well as relying on row
 * security, and "live" is always the database's clock against `expires_at`.
 */
export interface GrantRow {
  id: string;
  platform_user: string;
  reason: string;
  created_at: Date;
  expires_at: Date;
  /** null only on a grant from before approval was required. */
  approved_by_login_id: string | null;
  approved_by: string | null;
  /** Approved and not yet run out or ended. */
  live: boolean;
}

const GRANT = `g.id, g.platform_user, g.reason, g.created_at, g.expires_at, g.approved_by_login_id,
  l.username AS approved_by, (g.approved_by_login_id IS NOT NULL AND g.expires_at > now()) AS live`;
const FROM_GRANT = `FROM platform_access g
  LEFT JOIN login l ON l.tenant_id = g.tenant_id AND l.id = g.approved_by_login_id`;

export async function grantById(tx: Db, tenantId: string, id: string): Promise<GrantRow | null> {
  const result = await tx.query(
    `SELECT ${GRANT} ${FROM_GRANT} WHERE g.tenant_id = $1 AND g.id = $2`,
    [tenantId, id],
  );
  return (result.rows[0] as GrantRow | undefined) ?? null;
}

export async function listGrants(tx: Db, tenantId: string): Promise<GrantRow[]> {
  const result = await tx.query(
    `SELECT ${GRANT} ${FROM_GRANT} WHERE g.tenant_id = $1 ORDER BY g.created_at DESC, g.id DESC`,
    [tenantId],
  );
  return result.rows as GrantRow[];
}

/**
 * The approving admin creates the grant, so a grant never exists unapproved. The database sets the start to its
 * own clock, refuses more than 7 days, and refuses an approver who is not an active admin of this customer.
 */
export async function insertGrant(
  tx: Db,
  grant: {
    tenantId: string;
    platformUser: string;
    reason: string;
    days: number;
    approver: { loginId: string; username: string };
  },
): Promise<{ id: string; created_at: Date; expires_at: Date }> {
  const result = await tx.query(
    `INSERT INTO platform_access
       (tenant_id, platform_user, reason, granted_by, approved_by_login_id, expires_at)
     VALUES ($1, $2, $3, $4, $5, now() + make_interval(days => $6))
     RETURNING id, created_at, expires_at`,
    [
      grant.tenantId,
      grant.platformUser,
      grant.reason,
      grant.approver.username,
      grant.approver.loginId,
      grant.days,
    ],
  );
  return result.rows[0];
}

/** Ends a live grant now (a grant is never deleted, only shortened). Null when there is no live grant to end. */
export async function endGrant(tx: Db, tenantId: string, id: string): Promise<Date | null> {
  const result = await tx.query(
    `UPDATE platform_access SET expires_at = now(), updated_at = now()
     WHERE tenant_id = $1 AND id = $2 AND approved_by_login_id IS NOT NULL AND expires_at > now()
     RETURNING expires_at`,
    [tenantId, id],
  );
  return (result.rows[0]?.expires_at as Date | undefined) ?? null;
}
