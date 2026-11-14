import type { Pool, PoolClient } from 'pg';
import type { PgBoss } from 'pg-boss';
import { withTenant } from '@uptimo/db';
import { jobDb } from '../../../kernel/index.js';
import { lockTicket } from '../../tickets/index.js';
import { queueOwedBreach, requeueIfEarly, singletonKey } from './timer-jobs.js';

export { singletonKey };

export type SlaTimerKind = 'ack' | 'restore' | 'pause' | 'handback';
export type SlaTimerState = 'running' | 'paused' | 'stopped';
export type SlaStopReason =
  | 'acknowledged'
  | 'started'
  | 'machine_running'
  | 'resumed'
  | 'confirmed'
  | 'disputed'
  | 'closed'
  | 'cancelled';

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

function sameInstant(left: Date | null, right: Date | null): boolean {
  return left?.getTime() === right?.getTime();
}

/** A pause or sign-off clock that stopped and runs again is a new episode (a resume, a restore, the next close). */
function startsNewEpisode(row: TimerRow, timer: SlaTimerProjection): boolean {
  const repeats = timer.kind === 'pause' || timer.kind === 'handback';
  return repeats && timer.state === 'running' && row.state === 'stopped';
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
  /** The due time of the stopped episode this change is about to overwrite, when its breach was never fired. */
  owedDueAt: Date | null;
}

/**
 * A clock that ran past its due time, stopped, and has not fired yet owes a breach. The row is one per ticket and
 * kind, so the next episode overwrites the due time and the stop it was owed by: the breach is queued as its own job
 * (below) in the transaction that overwrites it, or it is lost.
 */
function owedBreach(row: TimerRow, timer: SlaTimerProjection): Date | null {
  // A sign-off clock never owes one: stopping it is the answer it waited for, and a late answer timed nothing out.
  if (!startsNewEpisode(row, timer) || timer.kind === 'handback') return null;
  if (row.fired_at || row.stop_reason === 'cancelled') return null;
  return row.due_at && row.stopped_at && row.due_at < row.stopped_at ? row.due_at : null;
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
      owedDueAt: null,
    };
  }
  const hasChanged = changed(existing, timer);
  const revision = hasChanged ? existing.revision + 1 : existing.revision;
  if (hasChanged) {
    await client.query(
      `UPDATE sla_timer SET due_at=$4, paused_at=$5, stopped_at=$6, stop_reason=$7,
         state=$8, revision=$9, updated_at=$10, fired_at = CASE WHEN $12 THEN NULL ELSE fired_at END
       WHERE tenant_id=$1 AND ticket_id=$2 AND kind=$3 AND id=$11`,
      [...values, revision, input.now, existing.id, startsNewEpisode(existing, timer)],
    );
  }
  return {
    timerId: existing.id,
    previousRevision: existing.revision,
    revision,
    changed: hasChanged,
    firedAt: startsNewEpisode(existing, timer) ? null : existing.fired_at,
    owedDueAt: owedBreach(existing, timer),
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
  // An answered sign-off timed nothing out, however late the answer came.
  if (timer.kind === 'handback' && timer.state === 'stopped') return 'none';
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
  if (merge.owedDueAt) {
    const owed = { tenantId: input.tenantId, ticketId: input.ticketId, kind: timer.kind };
    await queueOwedBreach(client, boss, {
      ...owed,
      dueAt: merge.owedDueAt,
      now: input.now,
      key: singletonKey(owed.tenantId, owed.ticketId, owed.kind),
    });
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

/** Whether the ticket has a clock of this kind that has not stopped yet. */
export async function hasLiveClock(
  client: Pick<PoolClient, 'query'>,
  tenantId: string,
  ticketId: string,
  kind: SlaTimerKind,
): Promise<boolean> {
  const result = await client.query(
    "SELECT 1 FROM sla_timer WHERE tenant_id = $1 AND ticket_id = $2 AND kind = $3 AND state <> 'stopped'",
    [tenantId, ticketId, kind],
  );
  return result.rowCount === 1;
}

/** What to store when the policy no longer has the limit: stopped, never breached, its job cancelled. */
export function retiredClock(kind: SlaTimerKind, at: Date): SlaTimerProjection {
  return {
    kind,
    state: 'stopped',
    breached: false,
    dueAt: at,
    pausedAt: null,
    stoppedAt: at,
    stopReason: 'cancelled',
  };
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
  /** Set on a breach owed by an earlier episode: that episode's due time, in milliseconds. */
  owedDueAt?: number;
}

/** A clock that ran past its due time and was not answered: what whoever reacts to a breach is told. */
export interface Breach {
  tenantId: string;
  ticketId: string;
  kind: SlaTimerKind;
  firedAt: Date;
  /** The due time of the earlier episode this breach was owed by; null for the clock's current episode. */
  owedDueAt: Date | null;
}

export interface SlaTimerRuntime {
  pool: Pool;
  now: () => Date;
  boss?: PgBoss;
  /**
   * Runs in the same transaction as the breach is recorded: a failure puts the breach back and the job retries.
   * It must be idempotent on (ticket, kind, owedDueAt) for an owed breach and on (ticket, kind, firedAt) for a current
   * one: the queue may deliver a job twice, and the second delivery must change nothing.
   */
  onBreach?: (breach: Breach, client: PoolClient) => Promise<void>;
}

function assertPayload(payload: SlaTimerPayload): void {
  if (payload.owedDueAt !== undefined && !Number.isInteger(payload.owedDueAt)) {
    throw new Error('Invalid SLA timer owed due time');
  }
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuid.test(payload.tenantId) || !uuid.test(payload.ticketId)) {
    throw new Error('Invalid SLA timer tenant or ticket id');
  }
  if (
    !['ack', 'restore', 'pause', 'handback'].includes(payload.kind) ||
    !Number.isInteger(payload.revision)
  ) {
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
    if (payload.owedDueAt !== undefined) {
      const { tenantId, ticketId, kind } = payload;
      await runtime.onBreach?.(
        { tenantId, ticketId, kind, firedAt, owedDueAt: new Date(payload.owedDueAt) },
        client,
      );
      return true;
    }
    const result = await client.query(
      `UPDATE sla_timer SET fired_at=$4, updated_at=$4
       WHERE tenant_id=$1 AND ticket_id=$2 AND kind=$3 AND revision=$5
         AND due_at IS NOT NULL AND due_at <= $4 AND fired_at IS NULL
         AND (stop_reason IS NULL OR stop_reason <> 'cancelled')
       RETURNING id`,
      [payload.tenantId, payload.ticketId, payload.kind, firedAt, payload.revision],
    );
    if (result.rowCount === 1) {
      const { tenantId, ticketId, kind } = payload;
      await runtime.onBreach?.({ tenantId, ticketId, kind, firedAt, owedDueAt: null }, client);
      return true;
    }
    return requeueIfEarly(client, payload, runtime, firedAt);
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
