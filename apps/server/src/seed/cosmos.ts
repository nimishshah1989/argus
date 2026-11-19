import { readFileSync, writeFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { Pool, PoolClient } from 'pg';
import {
  deleteTenantBySlug,
  hashPassword,
  insertPeople,
  insertTenant,
  lockTenantBySlug,
} from '../modules/identity/index.js';
import {
  insertAssetRegisters,
  insertGlossaryTerms,
  insertListItems,
  insertMachines,
  insertPmPlans,
  insertSegments,
  insertSettings,
  insertShifts,
} from '../modules/plant/seed.js';
import { countImportBatches } from '../modules/imports/index.js';
import { countAuditRows } from '../modules/ops/index.js';
import { countTickets, initRefCounters } from '../modules/tickets/index.js';
import { buildSeed, type SeedFiles } from './cosmos-data.js';

interface Paths {
  exportPath: string;
  livePath: string;
  glossaryPath: string;
  peoplePath?: string;
  /** The workbook's PM Plan and PM Reports; the answer-key fixture unless a caller names another. */
  pmPath?: string;
}

export const SEED_FILES = {
  machines: fileURLToPath(new URL('./generated/cosmos-machines.json', import.meta.url)),
  shifts: fileURLToPath(new URL('./cosmos-shifts.json', import.meta.url)),
  peopleFixture: fileURLToPath(new URL('./fixtures/cosmos-people.fixture.json', import.meta.url)),
  pm: fileURLToPath(new URL('../../../../fixtures/answer-key/input.json', import.meta.url)),
  /** The AMC/Warranty and Legal Compliance sheets (51a): one answer-key fixture, read for its register lines. */
  registers: fileURLToPath(new URL('../../../../fixtures/answer-key/input.json', import.meta.url)),
};

/** For dev and CI only: the fixture people file is fake. */
export const FIXTURE_PASSWORD = 'fixture-only-password';

export interface SeedReport {
  counts: Record<string, number>;
  conflicts: string[];
  sources: string[];
}

const SEGMENT_CODES = ['CNC', 'Conventional', 'Process', 'Utility', 'DG', 'Robot'];
const COSMOS_TIME_ZONE = 'Asia/Kolkata';

function settingsFor(teamShifts: Record<string, string>): Array<[string, unknown]> {
  return [
    ['features', { general: true, pause: true, floorLive: false }],
    ['language', 'gu'],
    ['prod_hours_per_day', 20],
    ['work_days_per_year', 300],
    ['efficiency_factor', 15],
    ['why_why_threshold_hours', 24],
    ['team_shifts', teamShifts],
  ];
}

function loadJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

function buildFromFiles(paths: Paths) {
  const files: SeedFiles = {
    machines: loadJson(SEED_FILES.machines),
    shifts: loadJson(SEED_FILES.shifts),
    people: loadJson(paths.peoplePath ?? SEED_FILES.peopleFixture),
    pm: loadJson(paths.pmPath ?? SEED_FILES.pm),
    registers: loadJson(SEED_FILES.registers),
  };
  return buildSeed(
    loadJson(paths.exportPath),
    loadJson(paths.livePath),
    loadJson(paths.glossaryPath),
    files,
  );
}

/**
 * Seeding replaces the whole customer, so it only runs over one that is seed-only: active, and holding no ticket,
 * no import batch (an undone one is the undo's proof) and no audit row. Runs inside the replacing transaction,
 * after the customer's row is locked, so nothing can be added between the check and the delete.
 */
async function assertSeedOnly(client: PoolClient, tenant: { id: string; status: string }) {
  // Row security filters even the owner: count under the customer's own tenant setting.
  await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenant.id]);
  const held: Array<[n: number, one: string, many: string]> = [
    [await countTickets(client, tenant.id), 'ticket', 'tickets'],
    [await countImportBatches(client, tenant.id), 'import batch', 'import batches'],
    [await countAuditRows(client, tenant.id), 'audit row', 'audit rows'],
  ];
  const parts = held.filter(([n]) => n > 0).map(([n, one, many]) => `${n} ${n === 1 ? one : many}`);
  if (tenant.status !== 'active') parts.push(`status ${tenant.status}`);
  if (parts.length > 0)
    throw new Error(
      `seed: Cosmos already holds ${parts.join(', ')}; nothing was changed. ` +
        'Seeding replaces the whole customer, so it only runs on an empty one.',
    );
}

