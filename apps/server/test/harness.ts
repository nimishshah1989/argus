import { readFileSync, readdirSync } from 'node:fs';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Pool } from 'pg';
import { installJobSchema } from '../../../packages/db/src/install-jobs.js';

const MIGRATIONS = new URL('../../../packages/db/migrations/', import.meta.url);

/** Every migration file, in filename order (so new migrations are applied automatically). */
function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS)
    .filter((name) => name.endsWith('.sql'))
    .sort();
}

/** Test-only credential for the `app_api` login role (set via ALTER ROLE after migration). */
export const APP_API_PASSWORD = 'app-api-test-password';

/**
 * A pool whose backend dies with 57P01 ("terminating connection due to administrator command", a
 * Testcontainer stopping) emits 'error'; with no listener vitest reports "Unhandled Errors" after every
 * test passed. Returns `begin`: call it when teardown starts. Only 57P01 after that is ignored; anything
 * else is re-thrown so a real connection failure still surfaces.
 */
export function tolerateShutdown(pool: Pool): () => void {
  let stopping = false;
  pool.on('error', (error: Error & { code?: string }) => {
    if (stopping && error.code === '57P01') return;
    throw error;
  });
  return () => {
    stopping = true;
  };
}

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
  for (const file of migrationFiles()) {
    await admin.query(readFileSync(new URL(file, MIGRATIONS), 'utf8'));
  }
  await installJobSchema(admin);
  await admin.query(`ALTER ROLE app_api LOGIN PASSWORD '${APP_API_PASSWORD}'`);
  const beginAdmin = tolerateShutdown(admin);
  const app = new Pool({
    connectionString: `postgresql://app_api:${APP_API_PASSWORD}@${container.getHost()}:${container.getPort()}/${container.getDatabase()}`,
    max: 5,
  });
  const beginApp = tolerateShutdown(app);
  return {
    container,
    admin,
    app,
    stop: async () => {
      beginAdmin();
      beginApp();
      await admin.end();
      await app.end();
      await container.stop();
    },
  };
}
