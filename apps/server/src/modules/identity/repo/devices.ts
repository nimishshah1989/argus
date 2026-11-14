import type { PoolClient } from 'pg';

type Db = Pick<PoolClient, 'query'>;

export interface DeviceRow {
  id: string;
  device: string | null;
  current: boolean;
  lastSeenAt: Date;
  createdAt: Date;
}

/** The live sign-ins of one login, most recently used first. */
export async function liveDevices(
  tx: Db,
  loginId: string,
  currentTokenHash: string,
): Promise<DeviceRow[]> {
  const result = await tx.query(
    `SELECT id, device_label AS device, token_hash = $2 AS current,
            last_seen_at AS "lastSeenAt", created_at AS "createdAt"
     FROM session
     WHERE login_id = $1 AND revoked_at IS NULL AND expires_at > now()
     ORDER BY last_seen_at DESC, created_at DESC`,
    [loginId, currentTokenHash],
  );
  return result.rows;
}

/** Ends one live sign-in of this login: its name. Null when it is not theirs, not live, or not there. */
export async function endDevice(
  tx: Db,
  loginId: string,
  sessionId: string,
): Promise<{ device: string | null } | null> {
  const result = await tx.query(
    `UPDATE session SET revoked_at = now(), updated_at = now()
     WHERE id = $1 AND login_id = $2 AND revoked_at IS NULL AND expires_at > now()
     RETURNING device_label AS device`,
    [sessionId, loginId],
  );
  return (result.rows[0] as { device: string | null } | undefined) ?? null;
}
