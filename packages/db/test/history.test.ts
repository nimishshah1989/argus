import { randomUUID } from 'node:crypto';
import type { Client } from 'pg';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startMigratedDb } from './migrated.js';

const A = '10000000-0000-0000-0000-000000000001';
const A_LOGIN = '10000000-0000-0000-0000-000000000003';
const A_TICKET = '10000000-0000-0000-0000-00000000000e';
const A_MACHINE = '10000000-0000-0000-0000-000000000008';
const A_GRANT = '10000000-0000-0000-0000-000000000005';
const B_GRANT = '20000000-0000-0000-0000-000000000005';

let container: StartedPostgreSqlContainer;
let db: Client;

/** Runs a statement; the message of its error, or null when it succeeded. */
type Attempt = (
  sql: string,
  params?: unknown[],
) => Promise<{ error: string | null; rows: Array<Record<string, unknown>> }>;

/** One transaction as `app_api` in a tenant, always rolled back. Each attempt gets a savepoint. */
async function asApi<T>(
  tenant: string,
  run: (attempt: Attempt, send: Client['query']) => Promise<T>,
) {
  await db.query('BEGIN');
  try {
    await db.query('SET LOCAL ROLE app_api');
    await db.query("SELECT set_config('app.tenant_id', $1, true)", [tenant]);
    const attempt: Attempt = async (sql, params) => {
      await db.query('SAVEPOINT attempt');
      try {
        const result = await db.query(sql, params);
        await db.query('RELEASE SAVEPOINT attempt');
        return { error: null, rows: result.rows };
      } catch (error) {
        await db.query('ROLLBACK TO SAVEPOINT attempt');
        return { error: (error as Error).message, rows: [] };
      }
    };
    return await run(attempt, db.query.bind(db) as Client['query']);
  } finally {
    await db.query('ROLLBACK');
  }
}

async function owned(table: string, tenant: string): Promise<number> {
  const result = await db.query(`SELECT count(*)::int AS n FROM ${table} WHERE tenant_id = $1`, [
    tenant,
  ]);
  return result.rows[0].n as number;
}

beforeAll(async () => {
  ({ container, client: db } = await startMigratedDb());
}, 120_000);

afterAll(async () => {
  await db?.end();
  await container?.stop();
});

