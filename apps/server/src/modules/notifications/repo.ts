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

export interface NotificationsToWrite {
  tenantId: string;
  kind: string;
  ticketId: string | null;
  eventId: string | null;
  nextAttemptAt: Date;
  /** One entry per message: person, channel and the key that names it. */
  rows: { dedupeKey: string; personId: string; channel: Channel }[];
}

/** One statement for all rows. The ids of the rows that are new, by dedupe key; a key already recorded is left out. */
export async function insertNotifications(
  tx: Db,
  n: NotificationsToWrite,
): Promise<Map<string, string>> {
  const inserted = await tx.query(
    `INSERT INTO notification
       (tenant_id, dedupe_key, kind, person_id, channel, ticket_id, event_id, next_attempt_at)
     SELECT $1, u.k, $3, u.p, u.c, $6::uuid, $7::uuid, $8
       FROM unnest($2::text[], $4::uuid[], $5::text[]) AS u(k, p, c)
     ON CONFLICT (tenant_id, dedupe_key) DO NOTHING RETURNING id, dedupe_key`,
    [
      n.tenantId,
      n.rows.map((r) => r.dedupeKey),
      n.kind,
      n.rows.map((r) => r.personId),
      n.rows.map((r) => r.channel),
      n.ticketId,
      n.eventId,
      n.nextAttemptAt,
    ],
  );
  return new Map(inserted.rows.map((r) => [r.dedupe_key as string, r.id as string]));
}

export async function notificationIdsByKey(
  tx: Db,
  tenantId: string,
  dedupeKeys: string[],
): Promise<Map<string, string>> {
  const found = await tx.query(
    'SELECT id, dedupe_key FROM notification WHERE tenant_id = $1 AND dedupe_key = ANY($2::text[])',
    [tenantId, dedupeKeys],
  );
  return new Map(found.rows.map((r) => [r.dedupe_key as string, r.id as string]));
}

export interface PendingNotification {
  id: string;
  nextAttemptAt: Date;
  personId: string;
  channel: Channel;
  kind: string;
  ticketId: string | null;
  attempts: number;
}

/** The row if it is still pending and nobody else is sending it; locked until the transaction ends. */
export async function lockPendingNotification(
  tx: Db,
  tenantId: string,
  id: string,
): Promise<PendingNotification | null> {
  const found = await tx.query(
    `SELECT id, person_id, channel, kind, ticket_id, attempts, next_attempt_at FROM notification
      WHERE tenant_id = $1 AND id = $2 AND status = 'pending'
      FOR UPDATE SKIP LOCKED`,
    [tenantId, id],
  );
  const r = found.rows[0];
  if (!r) return null;
  return {
    id: r.id,
    personId: r.person_id,
    channel: r.channel,
    kind: r.kind,
    ticketId: r.ticket_id,
    attempts: r.attempts,
    nextAttemptAt: r.next_attempt_at,
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

/** Retention: rows created before `cutoff` that are settled. A message still waiting is never purged. */
/** For each escalation step of a ticket (by its history event), the people the step told. */
export async function toldByEscalationStep(
  tx: Db,
  tenantId: string,
  ticketId: string,
): Promise<Map<string, string[]>> {
  const { rows } = await tx.query(
    `SELECT event_id, array_agg(DISTINCT person_id ORDER BY person_id) AS people
       FROM notification
      WHERE tenant_id = $1 AND ticket_id = $2 AND kind = 'escalation.step' AND event_id IS NOT NULL
      GROUP BY event_id`,
    [tenantId, ticketId],
  );
  return new Map(rows.map((row) => [row.event_id as string, row.people as string[]]));
}

export async function purgeNotifications(tx: Db, tenantId: string, cutoff: Date): Promise<number> {
  const result = await tx.query(
    "DELETE FROM notification WHERE tenant_id = $1 AND created_at < $2 AND status <> 'pending'",
    [tenantId, cutoff],
  );
  return result.rowCount ?? 0;
}

/**
 * Takes the pending rows that should have been tried before `overdueBefore` (oldest first) and pushes their due
 * time to `now`, in one statement, so another sweep a minute later does not queue them again.
 */
export async function claimOverdue(
  tx: Db,
  tenantId: string,
  at: { overdueBefore: Date; now: Date; limit: number },
): Promise<{ id: string; attempts: number }[]> {
  const claimed = await tx.query(
    `UPDATE notification SET next_attempt_at = $3, updated_at = $3
      WHERE tenant_id = $1 AND id IN (
        SELECT id FROM notification
         WHERE tenant_id = $1 AND status = 'pending' AND next_attempt_at < $2
         ORDER BY next_attempt_at LIMIT $4 FOR UPDATE SKIP LOCKED)
      RETURNING id, attempts`,
    [tenantId, at.overdueBefore, at.now, at.limit],
  );
  return claimed.rows.map((r) => ({ id: r.id as string, attempts: r.attempts as number }));
}

/** A pending row nobody got to before `overdueBefore` is shown dead (`stuck`) so a person can see it. */
export async function markStuckDead(
  tx: Db,
  tenantId: string,
  overdueBefore: Date,
  now: Date,
): Promise<number> {
  const result = await tx.query(
    `UPDATE notification SET status = 'dead', next_attempt_at = NULL, last_error = 'stuck', updated_at = $3
      WHERE tenant_id = $1 AND status = 'pending' AND next_attempt_at < $2`,
    [tenantId, overdueBefore, now],
  );
  return result.rowCount ?? 0;
}
