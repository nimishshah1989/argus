import { readFileSync } from 'node:fs';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Pool } from 'pg';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { endPool } from './end-pool.js';

const MIGRATIONS = new URL('../migrations/', import.meta.url);
const TENANT = '50000000-0000-0000-0000-000000000001';
const TICKET = '50000000-0000-0000-0000-000000000002';

let container: StartedPostgreSqlContainer;
let pool: Pool;

function migration(name: string): string {
  return readFileSync(new URL(name, MIGRATIONS), 'utf8');
}

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:16-alpine').start();
  pool = new Pool({ connectionString: container.getConnectionUri(), max: 2 });
  for (const name of [
    '0001_schema_v1.sql',
    '0002_app_api_role.sql',
    '0003_command_idempotency_binding.sql',
    '0004_cancel_time.sql',
    '0005_ticket_tag.sql',
    '0006_severity_matrix.sql',
  ]) {
    await pool.query(migration(name));
  }
  await pool.query("INSERT INTO tenant (id, slug, name) VALUES ($1, 'legacy-sla', 'Legacy SLA')", [
    TENANT,
  ]);
  await pool.query(
    `INSERT INTO list_item (tenant_id, list, code, label, pauses_sla)
     VALUES ($1, 'wait_reason', 'spare', 'Waiting for spare', true)`,
    [TENANT],
  );
  await pool.query(
    `INSERT INTO ticket (id, tenant_id, ref, kind, status, problem, reported_at, severity)
     VALUES ($2, $1, 'BD-1', 'stopped', 'open', 'Legacy pause', now(), 'S3')`,
    [TENANT, TICKET],
  );
  await pool.query(
    `INSERT INTO ticket_event (tenant_id, ticket_id, seq, type, payload) VALUES
       ($1, $2, 1, 'pause', '{"reason":"spare","isVendor":false}'),
       ($1, $2, 2, 'pause', '{"reason":"spare","isVendor":false,"pausesSla":false}')`,
    [TENANT, TICKET],
  );
}, 120_000);

afterAll(async () => {
  await endPool(pool);
  await container.stop();
});

it('0007 preserves explicit pause snapshots, backfills missing flags, and creates SLA tables', async () => {
  await pool.query('CREATE TABLE ticket_event_backup_0007 AS TABLE ticket_event');
  await pool.query(migration('0007_sla_policy_timer.sql'));

  const events = await pool.query(
    'SELECT seq, payload FROM ticket_event WHERE ticket_id = $1 ORDER BY seq',
    [TICKET],
  );
  expect(events.rows[0].payload).toMatchObject({ reason: 'spare', pausesSla: true });
  expect(events.rows[1].payload).toMatchObject({ reason: 'spare', pausesSla: false });

  const policyColumns = await pool.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'sla_policy'`,
  );
  expect(policyColumns.rows.map((row) => row.column_name)).toEqual(
    expect.arrayContaining(['pause_max_minutes', 'handback_minutes', 'business_hours_only']),
  );
  const timerColumns = await pool.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'sla_timer'`,
  );
  expect(timerColumns.rows.map((row) => row.column_name)).toEqual(
    expect.arrayContaining(['job_id', 'revision', 'stop_reason', 'fired_at']),
  );
  const router = await pool.query('SELECT * FROM tenants_with_sla_policies()');
  expect(router.rows).toEqual([]);
  await pool.query('DROP TABLE ticket_event_backup_0007');
});

it('0007 enforces positive policies, timer shapes, revisions, and tenant-safe foreign keys', async () => {
  const otherTenant = '50000000-0000-0000-0000-000000000003';
  const otherPolicy = '50000000-0000-0000-0000-000000000004';
  await pool.query("INSERT INTO tenant (id, slug, name) VALUES ($1, 'other-sla', 'Other')", [
    otherTenant,
  ]);
  await pool.query(
    `INSERT INTO sla_policy (id, tenant_id, severity, ack_minutes, restore_minutes)
     VALUES ($1, $2, 'S1', 5, 30)`,
    [otherPolicy, otherTenant],
  );
  await expect(
    pool.query('UPDATE ticket SET sla_policy_id=$1 WHERE id=$2', [otherPolicy, TICKET]),
  ).rejects.toThrow(/ticket_sla_policy_tenant_fk/);
  await expect(
    pool.query(
      `INSERT INTO sla_policy (tenant_id, severity, ack_minutes, restore_minutes)
       VALUES ($1, 'S2', 0, 30)`,
      [TENANT],
    ),
  ).rejects.toThrow(/ack_minutes/);
  await expect(
    pool.query(
      `INSERT INTO sla_policy (tenant_id, severity, ack_minutes, restore_minutes, pause_max_minutes)
       VALUES ($1, 'S2', 5, 30, 0)`,
      [TENANT],
    ),
  ).rejects.toThrow(/pause_max_minutes/);
  await expect(
    pool.query(
      `INSERT INTO sla_timer (tenant_id, ticket_id, kind, due_at, state, revision)
       VALUES ($1, $2, 'ack', now(), 'running', 1)`,
      [otherTenant, TICKET],
    ),
  ).rejects.toThrow(/sla_timer_ticket_tenant_fk/);
  await expect(
    pool.query(
      `INSERT INTO sla_timer (tenant_id, ticket_id, kind, state, revision)
       VALUES ($1, $2, 'ack', 'running', 1)`,
      [TENANT, TICKET],
    ),
  ).rejects.toThrow(/sla_timer_due_required/);
  await expect(
    pool.query(
      `INSERT INTO sla_timer (tenant_id, ticket_id, kind, state, revision)
       VALUES ($1, $2, 'ack', 'paused', 1)`,
      [TENANT, TICKET],
    ),
  ).rejects.toThrow(/sla_timer_paused_shape/);
  await expect(
    pool.query(
      `INSERT INTO sla_timer (tenant_id, ticket_id, kind, due_at, state, stopped_at, stop_reason, revision)
       VALUES ($1, $2, 'restore', now(), 'stopped', now(), 'started', 1)`,
      [TENANT, TICKET],
    ),
  ).rejects.toThrow(/sla_timer_stop_reason_kind/);
  await expect(
    pool.query(
      `INSERT INTO sla_timer (tenant_id, ticket_id, kind, due_at, state, revision)
       VALUES ($1, $2, 'ack', now(), 'running', 0)`,
      [TENANT, TICKET],
    ),
  ).rejects.toThrow(/revision/);
});
