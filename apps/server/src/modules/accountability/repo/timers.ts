import type { Pool, PoolClient } from 'pg';
import type { PgBoss } from 'pg-boss';
import { withTenant } from '@uptimo/db';
import { jobDb } from '../../../kernel/index.js';
import { lockTicket } from '../../tickets/index.js';

export type SlaTimerKind = 'ack' | 'restore' | 'pause';
export type SlaTimerState = 'running' | 'paused' | 'stopped';
export type SlaStopReason =
  'acknowledged' | 'started' | 'machine_running' | 'resumed' | 'closed' | 'cancelled';

export interface SlaTimerProjection {
  kind: SlaTimerKind;
  state: SlaTimerState;
  breached: boolean;
  dueAt: Date | null;
  pausedAt: Date | null;
  stoppedAt: Date | null;
  stopReason: SlaStopReason | null;
}

export interface RearmTicketInput {
  tenantId: string;
  ticketId: string;
  timers: SlaTimerProjection[];
  now: Date;
}

interface TimerRow {
  id: string;
  revision: number;
  fired_at: Date | null;
  due_at: Date | null;
  paused_at: Date | null;
  stopped_at: Date | null;
  stop_reason: string | null;
  state: SlaTimerState;
}

export function singletonKey(tenantId: string, ticketId: string, kind: SlaTimerKind): string {
  return `${tenantId}:${ticketId}:${kind}`;
}

function sameInstant(left: Date | null, right: Date | null): boolean {
  return left?.getTime() === right?.getTime();
}

/** A pause clock that stopped for good and runs again is a new pause: its breach is owed afresh. */
function startsNewPause(row: TimerRow, timer: SlaTimerProjection): boolean {
  return (
    timer.kind === 'pause' &&
    timer.state === 'running' &&
    row.state === 'stopped' &&
    row.stop_reason !== 'cancelled'
  );
}

function changed(row: TimerRow, timer: SlaTimerProjection): boolean {
  return (
    row.state !== timer.state ||
    !sameInstant(row.due_at, timer.dueAt) ||
    !sameInstant(row.paused_at, timer.pausedAt) ||
    !sameInstant(row.stopped_at, timer.stoppedAt) ||
    row.stop_reason !== timer.stopReason
  );
}

async function loadTimer(client: PoolClient, input: RearmTicketInput, kind: SlaTimerKind) {
  const result = await client.query<TimerRow>(
    `SELECT id, revision, fired_at, due_at, paused_at, stopped_at, stop_reason, state
     FROM sla_timer WHERE tenant_id = $1 AND ticket_id = $2 AND kind = $3 FOR UPDATE`,
    [input.tenantId, input.ticketId, kind],
  );
  return result.rows[0];
}

interface ProjectionMerge {
  timerId: string;
  previousRevision: number | null;
  revision: number;
  changed: boolean;
  firedAt: Date | null;
}

async function mergeProjection(
  client: PoolClient,
  input: RearmTicketInput,
  timer: SlaTimerProjection,
): Promise<ProjectionMerge> {
  const existing = await loadTimer(client, input, timer.kind);
  const values = [
    input.tenantId,
    input.ticketId,
    timer.kind,
    timer.dueAt,
    timer.pausedAt,
    timer.stoppedAt,
    timer.stopReason,
    timer.state,
  ];
  if (!existing) {
    const inserted = await client.query<{ id: string }>(
      `INSERT INTO sla_timer
        (tenant_id, ticket_id, kind, due_at, paused_at, stopped_at, stop_reason, state, revision)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,1) RETURNING id`,
      values,
    );
    return {
      timerId: inserted.rows[0]!.id,
      previousRevision: null,
      revision: 1,
      changed: false,
      firedAt: null,
    };
  }
  const hasChanged = changed(existing, timer);
  const revision = hasChanged ? existing.revision + 1 : existing.revision;
  if (hasChanged) {
    await client.query(
      `UPDATE sla_timer SET due_at=$4, paused_at=$5, stopped_at=$6, stop_reason=$7,
         state=$8, revision=$9, updated_at=$10, fired_at = CASE WHEN $12 THEN NULL ELSE fired_at END
       WHERE tenant_id=$1 AND ticket_id=$2 AND kind=$3 AND id=$11`,
      [...values, revision, input.now, existing.id, startsNewPause(existing, timer)],
    );
  }
  return {
    timerId: existing.id,
    previousRevision: existing.revision,
    revision,
    changed: hasChanged,
    firedAt: startsNewPause(existing, timer) ? null : existing.fired_at,
  };
}

async function cancelRevision(
  client: PoolClient,
  boss: PgBoss,
  key: string,
  revision: number,
): Promise<void> {
  const jobs = await boss.findJobs<SlaTimerPayload>('sla.timer', { key, db: jobDb(client) });
  const ids = jobs
    .filter(
      (job) => ['created', 'retry', 'active'].includes(job.state) && job.data.revision === revision,
    )
    .map((job) => job.id);
  if (ids.length > 0) await boss.cancel('sla.timer', ids, { db: jobDb(client) });
}

function queueAction(timer: SlaTimerProjection, firedAt: Date | null): 'arm' | 'due' | 'none' {
  if (firedAt) return 'none';
  if (timer.breached) return timer.stopReason === 'cancelled' ? 'none' : 'due';
  return timer.state === 'running' && timer.dueAt ? 'arm' : 'none';
}

interface QueueRequest {
  input: RearmTicketInput;
  timer: SlaTimerProjection;
  merge: ProjectionMerge;
}