describe('history cannot be lost', () => {
  it('refuses the app role every history delete and event edit', async () => {
    const tables =
      'ticket work_segment crew_member breakdown_report breakdown_report_person list_item login person machine machine_move file'.split(
        ' ',
      );
    const statements: [string, string][] = [
      ['ticket_event', "UPDATE ticket_event SET text = 'tamper'"],
      ...['ticket_event', ...tables].map((t): [string, string] => [t, `DELETE FROM ${t}`]),
    ];
    expect(statements).toHaveLength(13);
    await asApi(A, async (attempt) => {
      for (const [, sql] of statements) {
        expect((await attempt(sql)).error, sql).toMatch(/permission denied/);
      }
    });
    for (const [table] of statements) expect(await owned(table, A), table).toBeGreaterThan(0);
  });

  it('still lets the app do what it does today', async () => {
    await asApi(A, async (attempt) => {
      const steps: [string, unknown[]?][] = [
        ["UPDATE machine SET criticality = 'B' WHERE id = $1", [A_MACHINE]],
        ['UPDATE list_item SET active = false'],
        [
          "INSERT INTO ticket_event (tenant_id, ticket_id, seq, type) VALUES ($1, $2, 2, 'down')",
          [A, A_TICKET],
        ],
        ['DELETE FROM session'],
        ['DELETE FROM push_subscription'],
        ['DELETE FROM command_idempotency'],
      ];
      for (const [sql, params] of steps) expect((await attempt(sql, params)).error, sql).toBeNull();
    });
  });

  it('drops ticket_tag', async () => {
    const result = await db.query("SELECT to_regclass('public.ticket_tag') AS t");
    expect(result.rows[0].t).toBeNull();
  });

  it('makes the 21 history keys RESTRICT', async () => {
    const keys = `login_person_id_fkey ticket_reported_by_person_id_fkey ticket_raised_login_id_fkey
      ticket_lead_person_id_fkey ticket_transfer_to_person_id_fkey ticket_paused_by_person_id_fkey
      ticket_assigned_to_person_id_fkey ticket_closed_by_person_id_fkey ticket_parent_id_fkey
      ticket_machine_id_fkey ticket_event_ticket_id_fkey ticket_event_login_id_fkey
      ticket_event_acting_person_id_fkey crew_member_ticket_id_fkey work_segment_ticket_id_fkey
      breakdown_report_ticket_id_fkey breakdown_report_submitted_by_person_id_fkey
      breakdown_report_person_report_id_fkey file_ticket_id_fkey file_uploaded_by_fkey
      audit_log_login_id_fkey`.split(/\s+/);
    expect(keys).toHaveLength(21);
    const result = await db.query(
      "SELECT conname, confdeltype FROM pg_constraint WHERE conname = ANY($1) AND contype = 'f'",
      [keys],
    );
    expect(result.rows).toHaveLength(21);
    for (const row of result.rows) expect(row.confdeltype, row.conname).toBe('r');
  });

  it('still removes a whole customer when the owner deletes the tenant', async () => {
    const t = '70000000-0000-0000-0000-000000000001';
    const [person, login, machine, ticket] = [1, 2, 3, 4].map(() => randomUUID());
    await db.query("INSERT INTO tenant (id, slug, name) VALUES ($1, 'whole', 'Whole')", [t]);
    await db.query("INSERT INTO person (id, tenant_id, name) VALUES ($1, $2, 'Gone')", [person, t]);
    await db.query(
      "INSERT INTO login (id, tenant_id, person_id, username, password_hash, role, shared) VALUES ($1, $2, $3, 'gone', 'h', 'technician', false)",
      [login, t, person],
    );
    await db.query("INSERT INTO machine (id, tenant_id, code) VALUES ($1, $2, 'M-1')", [
      machine,
      t,
    ]);
    await db.query(
      `INSERT INTO ticket (id, tenant_id, ref, kind, status, machine_id, problem, reported_at, severity,
         reported_by_person_id, raised_login_id)
       VALUES ($1, $2, 'BD-0001', 'stopped', 'open', $3, 'x', now(), 'S3', $4, $5)`,
      [ticket, t, machine, person, login],
    );
    await db.query(
      "INSERT INTO ticket_event (tenant_id, ticket_id, seq, type, login_id) VALUES ($1, $2, 1, 'down', $3)",
      [t, ticket, login],
    );
    await db.query(
      "INSERT INTO crew_member (tenant_id, ticket_id, person_id, role) VALUES ($1, $2, $3, 'primary')",
      [t, ticket, person],
    );
    await db.query(
      "INSERT INTO work_segment (tenant_id, ticket_id, person_id, role, started_at) VALUES ($1, $2, $3, 'lead', now())",
      [t, ticket, person],
    );
    await db.query('DELETE FROM tenant WHERE id = $1', [t]);
    for (const table of 'person login machine ticket ticket_event crew_member work_segment'.split(
      ' ',
    ))
      expect(await owned(table, t), table).toBe(0);
  });
});

