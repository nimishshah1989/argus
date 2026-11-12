import { readFileSync, readdirSync } from 'node:fs';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { PgBoss } from 'pg-boss';
import { Pool } from 'pg';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { installJobSchema } from '../src/install-jobs.js';
import { withTenant } from '../src/tenant.js';

const TENANT = '60000000-0000-0000-0000-000000000001';
const PASSWORD = 'jobs-install-test-password';
const MIGRATIONS = new URL('../migrations/', import.meta.url);

let container: StartedPostgreSqlContainer;
let admin: Pool;
let app: Pool;
let boss: PgBoss;

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:16-alpine').start();
  admin = new Pool({ connectionString: container.getConnectionUri(), max: 2 });
  for (const file of readdirSync(MIGRATIONS)
    .filter((name) => name.endsWith('.sql'))
    .sort()) {
    await admin.query(readFileSync(new URL(file, MIGRATIONS), 'utf8'));
  }
  await admin.query(`ALTER ROLE app_api LOGIN PASSWORD '${PASSWORD}'`);
  await installJobSchema(admin);
  const appUrl = `postgresql://app_api:${PASSWORD}@${container.getHost()}:${container.getPort()}/${container.getDatabase()}`;
  app = new Pool({ connectionString: appUrl, max: 2 });
  boss = new PgBoss({
    connectionString: appUrl,
    migrate: false,
    schedule: false,
    supervise: false,
    openTelemetry: { enabled: false },
  });
  await boss.start();
}, 120_000);

afterAll(async () => {
  await boss?.stop();
  await app?.end();
  await admin?.end();
  await container?.stop();
});

it('installs a usable queue and router through the inherited app_api role', async () => {
  await admin.query("INSERT INTO tenant (id, slug, name) VALUES ($1, 'queue-tenant', 'Queue')", [
    TENANT,
  ]);
  await withTenant(app, TENANT, async (client) => {
    await client.query(
      `INSERT INTO sla_policy (tenant_id, severity, ack_minutes, restore_minutes)
       VALUES ($1, 'S1', 5, 30)`,
      [TENANT],
    );
    const tenants = await client.query('SELECT * FROM tenants_with_sla_policies()');
    expect(tenants.rows).toEqual([{ tenant_id: TENANT }]);
  });

  await boss.createQueue('install-probe');
  const id = await boss.send('install-probe', { probe: true });
  expect(id).toMatch(/[0-9a-f-]{36}/);
  const [job] = await boss.fetch('install-probe');
  expect(job?.data).toEqual({ probe: true });
  await boss.complete('install-probe', job!.id);
});
