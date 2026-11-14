import type { PoolClient, QueryResult } from 'pg';
import { seesAllNeedReport, type Role } from '@uptimo/domain';
import { TICKET_COLUMNS } from './ticket.js';

type Db = Pick<PoolClient, 'query'>;
type Rows = QueryResult['rows'];

export interface ListFilters {
  statuses: string[] | null;
  kinds: string[] | null;
  machineId?: string;
  personId?: string;
  raisedBy?: string;
  from?: string;
  to?: string;
  cursor: { updatedAt: string; id: string } | null;
  limit: number;
}

export async function selectTicketPage(
  tx: Db,
  tenantId: string,
  filters: ListFilters,
): Promise<Rows> {
  const where = ['tenant_id = $1'];
  const params: unknown[] = [tenantId];
  let n = 1;
  const place = (value: unknown): string => {
    n += 1;
    params.push(value);
    return `$${n}`;
  };

  if (filters.statuses) where.push(`status = ANY(${place(filters.statuses)})`);
  if (filters.kinds) where.push(`kind = ANY(${place(filters.kinds)})`);
  if (filters.machineId) where.push(`machine_id = ${place(filters.machineId)}`);
  if (filters.personId) {
    const ph = place(filters.personId);
    where.push(
      `(lead_person_id = ${ph} OR EXISTS (SELECT 1 FROM crew_member cm WHERE cm.ticket_id = ticket.id AND cm.person_id = ${ph} AND cm.left_at IS NULL))`,
    );
  }
  if (filters.raisedBy) where.push(`reported_by_person_id = ${place(filters.raisedBy)}`);
  if (filters.from) where.push(`reported_at >= ${place(filters.from)}::timestamptz`);
  if (filters.to) where.push(`reported_at < ${place(filters.to)}::timestamptz`);
  if (filters.cursor) {
    where.push(
      `(updated_at, id) < (${place(filters.cursor.updatedAt)}::timestamptz, ${place(filters.cursor.id)}::uuid)`,
    );
  }

  const text = `SELECT ${TICKET_COLUMNS}, updated_at::text AS updated_at_cursor FROM ticket WHERE ${where.join(
    ' AND ',
  )} ORDER BY updated_at DESC, id DESC LIMIT ${place(filters.limit + 1)}`;
  return (await tx.query(text, params)).rows;
}

export async function segmentRowsFor(tx: Db, tenantId: string, ticketIds: string[]): Promise<Rows> {
  return (
    await tx.query(
      'SELECT ticket_id, person_id, role, started_at, ended_at FROM work_segment WHERE tenant_id = $1 AND ticket_id = ANY($2::uuid[])',
      [tenantId, ticketIds],
    )
  ).rows;
}

/** Closed `no_report` tickets from the last 7 days, scoped to the acting person (or all for management). */
export async function needReportRows(
  tx: Db,
  tenantId: string,
  actingPersonId: string | null,
  role: string,
): Promise<Rows> {
  const seesAll = seesAllNeedReport({ role: role as Role });
  const params: unknown[] = [tenantId];
  let where =
    "tenant_id = $1 AND status = 'closed' AND close_kind = 'no_report' AND closed_at > now() - interval '7 days'";
  if (!seesAll && actingPersonId) {
    params.push(actingPersonId);
    where +=
      ' AND (closed_by_person_id = $2 OR lead_person_id = $2 OR EXISTS (SELECT 1 FROM crew_member cm WHERE cm.ticket_id = ticket.id AND cm.person_id = $2 AND cm.left_at IS NULL))';
  }
  return (
    await tx.query(
      `SELECT ${TICKET_COLUMNS} FROM ticket WHERE ${where} ORDER BY closed_at DESC`,
      params,
    )
  ).rows;
}

export async function ticketRowById(
  tx: Db,
  tenantId: string,
  ticketId: string,
): Promise<Rows[number]> {
  return (
    await tx.query(`SELECT ${TICKET_COLUMNS} FROM ticket WHERE id = $1 AND tenant_id = $2`, [
      ticketId,
      tenantId,
    ])
  ).rows[0];
}

export async function openTicketRows(tx: Db, tenantId: string): Promise<Rows> {
  return (
    await tx.query(
      `SELECT ${TICKET_COLUMNS} FROM ticket WHERE tenant_id = $1 AND status IN ('open', 'working', 'waiting') ORDER BY reported_at DESC`,
      [tenantId],
    )
  ).rows;
}

/** An open stopped/support ticket already on the machine, if any. */
export async function openDuplicateId(
  tx: Db,
  tenantId: string,
  machineId: string,
): Promise<string | undefined> {
  const row = (
    await tx.query(
      "SELECT id FROM ticket WHERE tenant_id = $1 AND machine_id = $2 AND kind <> 'general' AND status NOT IN ('closed', 'cancelled') LIMIT 1",
      [tenantId, machineId],
    )
  ).rows[0];
  return row?.id;
}

/** Any ticket still active on the machine, whatever its kind: a machine with one cannot be switched off. */
export async function activeTicketId(
  tx: Db,
  tenantId: string,
  machineId: string,
): Promise<string | undefined> {
  const row = (
    await tx.query(
      "SELECT id FROM ticket WHERE tenant_id = $1 AND machine_id = $2 AND status NOT IN ('closed', 'cancelled') LIMIT 1",
      [tenantId, machineId],
    )
  ).rows[0];
  return row?.id;
}