describe('one open breakdown per machine', () => {
  it('refuses a second open breakdown on one machine', async () => {
    const insert = (ref: string, kind: string, status: string) => ({
      sql: `INSERT INTO ticket (tenant_id, ref, kind, status, machine_id, problem, reported_at, severity)
       VALUES ($1, $2, $3, $4, $5, 'dup', now(), 'S3')`,
      params: [A, ref, kind, status, A_MACHINE],
    });
    const run = (row: ReturnType<typeof insert>, attempt: Attempt) => attempt(row.sql, row.params);
    await asApi(A, async (attempt) => {
      expect((await run(insert('BD-0002', 'stopped', 'open'), attempt)).error).toMatch(
        /ticket_open_breakdown_unique/,
      );
      expect((await run(insert('WR-0001', 'general', 'open'), attempt)).error).toBeNull();
      expect((await run(insert('BD-0003', 'stopped', 'closed'), attempt)).error).toBeNull();
    });
  });
});

describe('support access', () => {
  const grant = `INSERT INTO platform_access (tenant_id, platform_user, granted_by, expires_at, reason, approved_by_login_id)
    VALUES ($1, 'support-x', 'nimish', now() + ($2 || ' days')::interval, 'test', $3)`;

  it('refuses a grant without an admin approver or longer than 7 days', async () => {
    await asApi(A, async (attempt) => {
      const technician = randomUUID();
      expect(
        (
          await attempt(
            "INSERT INTO login (id, tenant_id, username, password_hash, role, shared) VALUES ($1, $2, 'tech-x', 'h', 'technician', false)",
            [technician, A],
          )
        ).error,
      ).toBeNull();
      expect((await attempt(grant, [A, '1', null])).error).toMatch(
        /the approver must be an active admin login/,
      );
      expect((await attempt(grant, [A, '1', technician])).error).toMatch(
        /the approver must be an active admin login/,
      );
      expect((await attempt(grant, [A, '8', A_LOGIN])).error).toMatch(
        /platform_access_expiry_window/,
      );
      expect(
        (
          await attempt(
            `INSERT INTO platform_access (tenant_id, platform_user, granted_by, reason, approved_by_login_id)
             VALUES ($1, 'support-x', 'nimish', 'test', $2)`,
            [A, A_LOGIN],
          )
        ).error,
      ).toMatch(/null value/);
      expect((await attempt(grant, [A, '1', A_LOGIN])).error).toBeNull();
    });
  });

  it('stamps the grant time from the database and allows only shortening', async () => {
    await asApi(A, async (attempt) => {
      const made = await attempt(
        `INSERT INTO platform_access (tenant_id, platform_user, granted_by, expires_at, reason,
           approved_by_login_id, created_at)
         VALUES ($1, 'support-y', 'nimish', now() + interval '1 day', 'test', $2, '2020-01-01')
         RETURNING id, created_at > now() - interval '1 minute' AS fresh`,
        [A, A_LOGIN],
      );
      expect(made.error).toBeNull();
      expect(made.rows[0]?.fresh).toBe(true);
      const id = made.rows[0]?.id;
      const edit = (set: string) =>
        attempt(`UPDATE platform_access SET ${set} WHERE id = $1`, [id]);
      expect((await edit("expires_at = now() + interval '2 days'")).error).toMatch(
        /cannot be extended/,
      );
      expect((await edit("created_at = '2020-01-01'")).error).toMatch(/cannot be changed/);
      expect((await edit("expires_at = now() + interval '1 hour'")).error).toBeNull();
    });
  });

  it('ties an audit line to the grant it was taken under', async () => {
    const audit = `INSERT INTO audit_log (tenant_id, action, entity, platform_access_id)
      VALUES ($1, 'support.read', 'ticket', $2)`;
    await asApi(A, async (attempt) => {
      expect((await attempt(audit, [A, A_GRANT])).error).toBeNull();
      expect((await attempt(audit, [A, B_GRANT])).error).toMatch(/foreign key/);
    });
    await db.query(audit, [A, A_GRANT]);
    try {
      await expect(
        db.query('DELETE FROM platform_access WHERE id = $1', [A_GRANT]),
      ).rejects.toThrow(/foreign key/);
    } finally {
      await db.query("DELETE FROM audit_log WHERE action = 'support.read' AND tenant_id = $1", [A]);
    }
  });
});
