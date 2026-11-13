import { readFileSync, readdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { Client, Pool } from 'pg';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { installJobSchema } from '../src/install-jobs.js';

const D17_TABLES = [
  ...'audit_log breakdown_report breakdown_report_person command_idempotency crew_member file glossary_term import_batch import_row list_item login machine machine_group machine_move person platform_access push_subscription ref_counter segment session setting shift sla_policy sla_timer tenant ticket ticket_event work_segment'.split(
    ' ',
  ),
  ...'roster_entry escalation_rule notification kpi_snapshot forecast intervention pm_plan asset_register ai_suggestion document document_chunk wa_message'.split(
    ' ',
  ),
];
const DATED_TABLES: Record<string, string> = { ticket_tag: 'ticket 07 drops it' };

const A = '10000000-0000-0000-0000-000000000001';
const B = '20000000-0000-0000-0000-000000000001';
let container: StartedPostgreSqlContainer;
let db: Client;
let tenantTables: string[] = [];

const TABLES_SQL = `SELECT c.relname FROM pg_class c
  WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r','p') ORDER BY 1`;
const TENANT_TABLES_SQL = `SELECT c.relname FROM pg_class c JOIN pg_attribute a ON a.attrelid = c.oid
  WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r','p')
  AND a.attname = 'tenant_id' AND NOT a.attisdropped ORDER BY 1`;

async function names(sql: string): Promise<string[]> {
  return (await db.query(sql)).rows.map((row) => row.relname as string);
}

function budgetProblems(tables: string[]): string[] {
  return tables
    .filter((t) => !D17_TABLES.includes(t) && !(t in DATED_TABLES))
    .map((t) => `${t}: not in D17's table list`);
}

async function rowProblems(tables: string[]): Promise<string[]> {
  const problems: string[] = [];
  for (const tenant of [A, B]) {
    await setTenant(tenant);
    for (const table of tables) {
      const n = await count(table);
      if (n !== 1) problems.push(`${table} as ${tenant}: ${n} rows`);
    }
  }
  return problems;
}

async function setTenant(id?: string): Promise<void> {
  if (id) await db.query("SELECT set_config('app.tenant_id', $1, false)", [id]);
  else await db.query('RESET app.tenant_id');
}

async function count(table: string): Promise<number> {
  const result = await db.query(`SELECT count(*)::int AS n FROM ${table}`);
  return result.rows[0].n as number;
}

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:16-alpine').start();
  db = new Client({ connectionString: container.getConnectionUri() });
  await db.connect();
  const migrations = new URL('../migrations/', import.meta.url);
  for (const file of readdirSync(migrations)
    .filter((name) => name.endsWith('.sql'))
    .sort()) {
    await db.query(readFileSync(new URL(file, migrations), 'utf8'));
  }
  const installerPool = new Pool({ connectionString: container.getConnectionUri(), max: 1 });
  await installJobSchema(installerPool);
  await installerPool.end();
  await db.query(readFileSync(new URL('./seed.sql', import.meta.url), 'utf8'));
  tenantTables = await names(TENANT_TABLES_SQL);
  await db.query('SET ROLE app_user');
}, 120_000);

afterAll(async () => {
  await db?.end();
  await container?.stop();
});

