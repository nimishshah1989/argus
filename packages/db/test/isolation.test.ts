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
    await expect(
      db.query(
        "INSERT INTO breakdown_report_person (tenant_id, report_id, person_id, role) VALUES ($1, $2, $3, 'done')",
        [A, '10000000-0000-0000-0000-000000000012', '20000000-0000-0000-0000-000000000002'],
      ),
    ).rejects.toThrow(/foreign key/);
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
