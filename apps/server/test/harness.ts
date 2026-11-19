import { randomBytes } from 'node:crypto';
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

/** The part of a database server the tests read: its address and the superuser URL. */
export interface DbEndpoint {
  getHost(): string;
  getPort(): number;
  getDatabase(): string;
  getConnectionUri(): string;
}

export interface TestDb {
  container: DbEndpoint;
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
 * `TEST_PG_URL` (a superuser URL of a Postgres 16 server) lets a machine without Docker run the suites: each
 * `startTestDb` makes a fresh database on that server and drops it on `stop`. Unset, CI keeps Testcontainers.
 */
interface Provisioned {
  endpoint: DbEndpoint;
  /** Runs the setup that touches server-wide roles; on a shared server one file at a time. */
  setup: (work: () => Promise<void>) => Promise<void>;
  drop: () => Promise<void>;
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

/** Setup resets role passwords on the server it uses, so `TEST_PG_URL` may only name this machine. */
export function assertLocalServer(serverUrl: string): void {
  let host: string;
  try {
    host = new URL(serverUrl).hostname;
  } catch {
    throw new Error('TEST_PG_URL is not a valid URL');
  }
  if (!LOCAL_HOSTS.has(host)) {
    throw new Error(
      `TEST_PG_URL must name a server on this machine (localhost, 127.0.0.1 or ::1), not "${host}": the test setup resets role passwords`,
    );
  }
}

async function freshLocalDatabase(serverUrl: string): Promise<Provisioned> {
  assertLocalServer(serverUrl);
  const name = `argus_test_${randomBytes(6).toString('hex')}`;
  const server = new Pool({ connectionString: serverUrl, max: 1 });
  await server.query(`CREATE DATABASE ${name}`);
  const url = new URL(serverUrl);
  url.pathname = `/${name}`;
  return {
    setup: async (work) => {
      const lock = await server.connect();
      try {
        await lock.query('SELECT pg_advisory_lock(6901)');
        await work();
      } finally {
        await lock.query('SELECT pg_advisory_unlock(6901)').catch(() => undefined);
        lock.release();
      }
    },
    endpoint: {
      getHost: () => url.hostname,
      getPort: () => Number(url.port || 5432),
      getDatabase: () => name,
      getConnectionUri: () => url.toString(),
    },
    drop: async () => {
      try {
        await server.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
      } finally {
        await server.end();
      }
    },
  };
}

async function provision(): Promise<Provisioned> {
  const serverUrl = process.env.TEST_PG_URL;
  if (serverUrl) return freshLocalDatabase(serverUrl);
  const container: StartedPostgreSqlContainer = await new PostgreSqlContainer(
    'postgres:16-alpine',
  ).start();
  return {
    endpoint: container,
    setup: (work) => work(),
    drop: () => container.stop().then(() => undefined),
  };
}

/**
 * Boots a Testcontainers Postgres, applies every migration (or those up to `through`) as the superuser, flips
 * `app_api` to a login role, and returns two pools: an `admin` pool (seeding/direct
 * assertions) and an `app` pool (the role the server really uses).
 */
export async function startTestDb(options: { through?: string } = {}): Promise<TestDb> {
  const { endpoint: container, setup, drop } = await provision();
  const admin = new Pool({ connectionString: container.getConnectionUri(), max: 5 });
  const beginAdmin = tolerateShutdown(admin);
  try {
    await setup(async () => {
      for (const file of migrationFiles(options.through)) {
        await admin.query(readFileSync(new URL(file, MIGRATIONS), 'utf8'));
      }
      await installJobSchema(admin);
      await admin.query(`ALTER ROLE app_api LOGIN PASSWORD '${APP_API_PASSWORD}'`);
      // Roles belong to the server, not the database: a shared local server already has this one.
      await admin.query(`DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'uptimo_router') THEN
          CREATE ROLE uptimo_router LOGIN;
        END IF;
      END $$`);
      await admin.query(`ALTER ROLE uptimo_router LOGIN PASSWORD '${ROUTER_PASSWORD}'`);
      await admin.query('GRANT app_router, app_user TO uptimo_router');
    });
  } catch (error) {
    await admin.end().catch(() => undefined);
    await drop().catch(() => undefined);
    throw error;
  }
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
      await drop();
    },
  };
}
