import { readFileSync, writeFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { Pool } from 'pg';
import {
  deleteTenantBySlug,
  hashPassword,
  insertPeople,
  insertTenant,
} from '../modules/identity/index.js';
import {
  insertGlossaryTerms,
  insertListItems,
  insertMachines,
  insertSegments,
  insertSettings,
  insertShifts,
} from '../modules/plant/seed.js';
import { initRefCounters } from '../modules/tickets/index.js';
import { buildSeed, type SeedFiles } from './cosmos-data.js';

interface Paths {
  exportPath: string;
  livePath: string;
  glossaryPath: string;
  peoplePath?: string;
}

export const SEED_FILES = {
  machines: fileURLToPath(new URL('./generated/cosmos-machines.json', import.meta.url)),
  shifts: fileURLToPath(new URL('./cosmos-shifts.json', import.meta.url)),
  peopleFixture: fileURLToPath(new URL('./fixtures/cosmos-people.fixture.json', import.meta.url)),
};

/** For dev and CI only: the fixture people file is fake. */
export const FIXTURE_PASSWORD = 'fixture-only-password';

export interface SeedReport {
  counts: Record<string, number>;
  conflicts: string[];
  sources: string[];
}

const SEGMENT_CODES = ['CNC', 'Conventional', 'Process', 'Utility', 'DG', 'Robot'];

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
  };
  return buildSeed(
    loadJson(paths.exportPath),
    loadJson(paths.livePath),
    loadJson(paths.glossaryPath),
    files,
  );
}

export async function seedCosmos(
  pool: Pool,
  paths: Paths,
  initialPassword?: string,
): Promise<SeedReport> {
  if (paths.peoplePath && !initialPassword)
    throw new Error('seed: SEED_INITIAL_PASSWORD is required with a people file');
  const seed = buildFromFiles(paths);
  const passwordHash = await hashPassword(paths.peoplePath ? initialPassword! : FIXTURE_PASSWORD);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await deleteTenantBySlug(client, 'cosmos');
    const tenantId = await insertTenant(client, {
      slug: 'cosmos',
      name: 'Cosmos',
      language: 'gu',
      timeZone: 'Asia/Kolkata',
    });
    const segmentIds = await insertSegments(client, tenantId, SEGMENT_CODES);
    await insertMachines(client, tenantId, segmentIds, seed.machines);
    await insertPeople(client, tenantId, seed.people, passwordHash);
    await insertListItems(client, tenantId, seed.lists);
    await insertShifts(client, tenantId, seed.shifts);
    await insertSettings(client, tenantId, settingsFor(seed.teamShifts));
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
    conflicts: seed.conflicts,
    sources: [
      paths.exportPath,
      paths.livePath,
      paths.glossaryPath,
      SEED_FILES.machines,
      SEED_FILES.shifts,
      paths.peoplePath ? 'people file (outside repo)' : SEED_FILES.peopleFixture,
    ],
  };
}

async function main(): Promise<void> {
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
  const report = await seedCosmos(pool, paths, process.env.SEED_INITIAL_PASSWORD);
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
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
