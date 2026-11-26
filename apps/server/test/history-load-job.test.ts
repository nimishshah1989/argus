/**
 * Ticket 69d: the staging history runner (`seed/history-load.ts`) against a Cosmos-seeded tenant with none of the
 * history's people: it writes `analytics.data-from`, adds the log's missing people as pending placeholders, loads the
 * 1,283 rows of the 2026 log once (a second run imports 0), and the engine's loader serves the stored date.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { withTenant } from '@uptimo/db';
import { loadEngineData } from '../src/modules/analytics/index.js';
import { seedCosmos } from '../src/seed/cosmos.js';
import { historyByMonth, main, parseArgs } from '../src/seed/history-load.js';
import { APP_API_PASSWORD, startTestDb, type TestDb } from './harness.js';

const doc = (path: string): string =>
  new URL(`../../../docs/discovery/${path}`, import.meta.url).pathname;

let db: TestDb;
let tenantId: string;
const saved = process.env.DATABASE_URL;

const count = async (sql: string): Promise<number> =>
  (await db.admin.query(sql, [tenantId])).rows[0].n as number;

beforeAll(async () => {
  db = await startTestDb();
  await seedCosmos(db.admin, {
    exportPath: doc('source/cosmos-platform-export-2026-10-28.json'),
    livePath: doc('bhavin-v3/live-config-2026-11-09.json'),
    glossaryPath: doc('bhavin-v3/glossary-2026-11-09.json'),
  });
  tenantId = (await db.admin.query("SELECT id FROM tenant WHERE slug = 'cosmos'")).rows[0]
    .id as string;
  const c = db.container;
  process.env.DATABASE_URL = `postgresql://app_api:${APP_API_PASSWORD}@${c.getHost()}:${c.getPort()}/${c.getDatabase()}`;
}, 120_000);

afterAll(async () => {
  if (saved === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = saved;
  await db.stop();
});

describe('the staging history runner', () => {
  it('refuses a missing or unreal data-from date', () => {
    expect(() => parseArgs(['--tenant', 'cosmos'])).toThrow(/usage/);
    expect(() => parseArgs(['--tenant', 'cosmos', '--data-from', '2026-02-30'])).toThrow(
      /real plant date/,
    );
    expect(parseArgs(['--tenant', 'cosmos', '--data-from', '2026-01-01'])).toEqual({
      tenant: 'cosmos',
      dataFrom: '2026-01-01',
    });
  });

  it('loads the 2026 log once, with placeholder people, and stores the data-from date', async () => {
    expect((await historyByMonth(db.app, tenantId)).size).toBe(0);
    await expect(main(['--tenant', 'cosmos', '--data-from', '2026-01-01'])).resolves.toBe('done');
    const backfill =
      "SELECT count(*)::int AS n FROM ticket WHERE tenant_id = $1 AND raised_channel = 'backfill'";
    expect(await count(backfill)).toBe(1283);
    expect(
      await count(
        "SELECT count(*)::int AS n FROM person WHERE tenant_id = $1 AND name IN ('Person 39', 'Maint. Team')",
      ),
    ).toBe(2);
    const months = await historyByMonth(db.app, tenantId);
    expect([...months.values()].reduce((sum, n) => sum + n, 0)).toBe(1283);
    for (const month of ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10']) {
      expect(months.get(`2026-${month}`) ?? 0, month).toBeGreaterThan(0);
    }

    await expect(main(['--tenant', 'cosmos', '--data-from', '2026-01-01'])).resolves.toBe('done');
    expect(await count(backfill)).toBe(1283);
    expect(await count('SELECT count(*)::int AS n FROM import_batch WHERE tenant_id = $1')).toBe(2);

    const data = await withTenant(db.app, tenantId, (tx) => loadEngineData(tx, tenantId));
    expect(data.settings?.dataFrom).toBe('2026-01-01');
  }, 300_000);
});