describe('schema v1 isolation', () => {
  it('enables and forces RLS on every tenant table', async () => {
    const result = await db.query(
      `SELECT relname, relrowsecurity, relforcerowsecurity
       FROM pg_class
       WHERE relnamespace = 'public'::regnamespace AND relname = ANY($1)`,
      [tenantTables],
    );
    expect(result.rows).toHaveLength(tenantTables.length);
    for (const row of result.rows) {
      expect(row.relrowsecurity, `${row.relname} RLS`).toBe(true);
      expect(row.relforcerowsecurity, `${row.relname} FORCE`).toBe(true);
    }
    const policies = await db.query(
      `SELECT tablename, count(*)::int AS n FROM pg_policies
       WHERE schemaname = 'public' GROUP BY tablename`,
    );
    for (const row of policies.rows) expect(row.n, `${row.tablename} policy`).toBe(1);
    const columns = await db.query(
      `SELECT table_name FROM information_schema.columns
       WHERE table_schema = 'public' AND column_name = 'tenant_id' AND table_name = ANY($1)`,
      [tenantTables],
    );
    expect(columns.rows).toHaveLength(tenantTables.length);
  });

  it('gives app_user no bypass and app_router bypass', async () => {
    const result = await db.query(
      "SELECT rolname, rolbypassrls FROM pg_roles WHERE rolname IN ('app_user', 'app_router') ORDER BY rolname",
    );
    expect(result.rows).toEqual([
      { rolname: 'app_router', rolbypassrls: true },
      { rolname: 'app_user', rolbypassrls: false },
    ]);
  });

  it('shows each tenant exactly its own row in every table', async () => {
    expect(tenantTables).toContain('breakdown_report_person');
    expect(await rowProblems(tenantTables)).toEqual([]);
  });

  it('allows no table outside the D17 budget', async () => {
    expect(D17_TABLES).toHaveLength(40);
    expect(budgetProblems(await names(TABLES_SQL))).toEqual([]);
  });

  it('catches a planted table', async () => {
    await db.query('RESET ROLE');
    await db.query('BEGIN');
    try {
      await db.query(
        'CREATE TABLE stray_widget (id uuid PRIMARY KEY, tenant_id uuid NOT NULL); GRANT SELECT ON stray_widget TO app_user',
      );
      expect(budgetProblems(await names(TABLES_SQL))).toEqual([
        "stray_widget: not in D17's table list",
      ]);
      expect(await names(TENANT_TABLES_SQL)).toContain('stray_widget');
      await db.query('SET LOCAL ROLE app_user');
      expect(await rowProblems(['stray_widget'])).toEqual([
        `stray_widget as ${A}: 0 rows`,
        `stray_widget as ${B}: 0 rows`,
      ]);
    } finally {
      await db.query('ROLLBACK');
      await db.query('SET ROLE app_user');
    }
  });

  it('returns zero rows when app.tenant_id is unset', async () => {
    await setTenant();
    for (const table of tenantTables) expect(await count(table), `${table} unset`).toBe(0);
  });

  it('does not let app_user read tenant directly', async () => {
    await expect(db.query('SELECT * FROM tenant')).rejects.toThrow(/permission denied/);
  });

  it('discovers policy tenants narrowly and grants queue access to app_api', async () => {
    await setTenant();
    const tenants = await db.query('SELECT * FROM tenants_with_sla_policies() ORDER BY tenant_id');
    expect(tenants.rows).toEqual([{ tenant_id: A }, { tenant_id: B }]);
    const grants = await db.query(
      `SELECT
         has_schema_privilege('app_api', 'pgboss', 'USAGE') AS schema_usage,
         has_table_privilege('app_api', 'pgboss.version', 'SELECT') AS version_select,
         has_table_privilege('app_api', 'pgboss.version', 'INSERT') AS version_insert`,
    );
    expect(grants.rows).toEqual([
      { schema_usage: true, version_select: true, version_insert: true },
    ]);
  });

  it('resolves the tenant by slug and the session token across tenants', async () => {
    await setTenant(A);
    const tenant = await db.query("SELECT * FROM tenant_by_slug('cosmos')");
    expect(tenant.rows).toEqual([
      { id: A, slug: 'cosmos', name: 'Cosmos', language: 'en', time_zone: 'Asia/Kolkata' },
    ]);
    const session = await db.query("SELECT * FROM auth_lookup('token-b')");
    expect(session.rows[0]).toMatchObject({
      tenant_id: B,
      shared: true,
      acting_person_id: '20000000-0000-0000-0000-000000000002',
    });
  });

  it('rejects a missing, expired or revoked session', async () => {
    await setTenant(A);
    await db.query(
      `INSERT INTO session (id, tenant_id, login_id, token_hash, expires_at)
       VALUES ($1, $2, $3, 'expired-token', now() - interval '1 day'),
              ($4, $2, $3, 'revoked-token', now() + interval '1 day')`,
      [randomUUID(), A, '10000000-0000-0000-0000-000000000003', randomUUID()],
    );
    await db.query("UPDATE session SET revoked_at = now() WHERE token_hash = 'revoked-token'");
    for (const token of ['missing-token', 'expired-token', 'revoked-token']) {
      expect((await db.query('SELECT * FROM auth_lookup($1)', [token])).rows).toHaveLength(0);
    }
    await db.query(
      "UPDATE login SET disabled_at = now() WHERE id = '10000000-0000-0000-0000-000000000003'",
    );
    expect((await db.query("SELECT * FROM auth_lookup('token-a')")).rows).toHaveLength(0);
    await db.query(
      "UPDATE login SET disabled_at = NULL WHERE id = '10000000-0000-0000-0000-000000000003'",
    );
    await db.query("DELETE FROM session WHERE token_hash IN ('expired-token', 'revoked-token')");
  });

  it('enforces ticket event and command idempotency uniqueness', async () => {
    await setTenant(A);
    await expect(
      db.query(
        "INSERT INTO ticket_event (tenant_id, ticket_id, seq, type) VALUES ($1, $2, 1, 'down')",
        [A, '10000000-0000-0000-0000-00000000000e'],
      ),
    ).rejects.toThrow(/duplicate key/);
    await expect(
      db.query(
        "INSERT INTO command_idempotency (tenant_id, login_id, key, command, request_hash) VALUES ($1, $2, 'seed-a', 'raise', 'seed-a')",
        [A, '10000000-0000-0000-0000-000000000003'],
      ),
    ).rejects.toThrow(/duplicate key/);
    await expect(
      db.query(
        "INSERT INTO ticket_event (tenant_id, ticket_id, seq, type) VALUES ($1, $2, 2, 'down')",
        [A, '20000000-0000-0000-0000-00000000000e'],
      ),
    ).rejects.toThrow(/foreign key/);
    await expect(
      db.query(
        "INSERT INTO breakdown_report_person (tenant_id, report_id, person_id, role) VALUES ($1, $2, $3, 'done')",
        [A, '10000000-0000-0000-0000-000000000012', '20000000-0000-0000-0000-000000000002'],
      ),
    ).rejects.toThrow(/foreign key/);
  });

  it('preserves a tag assignment when its login and person are deleted', async () => {
    const tenant = '30000000-0000-0000-0000-000000000001';
    const person = '30000000-0000-0000-0000-000000000002';
    const login = '30000000-0000-0000-0000-000000000003';
    const ticket = '30000000-0000-0000-0000-00000000000e';
    const item = '30000000-0000-0000-0000-00000000000a';
    await db.query('RESET ROLE');
    await db.query(
      "INSERT INTO tenant (id, slug, name) VALUES ($1, 'actor-delete', 'Actor Delete')",
      [tenant],
    );
    await db.query("INSERT INTO person (id, tenant_id, name) VALUES ($1, $2, 'Actor')", [
      person,
      tenant,
    ]);
    await db.query(
      "INSERT INTO login (id, tenant_id, person_id, username, password_hash, role, shared) VALUES ($1, $2, $3, 'actor', 'hash', 'technician', false)",
      [login, tenant, person],
    );
    await db.query(
      "INSERT INTO ticket (id, tenant_id, ref, kind, status, problem, reported_at, severity) VALUES ($1, $2, 'BD-0001', 'stopped', 'open', 'Actor test', now(), 'S3')",
      [ticket, tenant],
    );
    await db.query(
      "INSERT INTO list_item (id, tenant_id, list, code, label) VALUES ($1, $2, 'maint_code', 'M', 'Mechanical')",
      [item, tenant],
    );
    await db.query(
      `INSERT INTO ticket_tag (tenant_id, ticket_id, item_id, applied_by_login_id, applied_by_person_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [tenant, ticket, item, login, person],
    );
    await db.query('SET ROLE app_user');
    await setTenant(tenant);

    await db.query('DELETE FROM login WHERE id = $1', [login]);
    let assignment = (await db.query('SELECT * FROM ticket_tag WHERE tenant_id = $1', [tenant]))
      .rows[0];
    expect(assignment.applied_by_login_id).toBeNull();
    expect(assignment.applied_by_person_id).toBe(person);

    await db.query('DELETE FROM person WHERE id = $1', [person]);
    assignment = (await db.query('SELECT * FROM ticket_tag WHERE tenant_id = $1', [tenant]))
      .rows[0];
    expect(assignment.applied_by_login_id).toBeNull();
    expect(assignment.applied_by_person_id).toBeNull();
    expect(assignment.ticket_id).toBe(ticket);
    expect(assignment.item_id).toBe(item);
  });

  it('keeps the audit log append-only for the app role', async () => {
    await setTenant(A);
    await expect(
      db.query("UPDATE audit_log SET action = 'tamper' WHERE tenant_id = $1", [A]),
    ).rejects.toThrow(/permission denied/);
    await expect(db.query('DELETE FROM audit_log WHERE tenant_id = $1', [A])).rejects.toThrow(
      /permission denied/,
    );
  });

  it('rejects a report or logo file from another tenant', async () => {
    await setTenant(A);
    await expect(
      db.query('UPDATE breakdown_report SET signature_file_id = $1 WHERE id = $2', [
        '20000000-0000-0000-0000-000000000013',
        '10000000-0000-0000-0000-000000000012',
      ]),
    ).rejects.toThrow(/foreign key/);
    await db.query('RESET ROLE');
    try {
      await expect(
        db.query('UPDATE tenant SET logo_file_id = $1 WHERE id = $2', [
          '20000000-0000-0000-0000-000000000013',
          A,
        ]),
      ).rejects.toThrow(/logo file must belong/);
    } finally {
      await db.query('SET ROLE app_user');
    }
  });

  it('scopes push endpoints to the tenant', async () => {
    await setTenant(B);
    await db.query(
      "INSERT INTO push_subscription (id, tenant_id, login_id, acting_person_id, endpoint) VALUES ($1, $2, $3, $4, 'https://push.example/a')",
      [
        randomUUID(),
        B,
        '20000000-0000-0000-0000-000000000003',
        '20000000-0000-0000-0000-000000000002',
      ],
    );
    expect(await count('push_subscription')).toBe(2);
    await db.query(
      "DELETE FROM push_subscription WHERE endpoint = 'https://push.example/a' AND tenant_id = $1",
      [B],
    );
  });
});
