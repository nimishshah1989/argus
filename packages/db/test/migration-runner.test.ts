import { execFile } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { Pool } from 'pg';
import { expect, it } from 'vitest';
import { applyAppMigrations } from '../../../scripts/migrate.js';

const execFileAsync = promisify(execFile);
const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const MIGRATIONS = new URL('../migrations/', import.meta.url);
const FILES = readdirSync(MIGRATIONS)
  .filter((name) => name.endsWith('.sql'))
  .sort();

const ARTIFACTS: Record<string, string> = {
  '0001_schema_v1.sql': `SELECT to_regclass('public.tenant') IS NOT NULL
    AND to_regclass('public.ticket_event') IS NOT NULL
    AND to_regprocedure('tenant_info(uuid)') IS NOT NULL AS installed`,
  '0002_app_api_role.sql':
    "SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_api') AS installed",
  '0003_command_idempotency_binding.sql': `SELECT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'command_idempotency_tenant_login_key_key'
  ) AS installed`,
  '0004_cancel_time.sql': `SELECT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name = 'ticket' AND column_name = 'cancelled_at'
  ) AS installed`,
  '0005_ticket_tag.sql': "SELECT to_regclass('public.ticket_tag') IS NOT NULL AS installed",
  '0006_severity_matrix.sql': `SELECT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ticket_severity_check'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket' AND column_name = 'severity' AND is_nullable = 'NO'
  ) AS installed`,
  '0007_sla_policy_timer.sql': `SELECT to_regclass('public.sla_policy') IS NOT NULL
    AND to_regclass('public.sla_timer') IS NOT NULL
    AND to_regprocedure('tenants_with_sla_policies()') IS NOT NULL AS installed`,
};

interface TestDatabase {
  pool: Pool;
  url: string;
}

async function withRunnerDatabases(
  run: (createDatabase: () => Promise<TestDatabase>) => Promise<void>,
): Promise<void> {
  const container = await new PostgreSqlContainer('postgres:16-alpine').start();
  const admin = new Pool({ connectionString: container.getConnectionUri(), max: 1 });
  const pools: Pool[] = [];
  let sequence = 0;
  try {
    await run(async () => {
      sequence += 1;
      const name = `migration_runner_${sequence}`;
      await admin.query(`CREATE DATABASE ${name}`);
      const url = new URL(container.getConnectionUri());
      url.pathname = `/${name}`;
      const pool = new Pool({ connectionString: url.toString(), max: 1 });
      pools.push(pool);
      return { pool, url: url.toString() };
    });
  } finally {
    await Promise.all(pools.map((pool) => pool.end()));
    await admin.end();
    await container.stop();
  }
}

function runMigration(url: string, adoptThrough?: string) {
  return execFileAsync('pnpm', ['tsx', 'scripts/migrate.ts'], {
    cwd: ROOT,
    env: {
      ...process.env,
      MIGRATION_DATABASE_URL: url,
      MIGRATION_ADOPT_THROUGH: adoptThrough ?? '',
      APP_API_PASSWORD: '',
    },
    maxBuffer: 1024 * 1024,
  });
}

async function applyThrough(pool: Pool, lastFile: string): Promise<void> {
  for (const file of FILES) {
    if (file > lastFile) return;
    await pool.query(readFileSync(new URL(file, MIGRATIONS), 'utf8'));
  }
}

async function recordThrough(pool: Pool, lastFile: string): Promise<void> {
  await pool.query(
    'CREATE TABLE IF NOT EXISTS schema_migration (filename text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())',
  );
  for (const file of FILES) {
    if (file > lastFile) return;
    await pool.query('INSERT INTO schema_migration (filename) VALUES ($1)', [file]);
  }
}

async function ledger(pool: Pool): Promise<string[]> {
  const result = await pool.query('SELECT filename FROM schema_migration ORDER BY filename');
  return result.rows.map((row) => row.filename);
}

async function expectInstalled(pool: Pool, file: string, installed: boolean): Promise<void> {
  const query = ARTIFACTS[file];
  if (!query) throw new Error(`Missing migration artifact check for ${file}`);
  expect((await pool.query(query)).rows[0]?.installed).toBe(installed);
}

