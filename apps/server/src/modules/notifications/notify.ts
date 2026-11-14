import type { PoolClient } from 'pg';
import type { PgBoss } from 'pg-boss';
import { jobDb } from '../../kernel/index.js';
import type { NotifyKind } from './kinds.js';
import { insertNotifications, notificationIdsByKey, type Channel } from './repo.js';

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
 * `notify` never reads who should be told: the caller decides. (Alerts built on it go to people with a personal login
 * of the right role; a shared phone with nobody acting is not a person and is never named.)
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
  const rows = recipientRows(input);
  if (rows.length === 0) return [];
  const { tenantId } = input;
  const now = input.now ?? new Date();
  const created = await insertNotifications(tx, {
    tenantId,
    kind: input.kind,
    ticketId: input.ticketId ?? null,
    eventId: input.eventId ?? null,
    nextAttemptAt: now,
    rows,
  });
  if (boss && created.size > 0)
    await queueSends(
      tx,
      boss,
      [...created.values()].map((notificationId) => ({ tenantId, notificationId, attempt: 0 })),
      now,
    );
  const known = rows.filter((r) => !created.has(r.dedupeKey)).map((r) => r.dedupeKey);
  const existing = known.length > 0 ? await notificationIdsByKey(tx, tenantId, known) : new Map();
  return rows.map((r) => ({
    personId: r.personId,
    channel: r.channel,
    notificationId: (created.get(r.dedupeKey) ?? existing.get(r.dedupeKey)) as string,
    created: created.has(r.dedupeKey),
  }));
}

/** One row per distinct recipient and channel; the stored key adds both to the caller's key. */
function recipientRows(
  input: NotifyInput,
): { dedupeKey: string; personId: string; channel: Channel }[] {
  if (input.dedupeKey.length === 0 || input.dedupeKey.length > MAX_CALLER_KEY)
    throw new Error(
      `notify: the dedupe key is empty or too long (most ${MAX_CALLER_KEY} characters)`,
    );
  const rows: { dedupeKey: string; personId: string; channel: Channel }[] = [];
  for (const personId of new Set(input.to.map(canonicalPerson)))
    for (const channel of new Set<Channel>(input.channels ?? ['push']))
      rows.push({ dedupeKey: `${input.dedupeKey}:${personId}:${channel}`, personId, channel });
  return rows;
}

/** A person id spelled one way, so `ABC…` and `abc…` are one recipient and one dedupe key. */
function canonicalPerson(id: string): string {
  const lower = id.toLowerCase();
  if (!PERSON_ID.test(lower)) throw new Error('notify: a recipient is not a person id');
  return lower;
}

/** Startup made the queue; later sends need not look for it, so none runs `createQueue` inside a ticket write. */
export function markQueueReady(boss: PgBoss): void {
  queueReady.add(boss);
}

/** Queues sends on the caller's transaction, all to start at `startAfter`, in one statement. */
export async function queueSends(
  tx: PoolClient,
  boss: PgBoss,
  jobs: Omit<SendJob, 'v'>[],
  startAfter: Date,
): Promise<void> {
  if (jobs.length === 0) return;
  if (!queueReady.has(boss)) {
    if (!(await boss.getQueue(NOTIFY_SEND_QUEUE)))
      await boss.createQueue(NOTIFY_SEND_QUEUE, SEND_QUEUE);
    queueReady.add(boss);
  }
  // No singleton key: pg-boss's standard policy would not enforce it, and `processNotification` already
  // ignores a row that is no longer pending, so a duplicate job does nothing.
  await boss.insert(
    NOTIFY_SEND_QUEUE,
    jobs.map((job) => ({ data: { v: NOTIFY_SEND_VERSION, ...job } satisfies SendJob, startAfter })),
    { db: jobDb(tx) },
  );
}
