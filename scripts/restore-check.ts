import { pathToFileURL } from 'node:url';
import type { Pool } from 'pg';
import { withTenant } from '../packages/db/src/tenant.js';
import { listTenants, operatorPool } from './operator-db.js';

/**
 * `tsx scripts/restore-check.ts` — what a restore drill compares (infra/RESTORE.md): per customer, how many of
 * each kind of record the database holds, plus the migration ledger. Run it on the live database and on the
 * restored one; the two outputs must be identical. Read-only. Counts only, no names and no values.
 */

const COUNTS: ReadonlyArray<[label: string, table: string]> = [
  ['tickets', 'ticket'],
  ['events', 'ticket_event'],
  ['workSegments', 'work_segment'],
  ['crew', 'crew_member'],
  ['reports', 'breakdown_report'],
  ['people', 'person'],
  ['logins', 'login'],
  ['machines', 'machine'],
  ['importBatches', 'import_batch'],
  ['importRows', 'import_row'],
  ['auditRows', 'audit_log'],
];

export interface RestoreCheck {
  migrations: { applied: number; last: string | null };
  customers: Array<{ slug: string; counts: Record<string, number> }>;
}

export async function restoreCheck(pool: Pool): Promise<RestoreCheck> {
  const hasLedger = (
    await pool.query("SELECT to_regclass('public.schema_migration') IS NOT NULL AS yes")
  ).rows[0].yes as boolean;
  const ledger = hasLedger
    ? ((
        await pool.query(
          'SELECT count(*)::int AS applied, max(filename) AS last FROM schema_migration',
        )
      ).rows[0] as { applied: number; last: string | null })
    : { applied: 0, last: null };
  const customers: RestoreCheck['customers'] = [];
  for (const { id, slug } of await listTenants(pool)) {
    // Row security filters even the owner, so each customer is counted under its own tenant setting.
    const counts = await withTenant(pool, id, async (client) => {
      const found: Record<string, number> = {};
      for (const [label, table] of COUNTS) {
        const result = await client.query(
          `SELECT count(*)::int AS n FROM ${table} WHERE tenant_id = $1`,
          [id],
        );
        found[label] = result.rows[0].n as number;
      }
      return found;
    });
    customers.push({ slug, counts });
  }
  return { migrations: { applied: ledger.applied, last: ledger.last }, customers };
}

async function main(): Promise<void> {
  const pool = operatorPool();
  try {
    console.log(JSON.stringify(await restoreCheck(pool), null, 2));
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
