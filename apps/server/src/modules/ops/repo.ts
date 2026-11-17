import type { PoolClient } from 'pg';

export interface AuditEntry {
  tenantId: string;
  loginId: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  before: unknown;
  after: unknown;
  /**
   * Pass the caller's `supportGrantId`. When our own staff made the change under a grant (D29) the line names
   * the grant and no login: the login such a caller carries is the admin who approved the grant, not who acted.
   */
  supportGrantId?: string | null;
}

export async function recordAudit(tx: Pick<PoolClient, 'query'>, entry: AuditEntry): Promise<void> {
  const grant = entry.supportGrantId ?? null;
  await tx.query(
    'INSERT INTO audit_log (tenant_id, login_id, platform_access_id, action, entity, entity_id, before, after) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
    [
      entry.tenantId,
      grant ? null : entry.loginId,
      grant,
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

export type SupportCallKind = 'request' | 'refused';

/** One call under a support grant. `route` is the route as registered (`/api/v1/people/:id`), never the address. */
export interface SupportCallEntry {
  tenantId: string;
  grantId: string;
  kind: SupportCallKind;
  method: string;
  route: string;
  ip: string;
}

export interface SupportCallRow {
  id: string;
  at: Date;
  /** `at` to the microsecond, for the page cursor. */
  atKey: string;
  kind: SupportCallKind;
  method: string;
  route: string;
  ip: string | null;
}

const SUPPORT_ACTION: Record<SupportCallKind, string> = {
  request: 'support.request',
  refused: 'support.refused',
};

/** The line that says our own staff made, or were refused, one call. It names the grant and no login. */
export async function recordSupportCall(
  tx: Pick<PoolClient, 'query'>,
  call: SupportCallEntry,
): Promise<void> {
  await tx.query(
    `INSERT INTO audit_log (tenant_id, platform_access_id, action, entity, after, ip)
     VALUES ($1, $2, $3, 'route', $4, $5)`,
    [
      call.tenantId,
      call.grantId,
      SUPPORT_ACTION[call.kind],
      JSON.stringify({ method: call.method, route: call.route }),
      call.ip,
    ],
  );
}

/** The calls under one grant, newest first, after the cursor; one row more than `limit` means a next page. */
export async function supportCalls(
  tx: Pick<PoolClient, 'query'>,
  page: {
    tenantId: string;
    grantId: string;
    limit: number;
    cursor: { at: string; id: string } | null;
  },
): Promise<SupportCallRow[]> {
  const result = await tx.query(
    `SELECT id, at, at::text AS at_key, action, after, ip FROM audit_log
     WHERE tenant_id = $1 AND platform_access_id = $2 AND action = ANY($3::text[])
       AND ($4::timestamptz IS NULL OR (at, id) < ($4::timestamptz, $5::uuid))
     ORDER BY at DESC, id DESC LIMIT $6`,
    [
      page.tenantId,
      page.grantId,
      Object.values(SUPPORT_ACTION),
      page.cursor?.at ?? null,
      page.cursor?.id ?? null,
      page.limit + 1,
    ],
  );
  return result.rows.map((row) => ({
    id: row.id,
    at: row.at,
    atKey: row.at_key,
    kind: row.action === SUPPORT_ACTION.refused ? 'refused' : 'request',
    method: row.after?.method ?? '',
    route: row.after?.route ?? '',
    ip: row.ip,
  }));
}

/** One line of the audit trail as the screen reads it: the actor is only the login, resolved by the caller. */
export interface AuditPageRow {
  id: string;
  at: Date;
  /** `at` to the microsecond, for the page cursor. */
  atKey: string;
  action: string;
  entity: string;
  entityId: string | null;
  loginId: string | null;
  before: unknown;
  after: unknown;
  ip: string | null;
}

export interface AuditPageFilter {
  tenantId: string;
  area?: string;
  /** Rows about this person, or written by one of their logins. */
  personId?: string;
  /** The person's logins, resolved by the caller (this module does not read `login`). */
  loginIds: readonly string[];
  from?: string;
  to?: string;
  /** The plant's own zone, so `from`/`to` are plant days and not UTC days. */
  timeZone: string;
  cursor: { at: string; id: string } | null;
  limit: number;
}

/**
 * The trail newest first, one row more than `limit` so the caller knows there is a next page. Reads only
 * `audit_log` (this module's table); names and the plant's time zone are the caller's.
 */
export async function auditPage(
  tx: Pick<PoolClient, 'query'>,
  filter: AuditPageFilter,
): Promise<AuditPageRow[]> {
  const result = await tx.query(
    `SELECT id, at, at::text AS at_key, action, entity, entity_id, login_id, before, after, ip
     FROM audit_log
     WHERE tenant_id = $1
       AND ($2::text IS NULL OR entity = $2::text)
       AND ($3::uuid IS NULL
            OR (entity = 'person' AND entity_id = $3::uuid)
            OR login_id = ANY($4::uuid[]))
       AND ($5::date IS NULL OR at >= (($5::date)::timestamp AT TIME ZONE $7::text))
       AND ($6::date IS NULL OR at < ((($6::date) + 1)::timestamp AT TIME ZONE $7::text))
       AND ($8::timestamptz IS NULL OR (at, id) < ($8::timestamptz, $9::uuid))
     ORDER BY at DESC, id DESC
     LIMIT $10`,
    [
      filter.tenantId,
      filter.area ?? null,
      filter.personId ?? null,
      filter.loginIds,
      filter.from ?? null,
      filter.to ?? null,
      filter.timeZone,
      filter.cursor?.at ?? null,
      filter.cursor?.id ?? null,
      filter.limit + 1,
    ],
  );
  return result.rows.map((row) => ({
    id: row.id,
    at: row.at,
    atKey: row.at_key,
    action: row.action,
    entity: row.entity,
    entityId: row.entity_id,
    loginId: row.login_id,
    before: row.before,
    after: row.after,
    ip: row.ip,
  }));
}
