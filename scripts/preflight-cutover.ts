import { pathToFileURL } from 'node:url';
import type { Pool } from 'pg';
import { withTenant } from '../packages/db/src/tenant.js';
import { listTenants, operatorPool } from './operator-db.js';

// The duplicate query of 0009 part 1, and the grants predicate of part 5.
const DUPLICATES = `SELECT m.code, string_agg(t.ref, ', ' ORDER BY t.ref) AS refs
  FROM ticket t JOIN machine m ON m.id = t.machine_id AND m.tenant_id = t.tenant_id
  WHERE t.tenant_id = $1 AND t.kind <> 'general' AND t.status NOT IN ('closed', 'cancelled')
  GROUP BY m.code, t.machine_id HAVING count(*) > 1 ORDER BY m.code`;
const GRANTS = `SELECT count(*)::int AS n FROM platform_access WHERE tenant_id = $1
  AND (expires_at IS NULL OR expires_at > least(created_at + interval '7 days', now()))`;

async function preflight(pool: Pool): Promise<number> {
  const installed = await pool.query("SELECT to_regclass('public.ticket') IS NOT NULL AS yes");
  if (!installed.rows[0].yes) {
    console.log('preflight: schema not installed');
    return 0;
  }
  const hasTags = (await pool.query("SELECT to_regclass('public.ticket_tag') IS NOT NULL AS yes"))
    .rows[0].yes;
  const total = { duplicates: 0, tags: 0, grants: 0 };
  for (const { id, slug } of await listTenants(pool)) {
    await withTenant(pool, id, async (client) => {
      const duplicates = (await client.query(DUPLICATES, [id])).rows;
      for (const row of duplicates)
        console.log(`preflight: ${slug}: machine ${row.code}: open breakdowns ${row.refs}`);
      const tags = hasTags
        ? (
            await client.query('SELECT count(*)::int AS n FROM ticket_tag WHERE tenant_id = $1', [
              id,
            ])
          ).rows[0].n
        : 0;
      const grants = (await client.query(GRANTS, [id])).rows[0].n;
      console.log(`preflight: ${slug}: ${tags} tag rows to export`);
      console.log(`preflight: ${slug}: ${grants} support grants end at cutover`);
      total.duplicates += duplicates.length;
      total.tags += tags;
      total.grants += grants;
    });
  }
  console.log(
    `preflight: ${total.duplicates} machines with duplicates, ${total.tags} tag rows, ${total.grants} grants`,
  );
  return total.duplicates > 0 ? 3 : 0; // 3: duplicates to resolve; 1 stays for a crash
}

async function main(): Promise<void> {
  const pool = operatorPool();
  try {
    process.exitCode = await preflight(pool);
  } finally {
    await pool.end();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
