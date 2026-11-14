import type { PoolClient } from 'pg';
import type { PgBoss } from 'pg-boss';
import { jobDb } from '../../kernel/index.js';
import type { NotifyKind } from './kinds.js';
import { insertNotification, notificationIdByKey, type Channel } from './repo.js';

export const NOTIFY_SEND_QUEUE = 'notify.send';
export const NOTIFY_SEND_VERSION = 1;
/** The table caps a key at 200; the recipient and channel are added to the caller's key. */
const MAX_CALLER_KEY = 200 - (36 + 8 + 2);

export interface NotifyInput {
  tenantId: string;
  /** People to tell: one row each, per channel. */
  to: readonly string[];
  kind: NotifyKind;
  /** Names this message. Asking again with the same key tells nobody twice. Up to 150 characters. */
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
  for (const personId of new Set(input.to))
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

/** Queues a send on the caller's transaction, to start at `startAfter`. */
export async function queueSend(
  tx: PoolClient,
  boss: PgBoss,
  job: Omit<SendJob, 'v'>,
  startAfter: Date,
): Promise<void> {
  await boss.send(NOTIFY_SEND_QUEUE, { v: NOTIFY_SEND_VERSION, ...job } satisfies SendJob, {
    startAfter,
    singletonKey: `${job.notificationId}:${job.attempt}`,
    db: jobDb(tx),
  });
}
