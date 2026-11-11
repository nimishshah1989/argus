import { readFileSync, statSync } from 'node:fs';
import { createPool } from '../db.js';
import { resolveTenant } from '../tenant.js';
import { importBhavin, undoImport } from './bhavin.js';
import {
  CliUsageError,
  assertAppApiRole,
  assertProductionAccess,
  parseCliArgs,
  type CliCommand,
} from './security.js';

const MAX_FILE_BYTES = 5_242_880;

function printUsage(): void {
  console.error('usage: import:bhavin <file.json> --tenant <slug> [--production-confirm]');
  console.error('       import:undo <batchId> --tenant <slug> [--production-confirm]');
}

function readImportFile(command: Extract<CliCommand, { mode: 'import' }>): unknown {
  if (statSync(command.file).size > MAX_FILE_BYTES) {
    throw new Error(`Import file exceeds ${MAX_FILE_BYTES} bytes`);
  }
  try {
    return JSON.parse(readFileSync(command.file, 'utf8')) as unknown;
  } catch {
    throw new Error('Import file is not valid JSON');
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
  const input = command.mode === 'import' ? readImportFile(command) : null;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required');
  const pool = createPool(url);
  try {
    await assertAppApiRole(pool);
    const tenant = await resolveTenant(pool, command.tenantSlug);
    if (!tenant) throw new Error(`Unknown tenant: ${command.tenantSlug}`);
    if (command.mode === 'undo') {
      const result = await undoImport(pool, tenant.id, command.batchId);
      console.log(JSON.stringify({ batchId: command.batchId, deleted: result.deleted }));
      return;
    }
    const { batchId, stats } = await importBhavin(pool, tenant.id, input);
    console.log(JSON.stringify({ batchId, stats }));
    if ('status' in stats && stats.status === 'failed') process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
