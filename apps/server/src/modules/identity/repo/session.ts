import type { PoolClient } from 'pg';

type Db = Pick<PoolClient, 'query'>;

/**
 * The live sign-in behind a token, locked until commit so a sign-out that follows waits for whatever is being
 * attached to it (a phone's push registration) and then removes it. Null when the sign-in has ended.
 */
export async function lockLiveSession(tx: Db, tokenHash: string): Promise<string | null> {
  const row = (
    await tx.query(
      'SELECT id FROM session WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > now() FOR SHARE',
      [tokenHash],
    )
  ).rows[0];
  return (row?.id as string | undefined) ?? null;
}
