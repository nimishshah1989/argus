import { readFileSync } from 'node:fs';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Pool } from 'pg';
import { afterAll, afterEach, beforeAll, expect, it } from 'vitest';
import { endPool } from './end-pool.js';

const MIGRATIONS = new URL('../migrations/', import.meta.url);
let container: StartedPostgreSqlContainer;
let pool: Pool;

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
    await pool.query(readFileSync(new URL(name, MIGRATIONS), 'utf8'));
  }
  await pool.query(
    "INSERT INTO tenant (id, slug, name) VALUES ('50000000-0000-0000-0000-000000000010', 'unresolved-sla', 'Unresolved')",
  );
  await pool.query(
    `INSERT INTO ticket (id, tenant_id, ref, kind, status, problem, reported_at, severity)
     VALUES ('50000000-0000-0000-0000-000000000011', '50000000-0000-0000-0000-000000000010',
       'BD-1', 'stopped', 'open', 'Unknown pause', now(), 'S3')`,
  );
}, 120_000);

afterEach(async () => {
  await pool.query('DELETE FROM ticket_event');
});

afterAll(async () => {
  await endPool(pool);
  await container.stop();
});

it('0007 aborts atomically instead of defaulting an unresolved pause flag', async () => {
  await pool.query(
    `INSERT INTO ticket_event (tenant_id, ticket_id, seq, type, payload)
     VALUES ('50000000-0000-0000-0000-000000000010', '50000000-0000-0000-0000-000000000011',
       1, 'pause', '{"reason":"deleted-reason"}')`,
  );
  await expect(
    pool.query(readFileSync(new URL('0007_sla_policy_timer.sql', MIGRATIONS), 'utf8')),
  ).rejects.toThrow(/unresolved legacy pause reason/);
  const tables = await pool.query(
    "SELECT to_regclass('public.sla_policy') AS policy, to_regclass('public.sla_timer') AS timer",
  );
  expect(tables.rows[0]).toEqual({ policy: null, timer: null });
  const event = await pool.query('SELECT payload FROM ticket_event');
  expect(event.rows[0].payload).not.toHaveProperty('pausesSla');
});

it.each(['null', '"true"'])('0007 rejects a non-boolean pause snapshot %s', async (value) => {
  await pool.query(
    `INSERT INTO ticket_event (tenant_id, ticket_id, seq, type, payload)
     VALUES ('50000000-0000-0000-0000-000000000010', '50000000-0000-0000-0000-000000000011',
       1, 'pause', $1::jsonb)`,
    [`{"reason":"spare","pausesSla":${value}}`],
  );
  await expect(
    pool.query(readFileSync(new URL('0007_sla_policy_timer.sql', MIGRATIONS), 'utf8')),
  ).rejects.toThrow(/unresolved legacy pause reason/);
  const tables = await pool.query(
    "SELECT to_regclass('public.sla_policy') AS policy, to_regclass('public.sla_timer') AS timer",
  );
  expect(tables.rows[0]).toEqual({ policy: null, timer: null });
  const event = await pool.query('SELECT payload FROM ticket_event');
  expect(event.rows[0].payload.pausesSla).toEqual(JSON.parse(value));
});
