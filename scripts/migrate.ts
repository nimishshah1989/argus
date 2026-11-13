import { readdirSync, readFileSync } from 'node:fs';
import { Pool } from 'pg';
import { pathToFileURL } from 'node:url';
import { installJobSchema } from '../packages/db/src/install-jobs.js';

// These probes only sanity-check an explicitly declared legacy baseline. Without
// MIGRATION_ADOPT_THROUGH, every unledgered migration executes or fails; none is adopted.
const ARTIFACT_QUERIES: Record<string, string> = {
  '0001_schema_v1.sql': `SELECT to_regclass('public.tenant') IS NOT NULL
      AND to_regclass('public.ticket_event') IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace AND n.nspname = 'public'
        JOIN pg_roles owner ON owner.oid = p.proowner AND owner.rolname = 'app_router'
        WHERE p.oid = to_regprocedure('public.auth_lookup(text)')
          AND p.proacl IS NOT NULL
          AND has_function_privilege('app_user', p.oid, 'EXECUTE')
          AND NOT EXISTS (SELECT 1 FROM aclexplode(p.proacl) acl WHERE acl.grantee = 0)
      )`,
  '0002_app_api_role.sql': `SELECT EXISTS (
      SELECT 1 FROM pg_roles api
      JOIN pg_auth_members membership ON membership.member = api.oid
      JOIN pg_roles parent ON parent.oid = membership.roleid
      WHERE api.rolname = 'app_api' AND parent.rolname = 'app_user'
        AND api.rolinherit AND NOT api.rolsuper AND NOT api.rolbypassrls
        AND NOT api.rolcreatedb AND NOT api.rolcreaterole AND NOT api.rolreplication
        AND has_schema_privilege(api.oid, 'public', 'USAGE')
    )`,
  '0003_command_idempotency_binding.sql': `SELECT EXISTS (
      SELECT 1 FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = 'public' AND t.relname = 'command_idempotency'
        AND c.conname = 'command_idempotency_tenant_login_key_key'
        AND pg_get_constraintdef(c.oid) = 'UNIQUE (tenant_id, login_id, key)'
    ) AND EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'command_idempotency'
        AND column_name = 'login_id' AND data_type = 'uuid'
    ) AND EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'command_idempotency'
        AND column_name = 'request_hash' AND data_type = 'text'
    ) AND NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'command_idempotency_tenant_id_key_key'
    )`,
  '0004_cancel_time.sql': `SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'ticket' AND column_name = 'cancelled_at'
        AND data_type = 'timestamp with time zone' AND is_nullable = 'YES'
    )`,
  '0005_ticket_tag.sql': `SELECT EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
      JOIN pg_roles r ON r.rolname = 'app_user'
      WHERE c.relname = 'ticket_tag' AND c.relkind = 'r'
        AND c.relrowsecurity AND c.relforcerowsecurity
        AND has_table_privilege(r.oid, c.oid, 'SELECT')
        AND has_table_privilege(r.oid, c.oid, 'INSERT')
        AND has_table_privilege(r.oid, c.oid, 'UPDATE')
        AND has_table_privilege(r.oid, c.oid, 'DELETE')
    ) AND EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'list_item_tenant_id_unique'
    ) AND EXISTS (
      SELECT 1 FROM pg_policy p
      JOIN pg_class c ON c.oid = p.polrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = 'ticket_tag' AND p.polname = 'tenant_isolation'
    )`,
};

async function alreadyInstalled(pool: Pool, file: string): Promise<boolean> {
  const sql = ARTIFACT_QUERIES[file];
  if (!sql) return false;
  const result = await pool.query(sql);
  return Object.values(result.rows[0])[0] === true;
}

function migrationBody(sql: string): string {
  const begins = /(^|\n)BEGIN;\s*\n/.test(sql);
  const commits = /\nCOMMIT;\s*$/.test(sql);
  if (!begins && !commits) return sql;
  if (!begins || !commits) throw new Error('Migration has an incomplete transaction wrapper');
  // Existing files keep their outer BEGIN/COMMIT for direct psql use. The runner owns the
  // transaction instead so the SQL and its schema_migration row commit together.
  return sql.replace(/(^|\n)BEGIN;\s*\n/, '$1').replace(/\nCOMMIT;\s*$/, '\n');
}

function declaredBaseline(files: string[]): string | undefined {
  const baseline = process.env.MIGRATION_ADOPT_THROUGH;
  if (!baseline) return undefined;
  if (!files.includes(baseline) || baseline > '0005_ticket_tag.sql') {
    throw new Error('MIGRATION_ADOPT_THROUGH must name a migration from 0001 through 0005');
  }
  return baseline;
}

const BYPASS_STATEMENT = 'ALTER ROLE app_router BYPASSRLS;';

/** Replaces the one BYPASSRLS grant of 0001, which a non-superuser owner cannot run (RDS). */
export function withoutBypassGrant(sql: string): string {
  if (sql.split(BYPASS_STATEMENT).length !== 2) {
    throw new Error('0001: expected exactly one ALTER ROLE app_router BYPASSRLS statement');
  }
  return sql.replace(BYPASS_STATEMENT, 'NULL;');
}

