import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const TENANT_TABLES = [
  'person',
  'login',
  'session',
  'platform_access',
  'segment',
  'machine_group',
  'machine',
  'machine_move',
  'list_item',
  'shift',
  'setting',
  'glossary_term',
  'ticket',
  'ticket_event',
  'crew_member',
  'work_segment',
  'breakdown_report',
  'file',
  'push_subscription',
  'audit_log',
  'import_batch',
  'import_row',
  'ref_counter',
  'command_idempotency',
];

const A = '10000000-0000-0000-0000-000000000001';
const B = '20000000-0000-0000-0000-000000000001';
let container: StartedPostgreSqlContainer;
let db: Client;

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
  await db.query(
    readFileSync(new URL('../migrations/0001_schema_v1.sql', import.meta.url), 'utf8'),
  );
  await db.query(readFileSync(new URL('./seed.sql', import.meta.url), 'utf8'));
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
      [TENANT_TABLES],
    );
    expect(result.rows).toHaveLength(TENANT_TABLES.length);
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
      [TENANT_TABLES],
    );
    expect(columns.rows).toHaveLength(TENANT_TABLES.length);
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
    for (const tenant of [A, B]) {
      await setTenant(tenant);
      for (const table of TENANT_TABLES)
        expect(await count(table), `${table} as ${tenant}`).toBe(1);
    }
  });

  it('returns zero rows when app.tenant_id is unset', async () => {
    await setTenant();
    for (const table of TENANT_TABLES) expect(await count(table), `${table} unset`).toBe(0);
  });

  it('does not let app_user read tenant directly', async () => {
    await expect(db.query('SELECT * FROM tenant')).rejects.toThrow(/permission denied/);
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
        "INSERT INTO command_idempotency (tenant_id, key, command) VALUES ($1, 'seed-a', 'raise')",
        [A],
      ),
    ).rejects.toThrow(/duplicate key/);
    await expect(
      db.query(
        "INSERT INTO ticket_event (tenant_id, ticket_id, seq, type) VALUES ($1, $2, 2, 'down')",
        [A, '20000000-0000-0000-0000-00000000000e'],
      ),
    ).rejects.toThrow(/foreign key/);
  });
});
