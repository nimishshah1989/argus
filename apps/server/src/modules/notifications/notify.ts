import type { PoolClient } from 'pg';
import type { PgBoss } from 'pg-boss';
import { jobDb } from '../../kernel/index.js';
import type { NotifyKind } from './kinds.js';
import { insertNotification, notificationIdByKey, type Channel } from './repo.js';

export const NOTIFY_SEND_QUEUE = 'notify.send';
export const NOTIFY_SEND_VERSION = 1;
export const SEND_QUEUE = {
  policy: 'standard',
  retryLimit: 2,
  retryDelay: 30,
  expireInSeconds: 120,
} as const;
/** The table caps a key at 200; `:`, a 36-character person id, `:` and a channel (at most 8) are added to the caller's key. */
const MAX_CALLER_KEY = 200 - (1 + 36 + 1 + 8);
const PERSON_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const queueReady = new WeakSet<PgBoss>();

export interface NotifyInput {
  tenantId: string;
  /** People to tell: one row each, per channel. */
  to: readonly string[];
  kind: NotifyKind;
  /** Names this message. Asking again with the same key tells nobody twice. Up to 154 characters. */
  dedupeKey: string;
  /** Default `['push']`. `whatsapp` has no sender yet, so its row is recorded and goes straight to dead. */
  channels?: readonly Channel[];
  ticketId?: string;
  /** Needs `ticketId`. */
  eventId?: string;
  /** Default now. Only a test with a fake clock passes it. */
  now?: Date;
}

export interface Notified {
  personId: string;
  channel: Channel;
  notificationId: string;
  /** False when this key was already recorded: nothing new was queued. */
  created: boolean;
}

export interface SendJob {
  v: typeof NOTIFY_SEND_VERSION;
  tenantId: string;
  notificationId: string;
  attempt: number;
}

/**
 * Tells people about something. Call it inside the transaction that made the thing happen: the rows and the
 * queued sends commit together or not at all. Writes one row per recipient and channel holding ids only (never a
 * name, a phone number or wording), and queues `notify.send` for each new one. `boss` null queues nothing: the
 * caller then runs `processNotification` itself (the push test button does).
 *
 * Delivery is at least once: if the server dies after the push service accepted a message but before the row is
 * marked sent, the job runs again and the person gets it twice. A message is never lost to a crash, a late
 * wake-up or a lost job (`notify.sweep` re-queues those); the price is a rare duplicate.
 */
export async function notify(
  tx: PoolClient,
  boss: PgBoss | null,
  input: NotifyInput,
): Promise<Notified[]> {
  if (input.dedupeKey.length === 0 || input.dedupeKey.length > MAX_CALLER_KEY)
    throw new Error(
      `notify: the dedupe key is empty or too long (most ${MAX_CALLER_KEY} characters)`,
    );
  const now = input.now ?? new Date();
  const made: Notified[] = [];
  for (const personId of new Set(input.to.map(canonicalPerson)))
    for (const channel of new Set<Channel>(input.channels ?? ['push'])) {
      const dedupeKey = `${input.dedupeKey}:${personId}:${channel}`;
      const id = await insertNotification(tx, {
        tenantId: input.tenantId,
        dedupeKey,
        kind: input.kind,
        personId,
        channel,
        ticketId: input.ticketId ?? null,
        eventId: input.eventId ?? null,
        nextAttemptAt: now,
      });
      if (id && boss)
        await queueSend(
          tx,
          boss,
          { tenantId: input.tenantId, notificationId: id, attempt: 0 },
          now,
        );
      made.push({
        personId,
        channel,
        notificationId: id ?? (await notificationIdByKey(tx, input.tenantId, dedupeKey)),
        created: id !== null,
      });
    }
  return made;
}

/** A person id spelled one way, so `ABC…` and `abc…` are one recipient and one dedupe key. */
function canonicalPerson(id: string): string {
  const lower = id.toLowerCase();
  if (!PERSON_ID.test(lower)) throw new Error('notify: a recipient is not a person id');
  return lower;
}

/** Queues a send on the caller's transaction, to start at `startAfter`. */
export async function queueSend(
  tx: PoolClient,
  boss: PgBoss,
  job: Omit<SendJob, 'v'>,
  startAfter: Date,
): Promise<void> {
  if (!queueReady.has(boss)) {
    if (!(await boss.getQueue(NOTIFY_SEND_QUEUE)))
      await boss.createQueue(NOTIFY_SEND_QUEUE, SEND_QUEUE);
    queueReady.add(boss);
  }
  // No singleton key: pg-boss's standard policy would not enforce it, and `processNotification` already
  // ignores a row that is no longer pending, so a duplicate job does nothing.
  await boss.send(NOTIFY_SEND_QUEUE, { v: NOTIFY_SEND_VERSION, ...job } satisfies SendJob, {
    startAfter,
    db: jobDb(tx),
  });
}
