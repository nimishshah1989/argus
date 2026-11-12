import { readFileSync } from 'node:fs';
import { Pool } from 'pg';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MissingTenantError, withTenant } from '../src/tenant.js';

const A = '10000000-0000-0000-0000-000000000001';
let container: StartedPostgreSqlContainer;
let pool: Pool;

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:16-alpine').start();
  pool = new Pool({ connectionString: container.getConnectionUri() });
  await pool.query(
    readFileSync(new URL('../migrations/0001_schema_v1.sql', import.meta.url), 'utf8'),
  );
}, 120_000);

afterAll(async () => {
  await pool?.end();
  await container?.stop();
});

describe('withTenant', () => {
  it('sets the tenant inside the transaction', async () => {
    const value = await withTenant(pool, A, async (client) => {
      const result = await client.query("SELECT current_setting('app.tenant_id', true) AS tenant");
      return result.rows[0].tenant as string;
    });
    expect(value).toBe(A);
  });

  it('throws before a query when the tenant is missing', async () => {
    await expect(withTenant(pool, '', async () => undefined)).rejects.toBeInstanceOf(
      MissingTenantError,
    );
  });

  it('fails closed when app_api can bypass RLS', async () => {
    await pool.query("CREATE ROLE app_api LOGIN BYPASSRLS PASSWORD 'unsafe-test-password'");
    const url = new URL(container.getConnectionUri());
    url.username = 'app_api';
    url.password = 'unsafe-test-password';
    const unsafe = new Pool({ connectionString: url.toString() });
    try {
      await expect(withTenant(unsafe, A, async () => undefined)).rejects.toThrow(
        'app_api must not be a superuser or bypass RLS',
      );
    } finally {
      await unsafe.end();
      await pool.query('DROP ROLE app_api');
    }
  });
});
