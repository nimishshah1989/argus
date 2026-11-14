import { readFileSync, readdirSync } from 'node:fs';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Pool } from 'pg';
import { installJobSchema } from '../../../packages/db/src/install-jobs.js';

const MIGRATIONS = new URL('../../../packages/db/migrations/', import.meta.url);

/** Every migration file, in filename order (so new migrations are applied automatically). */
function migrationFiles(through?: string): string[] {
  return readdirSync(MIGRATIONS)
    .filter((name) => name.endsWith('.sql') && (through === undefined || name <= through))
    .sort();
}

/** Test-only credential for the `app_api` login role (set via ALTER ROLE after migration). */
export const APP_API_PASSWORD = 'app-api-test-password';

/** Test-only credential for `uptimo_router`, a login that is a member of `app_router` and `app_user`. */
export const ROUTER_PASSWORD = 'router-test-password';

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
  /** Router pool: a non-superuser member of app_router and app_user (ROUTER_DATABASE_URL, import undo). */
  router: Pool;
  routerUrl: string;
  stop: () => Promise<void>;
}

/**
 * Boots a Testcontainers Postgres, applies every migration (or those up to `through`) as the superuser, flips
 * `app_api` to a login role, and returns two pools: an `admin` pool (seeding/direct
 * assertions) and an `app` pool (the role the server really uses).
 */
export async function startTestDb(options: { through?: string } = {}): Promise<TestDb> {
  const container = await new PostgreSqlContainer('postgres:16-alpine').start();
  const admin = new Pool({ connectionString: container.getConnectionUri(), max: 5 });
  const beginAdmin = tolerateShutdown(admin);
  for (const file of migrationFiles(options.through)) {
    await admin.query(readFileSync(new URL(file, MIGRATIONS), 'utf8'));
  }
  await installJobSchema(admin);
  await admin.query(`ALTER ROLE app_api LOGIN PASSWORD '${APP_API_PASSWORD}'`);
  await admin.query(`CREATE ROLE uptimo_router LOGIN PASSWORD '${ROUTER_PASSWORD}'`);
  await admin.query('GRANT app_router, app_user TO uptimo_router');
  const target = `${container.getHost()}:${container.getPort()}/${container.getDatabase()}`;
  const app = new Pool({
    connectionString: `postgresql://app_api:${APP_API_PASSWORD}@${target}`,
    max: 5,
  });
  const routerUrl = `postgresql://uptimo_router:${ROUTER_PASSWORD}@${target}`;
  const router = new Pool({ connectionString: routerUrl, max: 5 });
  const beginRouter = tolerateShutdown(router);
  const beginApp = tolerateShutdown(app);
  return {
    container,
    admin,
    app,
    router,
    routerUrl,
    stop: async () => {
      beginAdmin();
      beginApp();
      beginRouter();
      await admin.end();
      await app.end();
      await router.end();
      await container.stop();
    },
  };
}