it('runs a fresh database twice without reapplying migrations', async () => {
  await withRunnerDatabases(async (createDatabase) => {
    const { pool, url } = await createDatabase();
    await runMigration(url);
    expect(await ledger(pool)).toEqual(FILES);
    const first = await pool.query(
      'SELECT filename, applied_at FROM schema_migration ORDER BY filename',
    );

    const second = await runMigration(url);
    expect(second.stdout).not.toContain('applied ');
    expect(
      (await pool.query('SELECT filename, applied_at FROM schema_migration ORDER BY filename'))
        .rows,
    ).toEqual(first.rows);
    expect(await ledger(pool)).toEqual(FILES);
  });
}, 120_000);

it('serializes concurrent migration runners through the advisory lock', async () => {
  await withRunnerDatabases(async (createDatabase) => {
    const { pool, url } = await createDatabase();
    await Promise.all([runMigration(url), runMigration(url)]);
    expect(await ledger(pool)).toEqual(FILES);
    await expectInstalled(pool, '0007_sla_policy_timer.sql', true);
  });
}, 120_000);

it('adopts a proven pre-0006 database and applies only the later schema', async () => {
  await withRunnerDatabases(async (createDatabase) => {
    const { pool, url } = await createDatabase();
    await applyThrough(pool, '0005_ticket_tag.sql');
    await runMigration(url, '0005_ticket_tag.sql');

    expect(await ledger(pool)).toEqual(FILES);
    await expectInstalled(pool, '0006_severity_matrix.sql', true);
    await expectInstalled(pool, '0007_sla_policy_timer.sql', true);
  });
}, 120_000);

it('refuses to adopt an unledgered 0007 schema even when it is complete', async () => {
  await withRunnerDatabases(async (createDatabase) => {
    const { pool, url } = await createDatabase();
    await applyThrough(pool, '0007_sla_policy_timer.sql');
    await recordThrough(pool, '0006_severity_matrix.sql');
    await pool.query('ALTER ROLE app_api BYPASSRLS NOINHERIT CREATEDB CREATEROLE REPLICATION');
    await expect(runMigration(url)).rejects.toThrow();
    const role = await pool.query(
      `SELECT rolinherit, rolsuper, rolbypassrls, rolcreatedb, rolcreaterole, rolreplication
       FROM pg_roles WHERE rolname = 'app_api'`,
    );
    expect(role.rows[0]).toEqual({
      rolinherit: true,
      rolsuper: false,
      rolbypassrls: false,
      rolcreatedb: false,
      rolcreaterole: false,
      rolreplication: false,
    });

    expect(await ledger(pool)).toEqual(
      FILES.filter((file) => file !== '0007_sla_policy_timer.sql'),
    );
    await expectInstalled(pool, '0007_sla_policy_timer.sql', true);
  });
}, 120_000);

it('adopts a proven pre-0003 database and applies the idempotency binding', async () => {
  await withRunnerDatabases(async (createDatabase) => {
    const { pool, url } = await createDatabase();
    await applyThrough(pool, '0002_app_api_role.sql');
    await runMigration(url, '0002_app_api_role.sql');

    expect(await ledger(pool)).toEqual(FILES);
    await expectInstalled(pool, '0003_command_idempotency_binding.sql', true);
    const oldConstraint = await pool.query(
      "SELECT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'command_idempotency_tenant_id_key_key')",
    );
    expect(Object.values(oldConstraint.rows[0])[0]).toBe(false);
  });
}, 120_000);

it('repairs an incomplete app_api role instead of adopting it', async () => {
  await withRunnerDatabases(async (createDatabase) => {
    const { pool, url } = await createDatabase();
    await applyThrough(pool, '0001_schema_v1.sql');
    await pool.query('CREATE ROLE app_api NOLOGIN');

    const result = await runMigration(url, '0001_schema_v1.sql');
    expect(result.stdout).toContain('applied 0002_app_api_role.sql');
    const privileges = await pool.query(
      "SELECT pg_has_role('app_api', 'app_user', 'MEMBER') AS member, has_schema_privilege('app_api', 'public', 'USAGE') AS usage",
    );
    expect(privileges.rows[0]).toEqual({ member: true, usage: true });
    expect(await ledger(pool)).toEqual(FILES);
  });
}, 120_000);

