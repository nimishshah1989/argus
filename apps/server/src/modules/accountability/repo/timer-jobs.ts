import type { PoolClient } from 'pg';
import type { PgBoss } from 'pg-boss';
import { jobDb } from '../../../kernel/index.js';
import type { SlaTimerKind, SlaTimerPayload, SlaTimerRuntime } from './timers.js';

export function singletonKey(tenantId: string, ticketId: string, kind: SlaTimerKind): string {
  return `${tenantId}:${ticketId}:${kind}`;
}

export interface OwedBreach {
  tenantId: string;
  ticketId: string;
  kind: SlaTimerKind;
  /** The due time of the earlier episode whose breach is owed. */
  dueAt: Date;
  now: Date;
  /** The clock's own job key; the owed job gets a key of its own beside it. */
  key: string;
}

/** Its own job, under its own key, so the next episode's arming and cancelling never touch it. */
export async function queueOwedBreach(
  client: PoolClient,
  boss: PgBoss,
  owed: OwedBreach,
): Promise<void> {
  const payload: SlaTimerPayload = {
    tenantId: owed.tenantId,
    ticketId: owed.ticketId,
    kind: owed.kind,
    revision: 1,
    owedDueAt: owed.dueAt.getTime(),
  };
  const result = await boss.upsert({
    name: 'sla.timer',
    data: payload,
    options: {
      singletonKey: `${owed.key}:owed:${owed.dueAt.getTime()}`,
      startAfter: owed.now,
      db: jobDb(client),
    },
  });
  if (result.jobs.length !== 1) throw new Error(`Could not queue the owed breach of ${owed.kind}`);
}

/** A wake before the due time (a clock moved later) queues the same revision again for the new time. */
export async function requeueIfEarly(
  client: PoolClient,
  payload: SlaTimerPayload,
  runtime: SlaTimerRuntime,
  firedAt: Date,
): Promise<false> {
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
}
