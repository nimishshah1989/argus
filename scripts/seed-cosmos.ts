import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Pool, PoolClient } from 'pg';
import { buildSeed, type ListSeed, type MachineSeed, type PersonSeed } from './seed-data.js';

interface Paths {
  exportPath: string;
  livePath: string;
  glossaryPath: string;
}

export interface SeedReport {
  counts: Record<string, number>;
  conflicts: string[];
  sources: string[];
}

function loadJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

async function insertMachines(
  client: PoolClient,
  tenantId: string,
  segmentIds: Map<string, string>,
  machines: MachineSeed[],
) {
  for (const m of machines) {
    await client.query(
      `INSERT INTO machine (tenant_id, code, segment_id, category, make, model, serial, controller, controller_model, controller_serial, year, purchased_on, power_kw, location, cell, asset_code, capacity_kva)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
      [
        tenantId,
        m.code,
        segmentIds.get(m.segment),
        m.category,
        m.make,
        m.model,
        m.serial,
        m.controller,
        m.controllerModel,
        m.controllerSerial,
        m.year,
        m.purchasedOn,
        m.powerKw,
        m.location,
        m.cell,
        m.assetCode,
        m.capacityKva,
      ],
    );
  }
}

async function insertPeople(client: PoolClient, tenantId: string, people: PersonSeed[]) {
  for (const person of people) {
    await client.query(
      'INSERT INTO person (tenant_id, name, team, kind, active) VALUES ($1, $2, $3, $4, true)',
      [tenantId, person.name, person.team, person.kind],
    );
  }
}

async function insertListItems(client: PoolClient, tenantId: string, lists: ListSeed[]) {
  for (const item of lists) {
    await client.query(
      'INSERT INTO list_item (tenant_id, list, code, label, sort, active, is_vendor, pauses_sla) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      [
        tenantId,
        item.list,
        item.code,
        item.label,
        0,
        item.active,
        item.isVendor ?? false,
        item.pausesSla ?? false,
      ],
    );
  }
}

async function insertSegments(client: PoolClient, tenantId: string): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  for (const [index, code] of [
    'CNC',
    'Conventional',
    'Process',
    'Utility',
    'DG',
    'Robot',
  ].entries()) {
    const row = (
      await client.query(
        'INSERT INTO segment (tenant_id, code, name, sort, group_by) VALUES ($1, $2, $2, $3, $4) RETURNING id',
        [tenantId, code, index, code === 'CNC' ? 'letters' : 'category'],
      )
    ).rows[0] as { id: string };
    ids.set(code, row.id);
  }
  return ids;
}

async function insertSettings(client: PoolClient, tenantId: string, teamShifts: unknown) {
  const settings: Array<[string, unknown]> = [
    ['features', { general: true, pause: true, floorLive: false }],
    ['language', 'gu'],
    ['prod_hours_per_day', 20],
    ['work_days_per_year', 300],
    ['efficiency_factor', 15],
    ['why_why_threshold_hours', 24],
    ['team_shifts', teamShifts],
  ];
  for (const [key, value] of settings) {
    await client.query('INSERT INTO setting (tenant_id, key, value) VALUES ($1, $2, $3)', [
      tenantId,
      key,
      JSON.stringify(value),
    ]);
  }
}

export async function seedCosmos(pool: Pool, paths: Paths): Promise<SeedReport> {
  const exp = loadJson<Record<string, unknown>>(paths.exportPath);
  const live = loadJson<Record<string, unknown>>(paths.livePath);
  const glossary = loadJson<Record<string, unknown>>(paths.glossaryPath);
  const seed = buildSeed(exp, live, glossary);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("DELETE FROM tenant WHERE slug = 'cosmos'");
    const tenant = (
      await client.query(
        "INSERT INTO tenant (slug, name, language, time_zone) VALUES ('cosmos', 'Cosmos', 'gu', 'Asia/Kolkata') RETURNING id",
      )
    ).rows[0] as { id: string };
    const segmentIds = await insertSegments(client, tenant.id);
    await insertMachines(client, tenant.id, segmentIds, seed.machines);
    await insertPeople(client, tenant.id, seed.people);
    await insertListItems(client, tenant.id, seed.lists);
    for (const shift of seed.shifts) {
      await client.query(
        'INSERT INTO shift (tenant_id, code, name, starts_at, ends_at, crosses_midnight) VALUES ($1, $2, $3, $4, $5, $6)',
        [tenant.id, shift.code, shift.name, shift.startsAt, shift.endsAt, shift.crossesMidnight],
      );
    }
    await insertSettings(
      client,
      tenant.id,
      (live.client as { teamShifts?: unknown }).teamShifts ?? {},
    );
    for (const term of seed.glossaryTerms) {
      await client.query(
        'INSERT INTO glossary_term (tenant_id, source, english, direction) VALUES ($1, $2, $3, $4)',
        [tenant.id, term.source, term.english, term.direction],
      );
    }
    await client.query(
      "INSERT INTO ref_counter (tenant_id, prefix, next_value) VALUES ($1, 'BD', 150), ($1, 'WR', 99)",
      [tenant.id],
    );
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
    sources: [paths.exportPath, paths.livePath, paths.glossaryPath],
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
  };
  const report = await seedCosmos(pool, paths);
  await pool.end();
  const sources = [
    'docs/discovery/source/cosmos-platform-export-2026-10-28.json',
    'docs/discovery/bhavin-v3/live-config-2026-11-09.json',
    'docs/discovery/bhavin-v3/glossary-2026-11-09.json',
  ];
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
