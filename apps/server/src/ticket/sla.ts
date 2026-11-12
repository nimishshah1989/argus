import type { PgBoss } from 'pg-boss';
import type { PoolClient } from 'pg';
import { projectSlaTimers, type BusinessCalendar, type SlaPolicy } from '@uptimo/domain';
import type { SlaProjection, SlaTimer } from '@uptimo/shared';
import { rearmTicket } from '../jobs/sla-timer.js';
import { loadEvents, reviveCorrection } from '../ticket-sql.js';

interface TicketRow {
  id: string;
  kind: 'stopped' | 'support' | 'general';
  severity: SlaPolicy['severity'];
  status: 'open' | 'working' | 'waiting' | 'closed' | 'cancelled';
  reported_at: Date;
  closed_at: Date | null;
  raised_channel: string;
}

interface SlaContext {
  row: TicketRow;
  events: Awaited<ReturnType<typeof loadEvents>>;
  policy: SlaPolicy;
  calendar?: BusinessCalendar;
}

function minutes(value: string): number {
  const [hours = 0, minutes = 0] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

async function loadCalendar(client: PoolClient, tenantId: string): Promise<BusinessCalendar> {
  const timeZone = (await client.query('SELECT time_zone FROM tenant_info($1)', [tenantId])).rows[0]
    .time_zone as string;
  const shifts = await client.query(
    'SELECT code, starts_at::text, ends_at::text, crosses_midnight FROM shift ORDER BY code',
  );
  return {
    timeZone,
    windows: shifts.rows.map((shift) => ({
      code: shift.code,
      startMinute: minutes(shift.starts_at),
      endMinute: minutes(shift.ends_at),
      crossesMidnight: shift.crosses_midnight,
    })),
  };
}

async function loadEventsByTicket(
  client: PoolClient,
  ticketIds: string[],
): Promise<Map<string, SlaContext['events']>> {
  const events = await client.query(
    `SELECT ticket_id, seq, type, at, login_id, acting_person_id, text, payload
     FROM ticket_event WHERE ticket_id = ANY($1::uuid[]) ORDER BY ticket_id, seq`,
    [ticketIds],
  );
  const eventsByTicket = new Map<string, SlaContext['events']>();
  for (const row of events.rows) {
    const payload = (row.payload ?? {}) as Record<string, unknown>;
    const event = {
      type: row.type,
      at: new Date(row.at),
      reason: (payload.reason as string | undefined) ?? (row.text as string | undefined),
      isVendor: payload.isVendor as boolean | undefined,
      pausesSla: payload.pausesSla as boolean | undefined,
      changes: Array.isArray(payload.changes) ? payload.changes.map(reviveCorrection) : undefined,
      seq: row.seq,
      loginId: row.login_id,
      actingPersonId: row.acting_person_id,
      text: row.text,
      payload,
    };
    const list = eventsByTicket.get(row.ticket_id) ?? [];
    list.push(event);
    eventsByTicket.set(row.ticket_id, list);
  }
  return eventsByTicket;
}

async function loadContexts(
  client: PoolClient,
  tenantId: string,
  ticketIds: string[],
): Promise<Map<string, SlaContext>> {
  const contexts = new Map<string, SlaContext>();
  if (ticketIds.length === 0) return contexts;
  const tickets = await client.query<TicketRow>(
    `SELECT id, kind, severity, status, reported_at, closed_at, raised_channel
     FROM ticket WHERE tenant_id = $1 AND id = ANY($2::uuid[])`,
    [tenantId, ticketIds],
  );
  if (tickets.rows.length === 0) return contexts;
  const policies = await client.query<SlaPolicy>(
    'SELECT id, severity, ack_minutes AS "ackMinutes", restore_minutes AS "restoreMinutes", business_hours_only AS "businessHoursOnly" FROM sla_policy WHERE tenant_id = $1',
    [tenantId],
  );
  const bySeverity = new Map(policies.rows.map((policy) => [policy.severity, policy]));
  const needsCalendar = policies.rows.some((policy) => policy.businessHoursOnly);
  const calendar = needsCalendar ? await loadCalendar(client, tenantId) : undefined;
  const eventsByTicket = await loadEventsByTicket(client, ticketIds);
  for (const row of tickets.rows) {
    if (row.raised_channel === 'backfill') continue;
    const policy = bySeverity.get(row.severity);
    if (!policy) continue;
    contexts.set(row.id, {
      row,
      events: eventsByTicket.get(row.id) ?? [],
      policy,
      ...(calendar ? { calendar } : {}),
    });
  }
  return contexts;
}

function effectiveNow(context: SlaContext, now: Date): Date {
  return new Date(Math.max(now.getTime(), ...context.events.map((event) => event.at.getTime())));
}

function toDto(
  projection: ReturnType<typeof projectSlaTimers>[keyof ReturnType<typeof projectSlaTimers>],
): SlaTimer {
  return {
    id: projection.id,
    state: projection.state,
    breached: projection.breached,
    dueAt: projection.dueAt?.toISOString() ?? null,
    pausedAt: projection.pausedAt?.toISOString() ?? null,
    stoppedAt: projection.stoppedAt?.toISOString() ?? null,
    remainingMinutes: projection.remainingMinutes,
  };
}

export async function projectTicketSla(
  client: PoolClient,
  tenantId: string,
  ticketId: string,
  now: Date,
): Promise<SlaProjection | null> {
  const contexts = await loadContexts(client, tenantId, [ticketId]);
  const context = contexts.get(ticketId);
  if (!context) return null;
  const timers = projectSlaTimers({
    ticket: {
      id: context.row.id,
      kind: context.row.kind,
      severity: context.row.severity,
      status: context.row.status,
      reportedAt: context.row.reported_at,
      closedAt: context.row.closed_at,
    },
    events: context.events,
    policy: context.policy,
    calendar: context.calendar,
    now: effectiveNow(context, now),
  });
  return { ack: toDto(timers.ack), restore: toDto(timers.restore) };
}

export async function loadSlaProjections(
  client: PoolClient,
  tenantId: string,
  ticketIds: string[],
  now: Date,
): Promise<Map<string, SlaProjection | null>> {
  const contexts = await loadContexts(client, tenantId, ticketIds);
  const projections = new Map<string, SlaProjection | null>();
  for (const id of ticketIds) {
    const context = contexts.get(id);
    if (!context) {
      projections.set(id, null);
      continue;
    }
    const timers = projectSlaTimers({
      ticket: {
        id: context.row.id,
        kind: context.row.kind,
        severity: context.row.severity,
        status: context.row.status,
        reportedAt: context.row.reported_at,
        closedAt: context.row.closed_at,
      },
      events: context.events,
      policy: context.policy,
      calendar: context.calendar,
      now: effectiveNow(context, now),
    });
    projections.set(id, { ack: toDto(timers.ack), restore: toDto(timers.restore) });
  }
  return projections;
}

export async function reconcileTicket(
  client: PoolClient,
  input: { tenantId: string; ticketId: string; now: Date; boss?: PgBoss },
): Promise<string | null> {
  const { tenantId, ticketId, now, boss } = input;
  const locked = await client.query(
    'SELECT id FROM ticket WHERE tenant_id=$1 AND id=$2 FOR UPDATE',
    [tenantId, ticketId],
  );
  if (locked.rowCount !== 1) return null;
  const context = (await loadContexts(client, tenantId, [ticketId])).get(ticketId);
  if (!context) return null;
  const projectionNow = effectiveNow(context, now);
  const projected = projectSlaTimers({
    ticket: {
      id: context.row.id,
      kind: context.row.kind,
      severity: context.row.severity,
      status: context.row.status,
      reportedAt: context.row.reported_at,
      closedAt: context.row.closed_at,
    },
    events: context.events,
    policy: context.policy,
    calendar: context.calendar,
    now: projectionNow,
  });
  if (boss) {
    await rearmTicket(client, boss, {
      tenantId,
      ticketId,
      timers: Object.values(projected).map((timer) => ({
        kind: timer.id.endsWith(':ack') ? 'ack' : 'restore',
        state: timer.state,
        breached: timer.breached,
        dueAt: timer.dueAt,
        pausedAt: timer.pausedAt,
        stoppedAt: timer.stoppedAt,
        stopReason: timer.stopReason,
      })),
      now: projectionNow,
    });
  }
  await client.query('UPDATE ticket SET sla_policy_id = $3 WHERE id = $1 AND tenant_id = $2', [
    ticketId,
    tenantId,
    context.policy.id,
  ]);
  return context.policy.id;
}

export async function reconcileSlaPolicies(
  client: PoolClient,
  tenantId: string,
  boss?: PgBoss,
): Promise<void> {
  const now = new Date();
  const candidates = await client.query(
    "SELECT id FROM ticket WHERE tenant_id = $1 AND raised_channel <> 'backfill' ORDER BY id",
    [tenantId],
  );
  for (const row of candidates.rows) {
    await reconcileTicket(client, { tenantId, ticketId: row.id, now, boss });
  }
}
