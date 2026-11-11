import { readFileSync } from 'node:fs';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Pool } from 'pg';
import { afterAll, beforeAll, expect, it } from 'vitest';

const MIGRATIONS = new URL('../migrations/', import.meta.url);
const TENANT = '40000000-0000-0000-0000-000000000001';
const MACHINE_A = '40000000-0000-0000-0000-000000000002';
const MACHINE_C = '40000000-0000-0000-0000-000000000003';
const MACHINE_UNSET = '40000000-0000-0000-0000-000000000004';

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
  ]) {
    await pool.query(migration(name));
  }
  await pool.query("INSERT INTO tenant (id, slug, name) VALUES ($1, 'legacy', 'Legacy')", [TENANT]);
  await pool.query(
    `INSERT INTO machine (id, tenant_id, code, criticality) VALUES
      ($1, $4, 'VC-A', 'A'), ($2, $4, 'VC-C', 'C'), ($3, $4, 'VC-N', NULL)`,
    [MACHINE_A, MACHINE_C, MACHINE_UNSET, TENANT],
  );
  await pool.query(
    `INSERT INTO ticket (tenant_id, ref, kind, status, machine_id, problem, reported_at, urgent, severity, criticality_snapshot) VALUES
      ($1, 'BD-1', 'stopped', 'closed', $2, 'A stopped', now(), false, NULL, NULL),
      ($1, 'BD-2', 'support', 'closed', $3, 'C support', now(), false, NULL, NULL),
      ($1, 'BD-3', 'stopped', 'closed', $4, 'Unset criticality', now(), false, NULL, NULL),
      ($1, 'WR-1', 'general', 'closed', NULL, 'Urgent request', now(), true, NULL, NULL),
      ($1, 'WR-2', 'general', 'closed', NULL, 'Normal request', now(), false, NULL, NULL),
      ($1, 'BD-4', 'stopped', 'closed', $3, 'Already explicit', now(), false, 'S2', 'B')`,
    [TENANT, MACHINE_A, MACHINE_C, MACHINE_UNSET],
  );
}, 120_000);

afterAll(async () => {
  await pool.end();
  await container.stop();
});

it('0006 backs up, backfills, preserves explicit values, and enforces the contract', async () => {
  // The deployment plan's backup step, exercised against the disposable legacy DB.
  await pool.query('CREATE TABLE ticket_backup_0006 AS TABLE ticket');
  await pool.query(migration('0006_severity_matrix.sql'));
  const result = await pool.query(
    'SELECT ref, severity, criticality_snapshot FROM ticket WHERE tenant_id = $1 ORDER BY ref',
    [TENANT],
  );
  expect(result.rows).toEqual([
    { ref: 'BD-1', severity: 'S1', criticality_snapshot: 'A' },
    { ref: 'BD-2', severity: 'S4', criticality_snapshot: 'C' },
    { ref: 'BD-3', severity: 'S3', criticality_snapshot: null },
    { ref: 'BD-4', severity: 'S2', criticality_snapshot: 'B' },
    { ref: 'WR-1', severity: 'S3', criticality_snapshot: null },
    { ref: 'WR-2', severity: 'S4', criticality_snapshot: null },
  ]);

  const backup = await pool.query('SELECT count(*)::int AS n FROM ticket_backup_0006');
  expect(backup.rows[0].n).toBe(6);
  await expect(
    pool.query(
      `INSERT INTO ticket (tenant_id, ref, kind, status, problem, reported_at, severity)
       VALUES ($1, 'BAD-1', 'stopped', 'open', 'Invalid severity', now(), 'S5')`,
      [TENANT],
    ),
  ).rejects.toThrow(/ticket_severity_check/);
  await expect(
    pool.query(
      `INSERT INTO ticket (tenant_id, ref, kind, status, problem, reported_at, severity, criticality_snapshot)
       VALUES ($1, 'BAD-2', 'stopped', 'open', 'Invalid snapshot', now(), 'S1', 'D')`,
      [TENANT],
    ),
  ).rejects.toThrow(/ticket_criticality_snapshot_check/);
  await expect(
    pool.query(
      `INSERT INTO ticket (tenant_id, ref, kind, status, problem, reported_at)
       VALUES ($1, 'BAD-3', 'stopped', 'open', 'Missing severity', now())`,
      [TENANT],
    ),
  ).rejects.toThrow(/null value|not-null/i);
  await pool.query('DROP TABLE ticket_backup_0006');
});