export async function seedCosmos(
  pool: Pool,
  paths: Paths,
  initialPassword?: string,
  options: { replace?: boolean } = {},
): Promise<SeedReport> {
  if (paths.peoplePath && !initialPassword)
    throw new Error('seed: SEED_INITIAL_PASSWORD is required with a people file');
  const seed = buildFromFiles(paths);
  const passwordHash = await hashPassword(paths.peoplePath ? initialPassword! : FIXTURE_PASSWORD);
  const client = await pool.connect();
  let registerConflicts!: string[];
  try {
    await client.query('BEGIN');
    const existing = await lockTenantBySlug(client, 'cosmos');
    if (existing) {
      if (!options.replace) await assertSeedOnly(client, existing);
      await deleteTenantBySlug(client, 'cosmos');
    }
    const tenantId = await insertTenant(client, {
      slug: 'cosmos',
      name: 'Cosmos',
      language: 'gu',
      timeZone: COSMOS_TIME_ZONE,
    });
    // Row security filters every login but a superuser, the database owner on RDS included: name the tenant.
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
    const segmentIds = await insertSegments(client, tenantId, SEGMENT_CODES);
    await insertMachines(client, tenantId, segmentIds, seed.machines);
    registerConflicts = await insertAssetRegisters(client, tenantId, seed.assetRegisters);
    await insertPeople(client, tenantId, seed.people, passwordHash);
    await insertListItems(client, tenantId, seed.lists);
    await insertShifts(client, tenantId, seed.shifts);
    await insertSettings(client, tenantId, settingsFor(seed.teamShifts));
    await insertPmPlans(client, tenantId, seed.pmPlans, COSMOS_TIME_ZONE);
    await insertGlossaryTerms(client, tenantId, seed.glossaryTerms);
    await initRefCounters(client, tenantId);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  return {
    counts: seed.counts,
    conflicts: [...seed.conflicts, ...registerConflicts],
    sources: [
      paths.exportPath,
      paths.livePath,
      paths.glossaryPath,
      SEED_FILES.machines,
      SEED_FILES.shifts,
      paths.pmPath ?? SEED_FILES.pm,
      SEED_FILES.registers,
      paths.peoplePath ? 'people file (outside repo)' : SEED_FILES.peopleFixture,
    ],
  };
}

/** The fixture people are fake and share a password in the repo: never on a shared server. */
export function assertSeedAllowed(
  env: { APP_ENV?: string; SEED_PEOPLE_FILE?: string },
  replace = false,
): void {
  if (replace && env.APP_ENV !== 'staging')
    throw new Error('seed: --replace-cosmos is allowed on staging only');
  if (!env.SEED_PEOPLE_FILE && (env.APP_ENV === 'staging' || env.APP_ENV === 'production'))
    throw new Error(
      'seed: on staging or production set SEED_PEOPLE_FILE; the fixture people are fake',
    );
}

async function main(): Promise<void> {
  const replace = process.argv.includes('--replace-cosmos');
  assertSeedAllowed(process.env, replace);
  const { Pool } = await import('pg');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const paths: Paths = {
    exportPath: resolve(
      process.cwd(),
      'docs/discovery/source/cosmos-platform-export-2026-10-28.json',
    ),
    livePath: resolve(process.cwd(), 'docs/discovery/bhavin-v3/live-config-2026-11-09.json'),
    glossaryPath: resolve(process.cwd(), 'docs/discovery/bhavin-v3/glossary-2026-11-09.json'),
    peoplePath: process.env.SEED_PEOPLE_FILE,
  };
  const report = await seedCosmos(pool, paths, process.env.SEED_INITIAL_PASSWORD, { replace });
  await pool.end();
  const sources = report.sources.map((s) =>
    s.startsWith(process.cwd()) ? relative(process.cwd(), s) : s,
  );
  const lines = [
    '# Seed report — Cosmos',
    '',
    '## Counts',
    ...Object.entries(report.counts).map(([key, value]) => `- ${key}: ${value}`),
    '',
    '## Conflicts',
    ...report.conflicts.map((conflict) => `- ${conflict}`),
    '',
    '## Sources',
    ...sources.map((source) => `- ${source}`),
    '',
  ];
  writeFileSync(resolve(process.cwd(), 'docs/plan/seed-report.md'), lines.join('\n'));
  console.log(lines.join('\n'));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error: unknown) => {
    // Message only: a stack or a raw error object could echo a real value from the people file.
    console.error(error instanceof Error ? error.message : 'seed failed');
    process.exitCode = 1;
  });
}
