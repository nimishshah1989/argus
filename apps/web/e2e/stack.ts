import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import type { ChildProcess } from 'node:child_process';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Pool } from 'pg';
import { installJobSchema } from '../../../packages/db/src/install-jobs.js';
import { API_PORT, API_URL, E2E_PASSWORD, WEB_PORT, WEB_URL } from './fixtures.js';
import { assertPortFree, killPid, removeContainer, spawnLogged, waitForHttp } from './processes.js';

/**
 * Boots the real stack for the e2e run: a postgres:16-alpine Testcontainer, migrated (each Playwright
 * worker seeds its own tenant in test.ts), the Fastify API on :3001 and the Vite dev server on :3000.
 * The stack is started from globalSetup because Playwright starts `webServer` entries
 * before globalSetup, so a webServer could never receive the container's DATABASE_URL.
 */

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const STATE_DIR = resolve(ROOT, 'test-results/e2e');
const STATE_FILE = join(STATE_DIR, 'stack.json');
const MIGRATIONS = resolve(ROOT, 'packages/db/migrations');
const APP_API_USER = 'app_api';
const APP_API_PASSWORD = 'app-api-e2e-password';
const TSX_CLI = resolve(ROOT, 'node_modules/tsx/dist/cli.mjs');
const VITE_CLI = resolve(ROOT, 'apps/web/node_modules/vite/bin/vite.js');
const API_LOG = join(STATE_DIR, 'api.log');
const WEB_LOG = join(STATE_DIR, 'web.log');

export interface StackHandles {
  container: StartedPostgreSqlContainer;
  api: ChildProcess;
  web: ChildProcess;
}

interface StackState {
  containerId: string;
  apiPid: number;
  webPid: number;
}

type Argon2 = {
  hash(
    input: string,
    options: { algorithm: number; memoryCost: number; timeCost: number; parallelism: number },
  ): Promise<string>;
};

/** Argon2id options matching apps/server/src/auth.ts; loaded from the server's own dependency. */
function hashPassword(): Promise<string> {
  const requireFromServer = createRequire(resolve(ROOT, 'apps/server/package.json'));
  const argon2 = requireFromServer('@node-rs/argon2') as Argon2;
  return argon2.hash(E2E_PASSWORD, {
    algorithm: 2,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
}

interface Database {
  container: StartedPostgreSqlContainer;
  /** The app_api connection URL the server runs as, so RLS is exercised on the real path (C1). */
  appUrl: string;
}

function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS)
    .filter((name) => name.endsWith('.sql'))
    .sort();
}

async function startDatabase(): Promise<Database> {
  const container = await new PostgreSqlContainer('postgres:16-alpine')
    .withStartupTimeout(180_000)
    .start();
  const pool = new Pool({ connectionString: container.getConnectionUri(), max: 2 });
  try {
    for (const file of migrationFiles()) {
      await pool.query(readFileSync(join(MIGRATIONS, file), 'utf8'));
    }
    await installJobSchema(pool);
    await pool.query(`ALTER ROLE ${APP_API_USER} LOGIN PASSWORD '${APP_API_PASSWORD}'`);
    process.env.E2E_ADMIN_DATABASE_URL = container.getConnectionUri();
    process.env.E2E_PASSWORD_HASH = await hashPassword();
  } catch (error) {
    await container.stop().catch(() => undefined);
    throw error;
  } finally {
    await pool.end();
  }
  const appUrl = `postgresql://${APP_API_USER}:${APP_API_PASSWORD}@${container.getHost()}:${container.getPort()}/${container.getDatabase()}`;
  return { container, appUrl };
}

function startApi(databaseUrl: string): ChildProcess {
  return spawnLogged([TSX_CLI, 'apps/server/src/index.ts'], {
    cwd: ROOT,
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
      PORT: String(API_PORT),
      DEFAULT_TENANT_SLUG: 'e2e-unscoped',
      NODE_ENV: 'test',
    },
    logFile: API_LOG,
  });
}

function startWeb(): ChildProcess {
  return spawnLogged(
    [
      VITE_CLI,
      '--config',
      'e2e/vite.e2e.config.ts',
      '--host',
      '127.0.0.1',
      '--port',
      String(WEB_PORT),
      '--strictPort',
      '--clearScreen',
      'false',
    ],
    {
      cwd: resolve(ROOT, 'apps/web'),
      env: { ...process.env, BROWSER: 'none' },
      logFile: WEB_LOG,
    },
  );
}

export async function startStack(): Promise<StackHandles> {
  await stopStackFromState();
  for (const port of [API_PORT, WEB_PORT]) await assertPortFree(port);
  mkdirSync(STATE_DIR, { recursive: true });
  const database = await startDatabase();
  let api: ChildProcess | undefined;
  let web: ChildProcess | undefined;
  try {
    api = startApi(database.appUrl);
    await waitForHttp(`${API_URL}/api/v1/health`, api, API_LOG);
    web = startWeb();
    await waitForHttp(`${WEB_URL}/`, web, WEB_LOG);
    await waitForHttp(`${WEB_URL}/api/v1/health`, web, WEB_LOG);
    return { container: database.container, api, web };
  } catch (error) {
    if (web) await killPid(web.pid ?? 0);
    if (api) await killPid(api.pid ?? 0);
    await database.container.stop().catch(() => undefined);
    throw error;
  }
}

export function writeStackState(handles: StackHandles): void {
  const state: StackState = {
    containerId: handles.container.getId(),
    apiPid: handles.api.pid ?? 0,
    webPid: handles.web.pid ?? 0,
  };
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function readStackState(): StackState | null {
  try {
    return JSON.parse(readFileSync(STATE_FILE, 'utf8')) as StackState;
  } catch {
    return null;
  }
}

export function clearStackState(): void {
  rmSync(STATE_FILE, { force: true });
}

/** Stops the API and the web server, then the container. Safe to call twice. */
export async function stopStack(handles: StackHandles): Promise<void> {
  await killPid(handles.web.pid ?? 0);
  await killPid(handles.api.pid ?? 0);
  await handles.container.stop().catch(() => undefined);
  clearStackState();
}

/** Fallback teardown: stops whatever a previous (crashed) run left behind. */
export async function stopStackFromState(): Promise<void> {
  const state = readStackState();
  if (!state) return;
  clearStackState();
  await killPid(state.webPid);
  await killPid(state.apiPid);
  removeContainer(state.containerId);
}