it('repairs privileged app_api attributes on every migration run', async () => {
  await withRunnerDatabases(async (createDatabase) => {
    const { pool, url } = await createDatabase();
    await applyThrough(pool, '0002_app_api_role.sql');
    await runMigration(url, '0002_app_api_role.sql');

    for (const attributes of [
      'BYPASSRLS',
      'SUPERUSER',
      'NOINHERIT',
      'CREATEDB CREATEROLE REPLICATION',
    ]) {
      await pool.query(`ALTER ROLE app_api ${attributes}`);
      await runMigration(url);
      const role = await pool.query(
        `SELECT rolinherit, rolsuper, rolbypassrls, rolcreatedb, rolcreaterole, rolreplication
         FROM pg_roles WHERE rolname = 'app_api'`,
      );
      expect(role.rows[0]).toEqual({
        rolinherit: true,
        rolsuper: false,
        rolbypassrls: false,
        rolcreatedb: false,
        rolcreaterole: false,
        rolreplication: false,
      });
    }
    expect(await ledger(pool)).toEqual(FILES);
  });
}, 120_000);

it('refuses to ledger incomplete migration artifacts', async () => {
  await withRunnerDatabases(async (createDatabase) => {
    const partials: Array<{ file: string; prepare: (pool: Pool) => Promise<void> }> = [
      {
        file: '0001_schema_v1.sql',
        prepare: async (pool) => {
          await pool.query('CREATE TABLE tenant (id uuid PRIMARY KEY)');
        },
      },
      {
        file: '0001_schema_v1.sql',
        prepare: async (pool) => {
          await applyThrough(pool, '0001_schema_v1.sql');
          await pool.query('REVOKE EXECUTE ON FUNCTION auth_lookup(text) FROM app_user');
        },
      },
      {
        file: '0003_command_idempotency_binding.sql',
        prepare: async (pool) => {
          await applyThrough(pool, '0002_app_api_role.sql');
          await pool.query(`
            ALTER TABLE command_idempotency ADD COLUMN login_id uuid;
            ALTER TABLE command_idempotency DROP CONSTRAINT command_idempotency_tenant_id_key_key;
            ALTER TABLE command_idempotency ADD CONSTRAINT command_idempotency_tenant_login_key_key
              UNIQUE (tenant_id, login_id, key);
          `);
        },
      },
      {
        file: '0004_cancel_time.sql',
        prepare: async (pool) => {
          await applyThrough(pool, '0003_command_idempotency_binding.sql');
          await pool.query('ALTER TABLE ticket ADD COLUMN cancelled_at text');
        },
      },
      {
        file: '0006_severity_matrix.sql',
        prepare: async (pool) => {
          await applyThrough(pool, '0005_ticket_tag.sql');
          await pool.query(
            "ALTER TABLE ticket ADD CONSTRAINT ticket_severity_check CHECK (severity IN ('S1', 'S2', 'S3', 'S4'))",
          );
          await recordThrough(pool, '0005_ticket_tag.sql');
        },
      },
      {
        file: '0006_severity_matrix.sql',
        prepare: async (pool) => {
          await applyThrough(pool, '0005_ticket_tag.sql');
          await pool.query(`
            ALTER TABLE ticket ADD CONSTRAINT ticket_severity_check
              CHECK (severity IN ('S1', 'S2', 'S3', 'S4'));
            ALTER TABLE ticket ALTER COLUMN severity SET NOT NULL;
          `);
          await recordThrough(pool, '0005_ticket_tag.sql');
        },
      },
      {
        file: '0005_ticket_tag.sql',
        prepare: async (pool) => {
          await applyThrough(pool, '0004_cancel_time.sql');
          await pool.query(
            'ALTER TABLE list_item ADD CONSTRAINT list_item_tenant_id_unique UNIQUE (tenant_id, id)',
          );
          await pool.query('CREATE TABLE ticket_tag (id uuid PRIMARY KEY)');
        },
      },
      {
        file: '0005_ticket_tag.sql',
        prepare: async (pool) => {
          await applyThrough(pool, '0005_ticket_tag.sql');
          await pool.query('REVOKE INSERT, UPDATE, DELETE ON ticket_tag FROM app_user');
          await recordThrough(pool, '0004_cancel_time.sql');
        },
      },
      ...(['INSERT', 'UPDATE', 'DELETE'] as const).map((privilege) => ({
        file: '0005_ticket_tag.sql',
        prepare: async (pool: Pool) => {
          await applyThrough(pool, '0005_ticket_tag.sql');
          await pool.query(`REVOKE ${privilege} ON ticket_tag FROM app_user`);
          await recordThrough(pool, '0004_cancel_time.sql');
        },
      })),
      {
        file: '0007_sla_policy_timer.sql',
        prepare: async (pool) => {
          await applyThrough(pool, '0006_severity_matrix.sql');
          await recordThrough(pool, '0006_severity_matrix.sql');
          await pool.query('CREATE TABLE sla_policy (id uuid PRIMARY KEY)');
        },
      },
      {
        file: '0007_sla_policy_timer.sql',
        prepare: async (pool) => {
          await applyThrough(pool, '0006_severity_matrix.sql');
          await recordThrough(pool, '0006_severity_matrix.sql');
          await pool.query(`
            CREATE TABLE sla_policy (id uuid PRIMARY KEY, tenant_id uuid, severity text);
            CREATE TABLE sla_timer (id uuid PRIMARY KEY, tenant_id uuid, ticket_id uuid);
            CREATE FUNCTION tenants_with_sla_policies() RETURNS TABLE (tenant_id uuid)
            LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
              SELECT DISTINCT p.tenant_id FROM sla_policy p;
            $$;
          `);
        },
      },
    ];
    for (const partial of partials) {
      const { pool, url } = await createDatabase();
      await partial.prepare(pool);
      const baseline = partial.file <= '0005_ticket_tag.sql' ? partial.file : undefined;
      await expect(runMigration(url, baseline)).rejects.toThrow();
      expect(await ledger(pool)).not.toContain(partial.file);
    }
  });
}, 300_000);

