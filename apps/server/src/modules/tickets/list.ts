import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Pool, PoolClient } from 'pg';
import { apiError, listTicketsQuerySchema } from '@uptimo/shared';
import * as domain from '@uptimo/domain';
import { withTenant } from '@uptimo/db';
import { withTicketParts, type TicketActor } from '../../kernel/index.js';
import { requireAuth } from '../identity/index.js';
import { toldByEscalationStep } from '../notifications/index.js';
import * as tm from './mapper.js';
import * as sql from './repo/ticket.js';
import * as report from './repo/report.js';
import { lockoutOf } from './lockout.js';
import {
  needReportRows,
  openTicketRows,
  segmentRowsFor,
  selectTicketPage,
  ticketRowById,
  type ListFilters,
} from './repo/list.js';

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

/** Imported and backfilled tickets keep Bhavin's stored minutes; they are never recomputed from their events. */
const KEEPS_STORED_FIGURES = new Set(['import', 'backfill']);

function csv(raw: string | undefined): string[] | null {
  return raw ? raw.split(',').filter(Boolean) : null;
}

export function projectTicket(
  row: Record<string, unknown>,
  perPerson?: Record<string, number>,
): Record<string, unknown> {
  const ticket = tm.rowToTicket(row);
  const figures = tm.figuresFromRow(row);
  if (perPerson) figures.perPerson = perPerson;
  ticket.figures = figures;
  return tm.ticketProjection(ticket, tm.rowExtras(row));
}

async function loadPerPerson(
  client: PoolClient,
  tenantId: string,
  ticketIds: string[],
  now: Date,
): Promise<Record<string, Record<string, number>>> {
  if (ticketIds.length === 0) return {};
  const rows = await segmentRowsFor(client, tenantId, ticketIds);
  const byTicket: Record<string, domain.WorkSegment[]> = {};
  for (const row of rows) {
    const id = row.ticket_id as string;
    (byTicket[id] ??= []).push({
      personId: row.person_id as string,
      role: row.role as domain.WorkSegment['role'],
      startedAt: new Date(row.started_at as string | number | Date),
      ...(row.ended_at ? { endedAt: new Date(row.ended_at as string | number | Date) } : {}),
    });
  }
  const result: Record<string, Record<string, number>> = {};
  for (const [id, segments] of Object.entries(byTicket)) {
    result[id] = domain.personMinutes(segments, now);
  }
  return result;
}

async function queryList(
  client: PoolClient,
  tenantId: string,
  filters: ListFilters,
  actor: TicketActor,
): Promise<{ items: unknown[]; nextCursor: string | null }> {
  const rows = await selectTicketPage(client, tenantId, filters);

  const page = rows.slice(0, filters.limit);
  const perPerson = await loadPerPerson(
    client,
    tenantId,
    page.map((row) => row.id as string),
    new Date(),
  );
  const items = await withTicketParts(client, { tenantId, actor }, page, (row) =>
    projectTicket(row, perPerson[row.id as string]),
  );
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
    queryList(client, ctx.tenantId, filters, ctx),
  );
  reply.send(result);
}

/**
 * What `/state` carries: the open tickets, and the closed `no_report` ones from the last 7 days (the acting person's
 * own, or all for management). Both go through the reply parts in one pass, so the parts' reads (the roster, for
 * one) happen once for the whole reply.
 */
export async function loadState(
  pool: Pool,
  tenantId: string,
  actor: TicketActor,
): Promise<{ open: unknown[]; needReport: unknown[] }> {
  return withTenant(pool, tenantId, async (client) => {
    const openRows = await openTicketRows(client, tenantId);
    const reportRows = await needReportRows(client, tenantId, actor.personId, actor.role);
    const rows = [...openRows, ...reportRows];
    const all = await withTicketParts(client, { tenantId, actor }, rows, (row) =>
      projectTicket(row),
    );
    return { open: all.slice(0, openRows.length), needReport: all.slice(openRows.length) };
  });
}

/** Stored minutes for imported tickets, a fresh computation for the rest. */
function detailFigures(
  row: Record<string, unknown>,
  ticket: domain.Ticket,
  events: Awaited<ReturnType<typeof sql.loadEvents>>,
  segments: domain.WorkSegment[],
): domain.Figures {
  const now = new Date();
  if (KEEPS_STORED_FIGURES.has(row.raised_channel as string)) {
    return { ...tm.figuresFromRow(row), perPerson: domain.personMinutes(segments, now) };
  }
  return tm.recomputeFigures(ticket, events, segments, {
    overrides: (row.overrides as Record<string, unknown>) ?? {},
    now,
  });
}

/**
 * An escalation step as the history shows it. Who was told comes from the notifications that point at the event;
 * once those are purged (90 days) a step that did tell people reads `null`, not an empty list that looks like nobody.
 */
function escalationStep(
  event: { id?: string; payload: Record<string, unknown> },
  told: Map<string, string[]>,
): object | null {
  const step = event.payload.escalation as { toldCount?: number } | undefined;
  if (!step) return null;
  const people = told.get(event.id ?? '');
  return { ...step, toldPersonIds: people ?? ((step.toldCount ?? 0) > 0 ? null : []) };
}

export async function detail(
  pool: Pool,
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const ctx = await requireAuth(pool, request, reply);
  if (!ctx) return;
  const ticketId = (request.params as { id: string }).id;
  const payload = await withTenant(pool, ctx.tenantId, async (client) => {
    const row = await ticketRowById(client, ctx.tenantId, ticketId);
    if (!row) return null;
    const ticket = tm.rowToTicket(row as Record<string, unknown>);
    const events = await sql.loadEvents(client, ticketId);
    const segments = await sql.loadSegments(client, ticketId);
    const crew = await sql.loadCrew(client, ticketId);
    ticket.figures = detailFigures(row as Record<string, unknown>, ticket, events, segments);
    const told = await toldByEscalationStep(client, ctx.tenantId, ticketId);
    const projected = (
      await withTicketParts(client, { tenantId: ctx.tenantId, actor: ctx }, [row], () =>
        tm.ticketProjection(ticket, tm.rowExtras(row as Record<string, unknown>)),
      )
    )[0];
    return {
      ticket: { ...projected, lockout: await lockoutOf(client, ctx, ticketId) },
      events: events.map((event) => ({
        seq: event.seq,
        type: event.type,
        at: event.at,
        text: event.text,
        reason: event.reason ?? null,
        isVendor: event.isVendor ?? false,
        changes: (event as { changes?: unknown[] }).changes ?? null,
        escalation: escalationStep(event, told),
        actingPersonId: event.actingPersonId,
        loginId: event.loginId,
      })),
      people: crew.map((member: domain.CrewMember) => ({
        personId: member.personId,
        role: member.role,
        leftAt: member.leftAt ?? null,
        leftReason: member.leftReason ?? null,
      })),
      tasks: [],
      intervals: segments.map((segment: domain.WorkSegment) => ({
        personId: segment.personId,
        role: segment.role,
        startedAt: segment.startedAt,
        endedAt: segment.endedAt ?? null,
      })),
      report: await report.loadReport(client, ticketId),
    };
  });
  if (!payload) reply.code(404).send(apiError('not_found', 'Unknown ticket'));
  else reply.send(payload);
}
