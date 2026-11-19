import type { Pool } from 'pg';
import { DEFAULT_PROFILE } from '@uptimo/shared';
import { run, type EngineResult } from '@uptimo/domain';
import { withTenant } from '@uptimo/db';
import { createPool } from '../kernel/index.js';
import { reconcileSlaPolicies } from '../modules/accountability/index.js';
import { loadEngineData } from '../modules/analytics/index.js';
import { activePeople, ensurePendingPerson, resolveTenant } from '../modules/identity/index.js';
import { importBhavin } from '../modules/imports/index.js';
import { ensureLegacyListEntries } from '../modules/plant/index.js';
import type { YearFile } from './legacy-export.js';

/**
 * Ticket 69c: the converter's per-year files (`pnpm import:legacy`) loaded through the real importer, one batch
 * per workbook year in year order, then the engine run once per year. It reaches the importer, plant and analytics
 * modules, so it lives in `seed/` beside `import-cli.ts`. Counts and codes only; no row text is ever returned.
 */
export interface Tenant {
  id: string;
  timeZone: string;
}
export interface LoadedYear {
  year: number;
  batchId: string;
  status: string;
  imported: number;
  skipped: number;
  errored: number;
  /** The list entries added before this year loaded, as `list:code`. */
  added: string[];
  /** The placeholder people made before this year loaded (R8): one per person code the file names and the plant lacks. */
  people: number;
}

/** Every maintenance code a file's tickets and plant-event lines use. */
export function codesOf(json: string): string[] {
  const parsed = JSON.parse(json) as { aliases?: { maintenanceCodes?: Record<string, string> } };
  return Object.keys(parsed.aliases?.maintenanceCodes ?? {});
}

const key = (name: string): string =>
  name.normalize('NFC').trim().replace(/\s+/gu, ' ').toLowerCase();

/**
 * R8: a person code in a file is a person the importer must find, so each one the plant does not hold yet becomes a
 * pending placeholder person named by its code, to merge later. A `P-` code names an existing person and is never made.
 */
async function ensurePeople(pool: Pool, tenantId: string, json: string): Promise<number> {
  const wanted = Object.values(
    (JSON.parse(json) as { aliases?: { people?: Record<string, string> } }).aliases?.people ?? {},
  ).filter((name) => !/^p-[0-9a-f]{8}$/i.test(name));
  return withTenant(pool, tenantId, async (client) => {
    const have = new Set((await activePeople(client, tenantId)).map((p) => key(p.name)));
    let made = 0;
    for (const name of [...new Set(wanted)].sort()) {
      if (have.has(key(name))) continue;
      await ensurePendingPerson(client, tenantId, name);
      made++;
    }
    return made;
  });
}

/** Loads the years in order; stops at the first batch that does not finish `done`, so a bad year stays visible. */
export async function loadLegacyYears(
  pool: Pool,
  tenant: Tenant,
  files: readonly YearFile[],
): Promise<LoadedYear[]> {
  const loaded: LoadedYear[] = [];
  for (const file of [...files].sort((a, b) => a.year - b.year)) {
    const added = await withTenant(pool, tenant.id, (client) =>
      ensureLegacyListEntries(client, { tenantId: tenant.id, loginId: null }, codesOf(file.json)),
    );
    const people = await ensurePeople(pool, tenant.id, file.json);
    const { batchId, stats } = await importBhavin(pool, tenant.id, JSON.parse(file.json), {
      timeZone: tenant.timeZone,
      afterImport: (client, tenantId) => reconcileSlaPolicies(client, tenantId),
    });
    loaded.push({
      year: file.year,
      batchId,
      status: stats.status,
      imported: stats.imported,
      skipped: stats.skipped,
      errored: stats.errored,
      added,
      people,
    });
    if (stats.status !== 'done') break;
  }
  return loaded;
}

/** The whole plant read once; every year's run below reads the same data, as the served engine does. */
export async function engineData(pool: Pool, tenantId: string) {
  return withTenant(pool, tenantId, (client) => loadEngineData(client, tenantId));
}

/** The engine over one calendar year with an explicit period (ticket 76): figures, drills and the no-records months. */
export function runYear(data: Awaited<ReturnType<typeof engineData>>, year: number): EngineResult {
  return run(data, `${year}-12-31`, DEFAULT_PROFILE, {
    from: `${year}-01-01`,
    to: `${year}-12-31`,
  });
}

/** The figure's value by key; the tile counts below read it. */
export function figureOf(result: EngineResult, key: string): unknown {
  return result.figures.find((figure) => figure.key === key)?.value;
}

/** The pool on `DATABASE_URL` (the app role: tenant rules apply) and the tenant named by its slug. */
export async function connect(url: string, slug: string): Promise<{ pool: Pool; tenant: Tenant }> {
  const pool = createPool(url);
  const found = await resolveTenant(pool, slug);
  if (!found) {
    await pool.end();
    throw new Error(`Unknown tenant: ${slug}`);
  }
  return { pool, tenant: { id: found.id, timeZone: found.time_zone } };
}
