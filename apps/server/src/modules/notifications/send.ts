import type { Pool, PoolClient } from 'pg';
import type { PgBoss } from 'pg-boss';
import { withTenant } from '../../kernel/index.js';
import { isPushEndpoint } from './endpoint.js';
import { pushPayload } from './kinds.js';
import { queueSend } from './notify.js';
import { sendPush, type PushResult } from './push.js';
import {
  deleteSubscription,
  lockDueNotification,
  recordOutcome,
  subscriptionsOfPerson,
  type DueNotification,
  type Outcome,
} from './repo.js';

/** Five tries in all, then the row is dead and the admin can see it. */
export const MAX_ATTEMPTS = 5;
const FIRST_WAIT_MS = 60_000;
const GROWTH = 4;

/** Wait after failed try number `attempt` (1-based): 1, 4, 16 then 64 minutes. */
export function backoffMs(attempt: number): number {
  return FIRST_WAIT_MS * GROWTH ** (attempt - 1);
}

export interface SendDeps {
  pool: Pool;
  /** Where a retry is queued; null runs no retry job (the row is still left pending). */
  boss: PgBoss | null;
  now: Date;
}

export interface SendResult {
  outcome: 'sent' | 'retry' | 'dead' | 'skipped';
  /** Phones that took the message. */
  delivered: number;
}

type Attempt = { outcome: Outcome; delivered: number };

function failure(row: DueNotification, code: string, now: Date, retryable: boolean): Outcome {
  const attempts = row.attempts + 1;
  if (!retryable || attempts >= MAX_ATTEMPTS) return { status: 'dead', attempts, lastError: code };
  return {
    status: 'pending',
    attempts,
    nextAttemptAt: new Date(now.getTime() + backoffMs(attempts)),
    lastError: code,
  };
}

/** Sends to every phone the person has; the message counts as sent once any one took it. */
async function attemptPush(
  tx: PoolClient,
  tenantId: string,
  row: DueNotification,
  now: Date,
): Promise<Attempt> {
  const phones = (await subscriptionsOfPerson(tx, tenantId, row.personId)).filter((s) =>
    isPushEndpoint(s.endpoint),
  );
  if (phones.length === 0)
    return { outcome: failure(row, 'no_subscription', now, false), delivered: 0 };
  const payload = pushPayload(row.kind, row.ticketId);
  const results: PushResult[] = await Promise.all(phones.map((p) => sendPush(p, payload)));
  const failed: { code: string; gone: boolean }[] = [];
  for (const [i, result] of results.entries()) {
    if (result.ok) continue;
    failed.push(result);
    if (result.gone) await deleteSubscription(tx, tenantId, phones[i]!.endpoint);
  }
  const delivered = results.length - failed.length;
  if (delivered > 0) return { outcome: { status: 'sent', attempts: row.attempts + 1 }, delivered };
  const worth = failed.filter((f) => !f.gone);
  const last = (worth.length > 0 ? worth : failed).at(-1)!;
  return { outcome: failure(row, last.code, now, worth.length > 0), delivered: 0 };
}

/**
 * One attempt at one notification, as the `notify.send` job runs it. Guarded: a row that is not pending, not
 * yet due, or being sent by someone else is left alone. The row, its retry job and any deleted expired phone
 * change in one transaction, so a crash leaves the row as it was and pg-boss tries the job again.
 */
export async function processNotification(
  deps: SendDeps,
  job: { tenantId: string; notificationId: string },
): Promise<SendResult> {
  const { tenantId, notificationId } = job;
  return withTenant(deps.pool, tenantId, async (tx): Promise<SendResult> => {
    const row = await lockDueNotification(tx, tenantId, notificationId, deps.now);
    if (!row) return { outcome: 'skipped', delivered: 0 };
    const { outcome, delivered } =
      row.channel === 'push'
        ? await attemptPush(tx, tenantId, row, deps.now)
        : { outcome: failure(row, 'no_sender', deps.now, false), delivered: 0 };
    await recordOutcome(tx, { tenantId, id: notificationId, now: deps.now }, outcome);
    if (outcome.status === 'pending' && deps.boss)
      await queueSend(
        tx,
        deps.boss,
        { tenantId, notificationId, attempt: outcome.attempts },
        outcome.nextAttemptAt,
      );
    return { outcome: outcome.status === 'pending' ? 'retry' : outcome.status, delivered };
  });
}
