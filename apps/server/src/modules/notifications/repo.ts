import type { Pool, PoolClient } from 'pg';

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

export async function subscriptionsOfPerson(
  pool: Pool,
  personId: string,
): Promise<SubscriptionRow[]> {
  const rows = (
    await pool.query('SELECT endpoint, keys FROM push_subscription WHERE acting_person_id = $1', [
      personId,
    ])
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
