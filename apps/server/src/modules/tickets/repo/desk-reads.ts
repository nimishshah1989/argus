import type { PoolClient } from 'pg';
import type { DowntimeReport } from '@uptimo/domain';

type Db = Pick<PoolClient, 'query'>;

/** How far back a machine's average downtime looks: one year before the breakdown was reported. */
const AVERAGE_DAYS = 365;

/** A machine's breakdown reports of the year before `before`, this ticket's own report left out. */
export async function machineDowntimeReports(
  client: Db,
  tenantId: string,
  query: { machineId: string; before: Date; ticketId: string },
): Promise<DowntimeReport[]> {
  const result = await client.query(
    `SELECT downtime_min, maint_code FROM breakdown_report
     WHERE tenant_id = $1 AND machine_id = $2 AND ticket_id IS DISTINCT FROM $3
       AND date >= ($4::timestamptz - make_interval(days => $5))::date AND date <= $4::timestamptz::date`,
    [tenantId, query.machineId, query.ticketId, query.before, AVERAGE_DAYS],
  );
  return result.rows.map((row) => ({
    downtimeMin: row.downtime_min as number,
    maintCode: (row.maint_code as string | null) ?? null,
  }));
}

/** Who is on each working or paused ticket now (crew still on it), earliest joiner first. */
export async function liveCrew(
  client: Db,
  tenantId: string,
): Promise<
  { ticketId: string; personId: string; role: 'primary' | 'support'; joinedAt: string }[]
> {
  const result = await client.query(
    `SELECT c.ticket_id, c.person_id, c.role, c.joined_at
     FROM crew_member c JOIN ticket t ON t.tenant_id = c.tenant_id AND t.id = c.ticket_id
     WHERE c.tenant_id = $1 AND c.left_at IS NULL AND t.status IN ('working', 'waiting')
     ORDER BY c.joined_at, c.id`,
    [tenantId],
  );
  return result.rows.map((row) => ({
    ticketId: row.ticket_id as string,
    personId: row.person_id as string,
    role: row.role as 'primary' | 'support',
    joinedAt: (row.joined_at as Date).toISOString(),
  }));
}

/** How many recent codes a close offers first, and how far back it looks for them. */
export const RECENT_CODES = 5;
const RECENT_DAYS = 180;

/**
 * The breakdown categories and maintenance codes this login wrote on its latest reports (the close or the late report
 * it sent), newest first, each once, at most `RECENT_CODES` of each.
 */
export async function recentCodesOfLogin(
  client: Db,
  tenantId: string,
  loginId: string,
): Promise<{ breakdownCategory: string[]; failureComponent: string[] }> {
  const recent = async (column: 'breakdown_category' | 'failure_component') =>
    (
      await client.query(
        `SELECT code FROM (
           SELECT br.${column} AS code, max(br.submitted_at) AS last
           FROM breakdown_report br
           WHERE br.tenant_id = $1 AND br.${column} IS NOT NULL
             AND br.submitted_at >= now() - make_interval(days => $3)
             AND EXISTS (
               SELECT 1 FROM ticket_event e
               WHERE e.tenant_id = br.tenant_id AND e.ticket_id = br.ticket_id
                 AND e.type IN ('close', 'report') AND e.login_id = $2)
           GROUP BY br.${column}) used
         ORDER BY last DESC, code LIMIT $4`,
        [tenantId, loginId, RECENT_DAYS, RECENT_CODES],
      )
    ).rows.map((row) => row.code as string);
  return {
    breakdownCategory: await recent('breakdown_category'),
    failureComponent: await recent('failure_component'),
  };
}
