import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Pool, PoolClient } from 'pg';
import { apiError, listTicketsQuerySchema } from '@uptimo/shared';
import { withTenant } from '@uptimo/db';
import { requireAuth } from './auth.js';
import * as tm from './ticket-mapper.js';
import * as sql from './ticket-sql.js';

interface ListFilters {
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

function encodeCursor(updatedAt: string, id: string): string {
  return Buffer.from(`${updatedAt}|${id}`, 'utf8').toString('base64url');
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function decodeCursor(cursor: string | undefined): { updatedAt: string; id: string } | null {
  if (!cursor) return null;
  const raw = Buffer.from(cursor, 'base64url').toString('utf8');
  const sep = raw.indexOf('|');
  const updatedAt = sep < 0 ? '' : raw.slice(0, sep);
  const id = sep < 0 ? '' : raw.slice(sep + 1);
  if (!updatedAt || !UUID_RE.test(id) || Number.isNaN(Date.parse(updatedAt))) {
    throw new Error('invalid cursor');
  }
  return { updatedAt, id };
}

function csv(raw: string | undefined): string[] | null {
  return raw ? raw.split(',').filter(Boolean) : null;
}

export function projectTicket(row: Record<string, unknown>): Record<string, unknown> {
  const ticket = tm.rowToTicket(row);
  ticket.figures = tm.figuresFromRow(row);
  return tm.ticketProjection(ticket, tm.rowExtras(row));
}

async function queryList(
  client: PoolClient,
  tenantId: string,
  filters: ListFilters,
): Promise<{ items: unknown[]; nextCursor: string | null }> {
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

  const text = `SELECT ${sql.TICKET_COLUMNS}, updated_at::text AS updated_at_cursor FROM ticket WHERE ${where.join(
    ' AND ',
  )} ORDER BY updated_at DESC, id DESC LIMIT ${place(filters.limit + 1)}`;
  const rows = (await client.query(text, params)).rows;

  const page = rows.slice(0, filters.limit);
  const items = page.map((row) => projectTicket(row as Record<string, unknown>));
  let nextCursor: string | null = null;
  if (rows.length > filters.limit) {
    const last = page[page.length - 1] as Record<string, unknown>;
    nextCursor = encodeCursor(last.updated_at_cursor as string, last.id as string);
  }
  return { items, nextCursor };
}

export async function listTickets(
  pool: Pool,
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const ctx = await requireAuth(pool, request, reply);
  if (!ctx) return;
  const parsed = listTicketsQuerySchema.safeParse(request.query ?? {});
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path.join('.');
    reply.code(422).send(apiError('validation', 'Invalid query', field || undefined));
    return;
  }
  const q = parsed.data;

  let cursor: { updatedAt: string; id: string } | null;
  try {
    cursor = decodeCursor(q.cursor);
  } catch {
    reply.code(422).send(apiError('validation', 'Invalid cursor', 'cursor'));
    return;
  }

  const filters: ListFilters = {
    statuses: csv(q.status),
    kinds: csv(q.kind),
    machineId: q.machineId,
    personId: q.personId,
    raisedBy: q.raisedBy,
    from: q.from,
    to: q.to,
    cursor,
    limit: q.limit,
  };
  const result = await withTenant(pool, ctx.tenantId, (client) =>
    queryList(client, ctx.tenantId, filters),
  );
  reply.send(result);
}

/** Closed `no_report` tickets from the last 7 days, scoped to the acting person (or all for management). */
export async function listNeedReport(
  pool: Pool,
  tenantId: string,
  actingPersonId: string | null,
  role: string,
): Promise<unknown[]> {
  return withTenant(pool, tenantId, async (client) => {
    const seesAll = ['supervisor', 'head', 'admin'].includes(role);
    const params: unknown[] = [tenantId];
    let where =
      "tenant_id = $1 AND status = 'closed' AND close_kind = 'no_report' AND closed_at > now() - interval '7 days'";
    if (!seesAll && actingPersonId) {
      params.push(actingPersonId);
      where +=
        ' AND (closed_by_person_id = $2 OR lead_person_id = $2 OR EXISTS (SELECT 1 FROM crew_member cm WHERE cm.ticket_id = ticket.id AND cm.person_id = $2 AND cm.left_at IS NULL))';
    }
    const rows = (
      await client.query(
        `SELECT ${sql.TICKET_COLUMNS} FROM ticket WHERE ${where} ORDER BY closed_at DESC`,
        params,
      )
    ).rows;
    return rows.map((row) => projectTicket(row as Record<string, unknown>));
  });
}