it('fault injection before every ledger write leaves neither artifacts nor a ledger row', async () => {
  await withRunnerDatabases(async (createDatabase) => {
    for (const file of FILES) {
      const { pool, url } = await createDatabase();
      await pool.query(
        'CREATE TABLE schema_migration (filename text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())',
      );
      await pool.query(
        `CREATE FUNCTION fail_before_ledger() RETURNS trigger LANGUAGE plpgsql AS $$
         BEGIN
           IF NEW.filename = '${file}' THEN RAISE EXCEPTION 'injected-before-ledger';
           END IF;
           RETURN NEW;
         END $$;
         CREATE TRIGGER fail_before_ledger BEFORE INSERT ON schema_migration
         FOR EACH ROW EXECUTE FUNCTION fail_before_ledger()`,
      );

      await expect(runMigration(url)).rejects.toThrow(/injected-before-ledger/);
      await expectInstalled(pool, file, false);
      const recorded = await pool.query(
        'SELECT count(*)::int AS n FROM schema_migration WHERE filename = $1',
        [file],
      );
      expect(recorded.rows[0].n).toBe(0);
    }
  });
}, 120_000);

it('preserves the migration error when rollback also fails', async () => {
  const migrationError = new Error('injected-migration-failure');
  let rollbackAttempts = 0;
  const pool = {
    query: async (sql: string) => {
      if (sql === 'ROLLBACK') {
        rollbackAttempts += 1;
        throw new Error('injected-rollback-failure');
      }
      if (sql.includes('CREATE EXTENSION')) throw migrationError;
      return { rows: [], rowCount: 0 };
    },
  } as unknown as Pool;
  await expect(applyAppMigrations(pool, ['0001_schema_v1.sql'], MIGRATIONS)).rejects.toBe(
    migrationError,
  );
  expect(rollbackAttempts).toBe(1);
});

it('preserves a database connection failure during cleanup', async () => {
  await expect(runMigration('postgresql://postgres:postgres@127.0.0.1:1/postgres')).rejects.toThrow(
    /ECONNREFUSED/,
  );
}, 10_000);
