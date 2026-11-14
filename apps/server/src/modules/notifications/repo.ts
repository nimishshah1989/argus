import type { PoolClient } from 'pg';

type Db = Pick<PoolClient, 'query'>;

export interface SubscriptionRow {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

function rowsToSubs(rows: unknown[]): SubscriptionRow[] {
  return rows.map((row) => ({
    endpoint: (row as { endpoint: string }).endpoint,
    keys: (row as { keys: { p256dh: string; auth: string } }).keys,
  }));
}

export async function subscriptionsOfLogin(
  tx: Db,
  tenantId: string,
  loginId: string,
): Promise<SubscriptionRow[]> {
  const rows = (
    await tx.query(
      'SELECT endpoint, keys FROM push_subscription WHERE tenant_id = $1 AND login_id = $2',
      [tenantId, loginId],
    )
  ).rows;
  return rowsToSubs(rows);
}

export async function upsertSubscription(
  tx: Db,
  s: {
    tenantId: string;
    loginId: string;
    actingPersonId: string;
    endpoint: string;
    keys: string;
    role: string;
  },
): Promise<void> {
  await tx.query(
    `INSERT INTO push_subscription (tenant_id, login_id, acting_person_id, endpoint, keys, role)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (tenant_id, endpoint) DO UPDATE SET
         login_id = EXCLUDED.login_id, acting_person_id = EXCLUDED.acting_person_id,
         keys = EXCLUDED.keys, role = EXCLUDED.role, updated_at = now()`,
    [s.tenantId, s.loginId, s.actingPersonId, s.endpoint, s.keys, s.role],
  );
}

export async function deleteSubscription(
  tx: Db,
  tenantId: string,
  endpoint: string,
): Promise<void> {
  await tx.query('DELETE FROM push_subscription WHERE tenant_id = $1 AND endpoint = $2', [
    tenantId,
    endpoint,
  ]);
}

/** Every phone this person registered in this plant: where a push to them goes. */
export async function subscriptionsOfPerson(
  tx: Db,
  tenantId: string,
  personId: string,
): Promise<SubscriptionRow[]> {
  const rows = (
    await tx.query(
      'SELECT endpoint, keys FROM push_subscription WHERE tenant_id = $1 AND acting_person_id = $2 ORDER BY created_at',
      [tenantId, personId],
    )
  ).rows;
  return rowsToSubs(rows);
}

/** Switching a login off: every device registered by these logins. */
export async function deleteSubscriptionsOf(tx: Db, loginIds: readonly string[]): Promise<number> {
  const result = await tx.query('DELETE FROM push_subscription WHERE login_id = ANY($1::uuid[])', [
    loginIds,
  ]);
  return result.rowCount ?? 0;
}

/** A shared phone's registration stays, but no longer sends this person's notifications to it. */
export async function clearSubscriptionPerson(tx: Db, personId: string): Promise<number> {
  const result = await tx.query(
    'UPDATE push_subscription SET acting_person_id = NULL, updated_at = now() WHERE acting_person_id = $1',
    [personId],
  );
  return result.rowCount ?? 0;
}

export type Channel = 'push' | 'whatsapp';

export interface NotificationToWrite {
  tenantId: string;
  dedupeKey: string;
  kind: string;
  personId: string;
  channel: Channel;
  ticketId: string | null;
  eventId: string | null;
  nextAttemptAt: Date;
}

/** The new row's id, or null when this dedupe key is already recorded for the plant. */
export async function insertNotification(tx: Db, n: NotificationToWrite): Promise<string | null> {
  const inserted = await tx.query(
    `INSERT INTO notification
       (tenant_id, dedupe_key, kind, person_id, channel, ticket_id, event_id, next_attempt_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (tenant_id, dedupe_key) DO NOTHING RETURNING id`,
    [
      n.tenantId,
      n.dedupeKey,
      n.kind,
      n.personId,
      n.channel,
      n.ticketId,
      n.eventId,
      n.nextAttemptAt,
    ],
  );
  return (inserted.rows[0]?.id as string | undefined) ?? null;
}

export async function notificationIdByKey(
  tx: Db,
  tenantId: string,
  dedupeKey: string,
): Promise<string> {
  const found = await tx.query(
    'SELECT id FROM notification WHERE tenant_id = $1 AND dedupe_key = $2',
    [tenantId, dedupeKey],
  );
  return found.rows[0].id as string;
}

export interface DueNotification {
  id: string;
  personId: string;
  channel: Channel;
  kind: string;
  ticketId: string | null;
  attempts: number;
}

/** The row if it is still pending, due at `now` and nobody else is sending it; locked until the transaction ends. */
export async function lockDueNotification(
  tx: Db,
  tenantId: string,
  id: string,
  now: Date,
): Promise<DueNotification | null> {
  const found = await tx.query(
    `SELECT id, person_id, channel, kind, ticket_id, attempts FROM notification
      WHERE tenant_id = $1 AND id = $2 AND status = 'pending' AND next_attempt_at <= $3
      FOR UPDATE SKIP LOCKED`,
    [tenantId, id, now],
  );
  const r = found.rows[0] as
    | {
        id: string;
        person_id: string;
        channel: Channel;
        kind: string;
        ticket_id: string | null;
        attempts: number;
      }
    | undefined;
  if (!r) return null;
  return {
    id: r.id,
    personId: r.person_id,
    channel: r.channel,
    kind: r.kind,
    ticketId: r.ticket_id,
    attempts: r.attempts,
  };
}

export type Outcome =
  | { status: 'sent'; attempts: number }
  | { status: 'pending'; attempts: number; nextAttemptAt: Date; lastError: string }
  | { status: 'dead'; attempts: number; lastError: string };

export async function recordOutcome(
  tx: Db,
  at: { tenantId: string; id: string; now: Date },
  o: Outcome,
): Promise<void> {
  const { tenantId, id, now } = at;
  await tx.query(
    `UPDATE notification SET status = $3, attempts = $4, next_attempt_at = $5,
            sent_at = $6, last_error = COALESCE($7, last_error), updated_at = $8
      WHERE tenant_id = $1 AND id = $2`,
    [
      tenantId,
      id,
      o.status,
      o.attempts,
      o.status === 'pending' ? o.nextAttemptAt : null,
      o.status === 'sent' ? now : null,
      o.status === 'sent' ? null : o.lastError,
      now,
    ],
  );
}

/** Retention: rows created before `cutoff`, whatever their state. */
export async function purgeNotifications(tx: Db, tenantId: string, cutoff: Date): Promise<number> {
  const result = await tx.query(
    'DELETE FROM notification WHERE tenant_id = $1 AND created_at < $2',
    [tenantId, cutoff],
  );
  return result.rowCount ?? 0;
}
