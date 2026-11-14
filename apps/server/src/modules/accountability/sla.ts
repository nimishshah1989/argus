import type { PgBoss } from 'pg-boss';
import type { PoolClient } from 'pg';
import {
  projectHandbackTimer,
  projectPauseTimer,
  projectSlaTimers,
  type BusinessCalendar,
  type SlaProjectionInput,
  type SlaPolicy,
  type TicketEvent,
  type SlaTimerProjection as DomainTimer,
} from '@uptimo/domain';
import type { SlaProjection, SlaTimer } from '@uptimo/shared';
import { tenantInfo } from '../identity/index.js';
import { shiftWindows } from '../plant/index.js';
import {
  hasLiveClock,
  rearmTicket,
  retiredClock,
  type SlaTimerKind,
  type SlaTimerProjection,
} from './repo/timers.js';
import { tenantPolicies } from './repo/policies.js';
import {
  loadEvents,
  lockTicket,
  reviveCorrection,
  slaCandidateIds,
  slaTicketRows,
  ticketEventRows,
  type SlaTicketRow as TicketRow,
} from '../tickets/index.js';

export interface SlaContext {
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
  const timeZone = (await tenantInfo(client, tenantId)).time_zone;
  const shifts = await shiftWindows(client);
  return {
    timeZone,
    windows: shifts.map((shift) => ({
      code: shift.code as string,
      startMinute: minutes(shift.starts_at as string),
      endMinute: minutes(shift.ends_at as string),
      crossesMidnight: shift.crosses_midnight as boolean,
    })),
  };
}

async function loadEventsByTicket(
  client: PoolClient,
  ticketIds: string[],
): Promise<Map<string, SlaContext['events']>> {
  const events = await ticketEventRows(client, ticketIds);
  const eventsByTicket = new Map<string, SlaContext['events']>();
  for (const row of events) {
    const payload = (row.payload ?? {}) as Record<string, unknown>;
    const event = {
      type: row.type,
      at: new Date(row.at),
      reason: (payload.reason as string | undefined) ?? (row.text as string | undefined),
      isVendor: payload.isVendor as boolean | undefined,
      pausesSla: payload.pausesSla as boolean | undefined,
      status: payload.previousStatus as TicketEvent['status'],
      handbackRequested: payload.handbackRequested === true,
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

/** The policy of a plant that has not set its clocks up: nothing to time, so the sign-off has no limit either. */
function unlimited(severity: SlaPolicy['severity']): SlaPolicy {
  return {
    id: 'none',
    severity,
    ackMinutes: 1,
    restoreMinutes: 1,
    handbackMinutes: null,
    businessHoursOnly: false,
  };
}

/** `withoutPolicy`: keep tickets whose severity has no policy (they get no clocks, only facts read from events). */
export async function loadContexts(
  client: PoolClient,
  tenantId: string,
  ticketIds: string[],
  withoutPolicy = false,
): Promise<Map<string, SlaContext>> {
  const contexts = new Map<string, SlaContext>();
  if (ticketIds.length === 0) return contexts;
  const tickets = await slaTicketRows(client, tenantId, ticketIds);
  if (tickets.length === 0) return contexts;
  const policies = await tenantPolicies(client, tenantId);
  const bySeverity = new Map(policies.map((policy) => [policy.severity, policy]));
  const needsCalendar = policies.some((policy) => policy.businessHoursOnly);
  const calendar = needsCalendar ? await loadCalendar(client, tenantId) : undefined;
  const eventsByTicket = await loadEventsByTicket(client, ticketIds);
  for (const row of tickets) {
    if (row.raised_channel === 'backfill') continue;
    const policy = bySeverity.get(row.severity) ?? (withoutPolicy ? unlimited(row.severity) : null);
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

export function effectiveNow(context: SlaContext, now: Date): Date {
  return new Date(Math.max(now.getTime(), ...context.events.map((event) => event.at.getTime())));
}

function toDto(projection: DomainTimer): SlaTimer {
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

export function slaInput(context: SlaContext, now: Date): SlaProjectionInput {
  return {
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
  };
}

/**
 * Every clock the ticket has: acknowledge and restore always, pause once it has been paused under a limit, sign-off
 * once production was asked under a limit. (Only the first three go to `sla` in a reply; the sign-off clock shows in
 * the `handback` part.)
 */
function projectClocks(context: SlaContext, now: Date): DomainTimer[] {
  const input = slaInput(context, now);
  const { ack, restore } = projectSlaTimers(input);
  return [ack, restore, projectPauseTimer(input), projectHandbackTimer(input)].filter(
    (clock): clock is DomainTimer => clock !== null,
  );
}

function toProjection(clocks: DomainTimer[]): SlaProjection {
  const named = new Map(
    clocks.map((clock) => [clock.id.slice(clock.id.lastIndexOf(':') + 1), clock]),
  );
  const pause = named.get('pause');
  return {
    ack: toDto(named.get('ack')!),
    restore: toDto(named.get('restore')!),
    ...(pause ? { pause: toDto(pause) } : {}),
  };
}

export async function projectTicketSla(
  client: PoolClient,
  tenantId: string,
  ticketId: string,
  now: Date,
): Promise<SlaProjection | null> {
  const context = (await loadContexts(client, tenantId, [ticketId])).get(ticketId);
  return context ? toProjection(projectClocks(context, now)) : null;
}

export async function loadSlaProjections(
  client: PoolClient,
  tenantId: string,
  ticketIds: string[],
  now: Date,
): Promise<Map<string, SlaProjection | null>> {
  const contexts = await loadContexts(client, tenantId, ticketIds);
  return new Map(
    ticketIds.map((id) => {
      const context = contexts.get(id);
      return [id, context ? toProjection(projectClocks(context, now)) : null];
    }),
  );
}

export async function reconcileTicket(
  client: PoolClient,
  input: { tenantId: string; ticketId: string; now: Date; boss?: PgBoss },
): Promise<void> {
  const { tenantId, ticketId, now, boss } = input;
  if (!(await lockTicket(client, tenantId, ticketId))) return;
  const context = (await loadContexts(client, tenantId, [ticketId])).get(ticketId);
  if (!context || !boss) return;
  const projectionNow = effectiveNow(context, now);
  const timers: SlaTimerProjection[] = projectClocks(context, now).map((clock) => ({
    kind: clock.id.slice(clock.id.lastIndexOf(':') + 1) as SlaTimerKind,
    state: clock.state,
    breached: clock.breached,
    dueAt: clock.dueAt,
    pausedAt: clock.pausedAt,
    stoppedAt: clock.stoppedAt,
    stopReason: clock.stopReason,
  }));
  // The policy lost a limit (or the ticket moved to a policy without): a running clock of that kind must stop.
  for (const kind of ['pause', 'handback'] as const) {
    if (timers.some((timer) => timer.kind === kind)) continue;
    if (await hasLiveClock(client, tenantId, ticketId, kind)) {
      timers.push(retiredClock(kind, projectionNow));
    }
  }
  await rearmTicket(client, boss, { tenantId, ticketId, timers, now: projectionNow });
}

export async function reconcileSlaPolicies(
  client: PoolClient,
  tenantId: string,
  boss?: PgBoss,
): Promise<void> {
  const now = new Date();
  for (const ticketId of await slaCandidateIds(client, tenantId)) {
    await reconcileTicket(client, { tenantId, ticketId, now, boss });
  }
}
