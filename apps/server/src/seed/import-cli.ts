import { readFileSync, statSync } from 'node:fs';
import type { PoolClient } from 'pg';
import type { PgBoss } from 'pg-boss';
import { createPool } from '../kernel/index.js';
import {
  reconcileSlaPolicies,
  reconcileTicket,
  startJobs,
} from '../modules/accountability/index.js';
import { resolveTenant } from '../modules/identity/index.js';
import {
  CliUsageError,
  IMPORT_LIMITS,
  assertAppApiRole,
  assertProductionAccess,
  assertRouterRole,
  importBhavin,
  importRealExport,
  looksLikeBhavinExport,
  parseCliArgs,
  undoImport,
  type CliCommand,
} from '../modules/imports/index.js';

/**
 * The operator CLI of the importer (`pnpm import:bhavin`, `pnpm import:undo`). It lives here, not in the
 * `imports` module, because it starts the job queue and reconciles SLA timers: it is the one place that may
 * reach both `imports` and `accountability`.
 */

function printUsage(): void {
  console.error('usage: import:bhavin <file.json> --tenant <slug> [--production-confirm]');
  console.error(
    '       import:undo <batchId> --tenant <slug> --operator <name> [--production-confirm]',
  );
}

function readImportFile(command: Extract<CliCommand, { mode: 'import' }>): unknown {
  if (statSync(command.file).size > IMPORT_LIMITS.fileBytes) {
    throw new Error(`Import file exceeds ${IMPORT_LIMITS.fileBytes} bytes`);
  }
  try {
    return JSON.parse(readFileSync(command.file, 'utf8')) as unknown;
  } catch {
    throw new Error('Import file is not valid JSON');
  }
}

async function runUndo(command: Extract<CliCommand, { mode: 'undo' }>): Promise<void> {
  const url = process.env.ROUTER_DATABASE_URL;
  if (!url) throw new Error('ROUTER_DATABASE_URL is required for import:undo');
  const pool = createPool(url);
  try {
    await assertRouterRole(pool);
    const tenant = await resolveTenant(pool, command.tenantSlug);
    if (!tenant) throw new Error(`Unknown tenant: ${command.tenantSlug}`);
    const result = await undoImport(pool, tenant.id, command.batchId, command.operator);
    console.log(JSON.stringify({ batchId: command.batchId, deleted: result.deleted }));
  } finally {
    await pool.end();
  }
}

export async function main(argv = process.argv.slice(2)): Promise<void> {
  let command: CliCommand;
  try {
    command = parseCliArgs(argv);
  } catch (error) {
    if (!(error instanceof CliUsageError)) throw error;
    printUsage();
    process.exitCode = error.exitCode;
    return;
  }
  assertProductionAccess(command, process.env.APP_ENV);
  if (command.mode === 'undo') return runUndo(command);
  const input = readImportFile(command);
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required');
  const pool = createPool(url);
  let jobs: Awaited<ReturnType<typeof startJobs>> | undefined;
  const runtime: { boss?: PgBoss } = {};
  try {
    await assertAppApiRole(pool);
    jobs = await startJobs({
      connectionString: url,
      pool,
      role: 'api',
      reconcileTicket: (client, tenantId, ticketId, now) =>
        reconcileTicket(client, { tenantId, ticketId, now, boss: runtime.boss }),
      onBossReady: (boss) => {
        runtime.boss = boss;
      },
    });
    const tenant = await resolveTenant(pool, command.tenantSlug);
    if (!tenant) throw new Error(`Unknown tenant: ${command.tenantSlug}`);
    const afterImport = (client: PoolClient, tenantId: string) =>
      reconcileSlaPolicies(client, tenantId, runtime.boss);
    const { batchId, stats } = looksLikeBhavinExport(input)
      ? await importRealExport(pool, tenant.id, input, { afterImport })
      : await importBhavin(pool, tenant.id, input, { timeZone: tenant.time_zone, afterImport });
    console.log(JSON.stringify({ batchId, stats }));
    if (stats.status === 'failed') process.exitCode = 1;
  } finally {
    await jobs?.close();
    await pool.end();
  }
}