/** Roles first, so a non-superuser owner can own the router's functions (schema-notes §8). */
async function prepareRoles(pool: Pool): Promise<void> {
  await pool.query(`DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_router') THEN
        CREATE ROLE app_router NOLOGIN;
      END IF;
      IF NOT pg_has_role(current_user, 'app_router', 'SET') THEN
        EXECUTE format('GRANT app_router TO %I', current_user);
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
        CREATE ROLE app_user NOLOGIN;
      END IF;
      IF NOT pg_has_role(current_user, 'app_user', 'SET') THEN
        EXECUTE format('GRANT app_user TO %I', current_user);
      END IF;
    END $$;`);
}

/**
 * The router role is lent CREATE on public only inside each file's own transaction (it must own the
 * functions it runs, schema-notes §8), so a rollback, a failure or a dead connection takes it back.
 * A grant left by an older run is removed here, with a warning if that cannot be done.
 */
async function revokeLeftoverCreate(pool: Pool): Promise<void> {
  try {
    await pool.query('REVOKE CREATE ON SCHEMA public FROM app_router');
  } catch (error) {
    console.warn(
      `warning: could not revoke CREATE on schema public from app_router: ${error instanceof Error ? error.message : error}`,
    );
  }
}

async function canGrantBypass(pool: Pool): Promise<boolean> {
  const result = await pool.query(
    'SELECT rolsuper OR rolbypassrls AS can FROM pg_roles WHERE rolname = current_user',
  );
  return result.rows[0]?.can === true;
}

async function secureAppApiRole(pool: Pool): Promise<void> {
  // Naming SUPERUSER at all needs a superuser, so the full statement runs only where it is needed.
  await pool.query(`DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_api'
                 AND (rolsuper OR rolbypassrls OR rolreplication)) THEN
        ALTER ROLE app_api INHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION;
      ELSIF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_api') THEN
        ALTER ROLE app_api INHERIT NOCREATEDB NOCREATEROLE;
      END IF;
    END $$;
  `);
}

interface RunContext {
  migrations: URL;
  adoptThrough: string | undefined;
  bypass: boolean;
}

async function applyFile(pool: Pool, file: string, ctx: RunContext): Promise<void> {
  const { migrations, adoptThrough, bypass } = ctx;
  await pool.query('BEGIN');
  try {
    await pool.query('GRANT CREATE ON SCHEMA public TO app_router');
    const mayAdopt = adoptThrough !== undefined && file <= adoptThrough;
    const execute = mayAdopt ? !(await alreadyInstalled(pool, file)) : true;
    if (execute) {
      const body = migrationBody(readFileSync(new URL(file, migrations), 'utf8'));
      await pool.query(file === '0001_schema_v1.sql' && !bypass ? withoutBypassGrant(body) : body);
    }
    if (file === '0002_app_api_role.sql') await secureAppApiRole(pool);
    await pool.query('INSERT INTO schema_migration (filename) VALUES ($1) ON CONFLICT DO NOTHING', [
      file,
    ]);
    await pool.query('REVOKE CREATE ON SCHEMA public FROM app_router'); // a failure rolls the file back
    if (execute) console.log(`applied ${file}`);
    await pool.query('COMMIT');
  } catch (error) {
    try {
      await pool.query('ROLLBACK');
    } catch {
      // Preserve the migration failure even if the connection also fails to roll back.
    }
    throw error;
  }
}

export async function applyAppMigrations(
  pool: Pool,
  files: string[],
  migrations: URL,
  adoptThrough?: string,
): Promise<void> {
  await pool.query("SELECT pg_advisory_lock(hashtext('uptimo-migrations'))");
  await prepareRoles(pool);
  await revokeLeftoverCreate(pool);
  await secureAppApiRole(pool);
  await pool.query(
    'CREATE TABLE IF NOT EXISTS schema_migration (filename text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())',
  );
  const applied = new Set(
    (await pool.query('SELECT filename FROM schema_migration')).rows.map((row) => row.filename),
  );
  const bypass = await canGrantBypass(pool);
  for (const file of files)
    if (!applied.has(file)) await applyFile(pool, file, { migrations, adoptThrough, bypass });
}

/** Tracked deployment migration: app SQL, then pg-boss, then optional app_api login. */
async function main(): Promise<void> {
  const url = process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!url) throw new Error('MIGRATION_DATABASE_URL or DATABASE_URL is required');
  const pool = new Pool({ connectionString: url, max: 1 });
  const migrations = new URL('../packages/db/migrations/', import.meta.url);
  const files = readdirSync(migrations)
    .filter((name) => name.endsWith('.sql'))
    .sort();
  const adoptThrough = declaredBaseline(files);
  try {
    await applyAppMigrations(pool, files, migrations, adoptThrough);
    await secureAppApiRole(pool);
    await installJobSchema(pool);
    if (process.env.APP_API_PASSWORD) {
      const password = process.env.APP_API_PASSWORD.replaceAll("'", "''");
      await pool.query(`ALTER ROLE app_api LOGIN PASSWORD '${password}'`);
    }
    console.log('pg-boss schema and runtime grants ready');
  } catch (error) {
    // Disconnecting releases the session lock; preserve the primary migration error.
    try {
      await pool.end();
    } catch {
      // The original migration error is more actionable than a secondary disconnect error.
    }
    throw error;
  }
  await pool.end();
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await main();