async function queueJob(client: PoolClient, boss: PgBoss, request: QueueRequest): Promise<void> {
  const { input, timer, merge } = request;
  if (!timer.dueAt) throw new Error(`SLA timer ${timer.kind} requires dueAt for queue processing`);
  const payload: SlaTimerPayload = {
    tenantId: input.tenantId,
    ticketId: input.ticketId,
    kind: timer.kind,
    revision: merge.revision,
  };
  const key = singletonKey(input.tenantId, input.ticketId, timer.kind);
  const result = await boss.upsert({
    name: 'sla.timer',
    data: payload,
    options: { singletonKey: key, startAfter: timer.dueAt, db: jobDb(client) },
  });
  if (result.jobs.length !== 1) throw new Error(`Could not atomically arm SLA timer ${timer.kind}`);
  await client.query('UPDATE sla_timer SET job_id=$2, updated_at=$3 WHERE id=$1', [
    merge.timerId,
    result.jobs[0],
    input.now,
  ]);
}

async function rearmOne(
  client: PoolClient,
  boss: PgBoss,
  input: RearmTicketInput,
  timer: SlaTimerProjection,
): Promise<void> {
  const merge = await mergeProjection(client, input, timer);
  const key = singletonKey(input.tenantId, input.ticketId, timer.kind);
  if (merge.changed && merge.previousRevision !== null) {
    await cancelRevision(client, boss, key, merge.previousRevision);
  }
  if (queueAction(timer, merge.firedAt) !== 'none') {
    await queueJob(client, boss, { input, timer, merge });
    return;
  }
  if (!merge.changed) await cancelRevision(client, boss, key, merge.revision);
  await client.query('UPDATE sla_timer SET job_id = NULL, updated_at = $2 WHERE id = $1', [
    merge.timerId,
    input.now,
  ]);
}

export async function rearmTicket(
  client: PoolClient,
  boss: PgBoss,
  input: RearmTicketInput,
): Promise<void> {
  if (!(await lockTicket(client, input.tenantId, input.ticketId))) {
    throw new Error(`Ticket not found for SLA rearm: ${input.tenantId}/${input.ticketId}`);
  }
  if (new Set(input.timers.map((timer) => timer.kind)).size !== input.timers.length) {
    throw new Error('Duplicate SLA timer kind');
  }
  for (const timer of input.timers) await rearmOne(client, boss, input, timer);
}

export interface SlaTimerPayload {
  tenantId: string;
  ticketId: string;
  kind: SlaTimerKind;
  revision: number;
}

export interface SlaTimerRuntime {
  pool: Pool;
  now: () => Date;
  boss?: PgBoss;
}

function assertPayload(payload: SlaTimerPayload): void {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuid.test(payload.tenantId) || !uuid.test(payload.ticketId)) {
    throw new Error('Invalid SLA timer tenant or ticket id');
  }
  if (!['ack', 'restore', 'pause'].includes(payload.kind) || !Number.isInteger(payload.revision)) {
    throw new Error('Invalid SLA timer kind or revision');
  }
}

/** Fire the current revision only; stale, cross-tenant and duplicate work is a successful no-op. */
export async function processSlaTimerJob(
  payload: SlaTimerPayload,
  runtime: SlaTimerRuntime,
): Promise<boolean> {
  assertPayload(payload);
  return withTenant(runtime.pool, payload.tenantId, async (client) => {
    if (!(await lockTicket(client, payload.tenantId, payload.ticketId))) return false;
    const firedAt = runtime.now();
    const result = await client.query(
      `UPDATE sla_timer SET fired_at=$4, updated_at=$4
       WHERE tenant_id=$1 AND ticket_id=$2 AND kind=$3 AND revision=$5
         AND due_at IS NOT NULL AND due_at <= $4 AND fired_at IS NULL
         AND (stop_reason IS NULL OR stop_reason <> 'cancelled')
       RETURNING id`,
      [payload.tenantId, payload.ticketId, payload.kind, firedAt, payload.revision],
    );
    if (result.rowCount === 1) return true;
    const current = await client.query<{
      revision: number;
      due_at: Date | null;
      fired_at: Date | null;
      stop_reason: string | null;
    }>(
      'SELECT revision, due_at, fired_at, stop_reason FROM sla_timer WHERE tenant_id=$1 AND ticket_id=$2 AND kind=$3',
      [payload.tenantId, payload.ticketId, payload.kind],
    );
    const timer = current.rows[0];
    if (
      runtime.boss &&
      timer &&
      timer.revision === payload.revision &&
      timer.due_at &&
      timer.due_at > firedAt &&
      !timer.fired_at &&
      timer.stop_reason !== 'cancelled'
    ) {
      await runtime.boss.upsert({
        name: 'sla.timer',
        data: payload,
        options: {
          singletonKey: singletonKey(payload.tenantId, payload.ticketId, payload.kind),
          startAfter: timer.due_at,
          db: jobDb(client),
        },
      });
    }
    return false;
  });
}

/** Every ticket that has clocks, finished or not: a closed ticket whose clocks never stopped is found here. */
export async function ticketIdsWithTimers(
  client: Pick<PoolClient, 'query'>,
  tenantId: string,
): Promise<string[]> {
  const rows = (
    await client.query('SELECT DISTINCT ticket_id FROM sla_timer WHERE tenant_id = $1', [tenantId])
  ).rows;
  return rows.map((row) => row.ticket_id as string);
}
