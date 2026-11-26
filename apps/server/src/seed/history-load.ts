import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import type { Pool } from 'pg';
import { withTenant } from '@uptimo/db';
import { reconcileSlaPolicies } from '../modules/accountability/index.js';
import { DATA_FROM_KEY, loadEngineData, runForTenant } from '../modules/analytics/index.js';
import { importBhavin } from '../modules/imports/index.js';
import { plantToday, upsertSetting } from '../modules/plant/index.js';
import { breakdownLogExport } from './breakdown-log-export.js';
import { connect, ensurePeople, type Tenant } from './legacy-load.js';

/**
 * Ticket 69d, the staging history load: `tsx apps/server/src/seed/history-load.ts --tenant <slug> --data-from <date>`.
 * `infra/instance/history-load.sh` runs it inside the server image after a database snapshot. It writes the
 * `analytics.data-from` setting (ADR 0027), then loads the 2026 breakdown log (slice 37c: the 1,283 non-live rows of
 * the pseudonymised extract in `fixtures/answer-key/input.json`) through the importer, which skips what it already
 * holds, so a re-run adds nothing. Prints counts and figures only, before and after; never a row's text.
 */
const USAGE = 'usage: history-load --tenant <slug> --data-from <YYYY-MM-DD>';
const LOG_2026 = new URL('../../../../fixtures/answer-key/input.json', import.meta.url);

export function parseArgs(argv: readonly string[]): { tenant: string; dataFrom: string } {
  const value = (flag: string): string | undefined => {
    const at = argv.indexOf(flag);
    return at < 0 ? undefined : argv[at + 1];
  };
  const tenant = value('--tenant');
  const dataFrom = value('--data-from');
  if (!tenant || !dataFrom) throw new Error(USAGE);
  const day = new Date(`${dataFrom}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataFrom) || day.toISOString().slice(0, 10) !== dataFrom) {
    throw new Error(
      `--data-from must be a real plant date like 2026-01-01, got ${dataFrom}\n${USAGE}`,
    );
  }
  return { tenant, dataFrom };
}

/** History tickets' reports per month (the rows A1 reads: `isHistory`), through the engine's own loader. */
export async function historyByMonth(pool: Pool, tenantId: string): Promise<Map<string, number>> {
  const data = await withTenant(pool, tenantId, (tx) => loadEngineData(tx, tenantId));
  const history = new Set(data.tickets.filter((t) => t.source === 'history').map((t) => t.id));
  const months = new Map<string, number>();
  for (const report of data.reports) {
    if (report.ticketId === null || !history.has(report.ticketId)) continue;
    const month = report.date.slice(0, 7);
    months.set(month, (months.get(month) ?? 0) + 1);
  }
  return new Map([...months].sort(([a], [b]) => a.localeCompare(b)));
}

/** The A1 month table's PLANT TOTAL BD % row as of the plant's today, the figure the BD % screen is served. */
async function a1PlantTotal(pool: Pool, tenantId: string): Promise<string> {
  const result = await withTenant(pool, tenantId, async (tx) =>
    runForTenant(tx, { tenantId, asOf: await plantToday(tx, tenantId) }),
  );
  const value = result.figures.find((figure) => figure.key === 'a1-bd-pm')?.value as {
    asOf: string;
    pages: Array<{ tables: Array<{ header: string[]; rows: string[][] }> }>;
  } | null;
  if (!value) return 'a1: no figure (no history rows in the period)';
  const table = value.pages[0]?.tables[1];
  const total = table?.rows.find((row) => row[0]?.startsWith('PLANT TOTAL'));
  if (!table || !total) return 'a1: no PLANT TOTAL row';
  const months = table.header.slice(1, 13).map((month, i) => `${month} ${total[i + 1] ?? '-'}`);
  return `a1 BD % as of ${value.asOf}: ${months.join(' | ')}`;
}

async function report(pool: Pool, tenantId: string, label: string): Promise<void> {
  const months = await historyByMonth(pool, tenantId);
  const total = [...months.values()].reduce((sum, n) => sum + n, 0);
  console.log(`${label} history reports: ${total}`);
  for (const [month, count] of months) console.log(`${label} ${month}: ${count}`);
  console.log(`${label} ${await a1PlantTotal(pool, tenantId)}`);
}

/** The data-from setting, then the 2026 log; people the log names and the plant lacks become pending people (R8). */
async function load(pool: Pool, tenant: Tenant, dataFrom: string): Promise<string> {
  await withTenant(pool, tenant.id, (tx) => upsertSetting(tx, tenant.id, DATA_FROM_KEY, dataFrom));
  console.log(`setting ${DATA_FROM_KEY} = ${dataFrom}`);
  const exported = breakdownLogExport(JSON.parse(readFileSync(LOG_2026, 'utf8')) as unknown);
  const people = await ensurePeople(pool, tenant.id, JSON.stringify(exported));
  const { batchId, stats } = await importBhavin(pool, tenant.id, exported, {
    timeZone: tenant.timeZone,
    afterImport: (client, tenantId) => reconcileSlaPolicies(client, tenantId),
  });
  console.log(
    `load 2026: batch ${batchId} ${stats.status} | imported ${stats.imported} skipped ${stats.skipped}` +
      ` errored ${stats.errored} | placeholder people ${people}`,
  );
  return stats.status;
}

export async function main(argv = process.argv.slice(2)): Promise<string> {
  const { tenant: slug, dataFrom } = parseArgs(argv);
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error(`${USAGE}\nDATABASE_URL is required`);
  // The staging database is remote by design: this runner exists to load it (69d).
  const { pool, tenant } = await connect(url, slug, true);
  try {
    await report(pool, tenant.id, 'before');
    const status = await load(pool, tenant, dataFrom);
    await report(pool, tenant.id, 'after');
    if (status !== 'done') process.exitCode = 1;
    return status;
  } finally {
    await pool.end();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
