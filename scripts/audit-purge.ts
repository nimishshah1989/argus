import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import type { Pool } from 'pg';
import { operatorPool } from './operator-db.js';

/**
 * `pnpm audit:purge --operator <who> [--confirm]` — the `audit.purge` job (ticket 14, ARCHITECTURE §9 item 33).
 * It is an operator command, not a worker job: `audit_purge` is router-only (D24), so it runs on the migration
 * credential, which the server never holds. Removes ordinary audit rows older than 3 years (plus a day's margin);
 * the erase and offboard proof rows stay (database function, migration 0010). Without `--confirm` it only counts.
 */

const THREE_YEARS_AND_A_DAY = (now: Date): Date => {
  const cutoff = new Date(now.getTime() - 86_400_000);
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 3);
  return cutoff;
};

export async function auditPurge(
  pool: Pool,
  options: { now: Date; operator: string; confirm: boolean },
): Promise<{ deleted: number; confirmed: boolean }> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const row = (
      await client.query('SELECT audit_purge($1, $2) AS n', [
        THREE_YEARS_AND_A_DAY(options.now),
        options.operator,
      ])
    ).rows[0] as { n: string };
    // The function does the deleting and the counting; a dry run rolls it back so the count is exact.
    await client.query(options.confirm ? 'COMMIT' : 'ROLLBACK');
    return { deleted: Number(row.n), confirmed: options.confirm };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: { operator: { type: 'string' }, confirm: { type: 'boolean' } },
  });
  if (!values.operator?.trim()) {
    console.error(
      'usage: audit:purge --operator <who> [--confirm]   (without --confirm it only counts)',
    );
    process.exitCode = 2;
    return;
  }
  const pool = operatorPool();
  try {
    const result = await auditPurge(pool, {
      now: new Date(),
      operator: values.operator,
      confirm: values.confirm === true,
    });
    console.log(JSON.stringify(result));
    if (!result.confirmed) console.log('nothing was removed; run again with --confirm to remove');
  } finally {
    await pool.end();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
