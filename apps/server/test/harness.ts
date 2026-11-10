import { readFileSync } from 'node:fs';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Pool } from 'pg';

/** Test-only credential for the `app_api` login role (set via ALTER ROLE after migration). */
export const APP_API_PASSWORD = 'app-api-test-password';

export interface TestDb {
  container: StartedPostgreSqlContainer;
  /** Superuser pool: apply migrations, seed, and run direct assertions (bypasses RLS). */
  admin: Pool;
  /** App pool: connects as `app_api` so RLS is actually exercised. Use for buildApp. */
  app: Pool;
  stop: () => Promise<void>;
}

/**
 * Boots a Testcontainers Postgres, applies every migration as the superuser, flips
 * `app_api` to a login role, and returns two pools: an `admin` pool (seeding/direct
 * assertions) and an `app` pool (the role the server really uses).
 */
export async function startTestDb(): Promise<TestDb> {
  const container = await new PostgreSqlContainer('postgres:16-alpine').start();
  const admin = new Pool({ connectionString: container.getConnectionUri(), max: 5 });
  for (const file of ['0001_schema_v1.sql', '0002_app_api_role.sql']) {
    await admin.query(
      readFileSync(new URL(`../../../packages/db/migrations/${file}`, import.meta.url), 'utf8'),
    );
  }
  await admin.query(`ALTER ROLE app_api LOGIN PASSWORD '${APP_API_PASSWORD}'`);
  const app = new Pool({
    connectionString: `postgresql://app_api:${APP_API_PASSWORD}@${container.getHost()}:${container.getPort()}/${container.getDatabase()}`,
    max: 5,
  });
  return {
    container,
    admin,
    app,
    stop: async () => {
      await admin.end();
      await app.end();
      await container.stop();
    },
  };
}
