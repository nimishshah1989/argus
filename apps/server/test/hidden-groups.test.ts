import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { withTenant } from '@uptimo/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { FIXTURE_PASSWORD, seedCosmos } from '../src/seed/cosmos.js';
import { startTestDb, type TestDb } from './harness.js';

const doc = (name: string) =>
  fileURLToPath(new URL(`../../../docs/discovery/${name}`, import.meta.url));
const paths = {
  exportPath: doc('source/cosmos-platform-export-2026-10-28.json'),
  livePath: doc('bhavin-v3/live-config-2026-11-09.json'),
  glossaryPath: doc('bhavin-v3/glossary-2026-11-09.json'),
};

interface ConfigMachine {
  code: string;
  category: string | null;
  segment_id: string | null;
  group_id: string | null;
}
interface Config {
  machines: ConfigMachine[];
  segments: Array<{ id: string; code: string }>;
  groups: Array<{ id: string; hidden: boolean }>;
}

/**
 * The machines Bhavin's live tool (v3, 9 Nov) leaves off its board: his own machine-groups block, run as
 * written against his live client settings, so the old rule is his code and not a copy of it in ours.
 */
function hiddenByBhavin(config: Config, segmented = true): string[] {
  const source = readFileSync(doc('bhavin-v3/app.js'), 'utf8');
  const start = source.indexOf('/* ---------- machine groups ---------- */');
  const end = source.indexOf('const lvAllMachines');
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  const client = (JSON.parse(readFileSync(paths.livePath, 'utf8')) as { client: unknown }).client;
  const segmentCode = new Map(config.segments.map((s) => [s.id, s.code]));
  const machines = config.machines.map((m) => ({
    id: m.code,
    category: m.category ?? '',
    seg: segmented && m.segment_id ? segmentCode.get(m.segment_id) : undefined,
  }));
  const shown = runInNewContext(
    `${source.slice(start, end)}; lvBuildCats(); LV.cats.flatMap((c) => c.ms.map((m) => m.id));`,
    { CLIENT: client, REF: { machines }, LV: {} },
  ) as string[];
  return machines.map((m) => m.id).filter((id) => !shown.includes(id));
}

/** Ours: a machine is off the board and out of alerts when its group carries the hidden flag. */
function hiddenByFlag(config: Config): string[] {
  const hiddenGroups = new Set(config.groups.filter((g) => g.hidden).map((g) => g.id));
  return config.machines
    .filter((m) => m.group_id && hiddenGroups.has(m.group_id))
    .map((m) => m.code);
}

let db: TestDb;
let app: Awaited<ReturnType<typeof buildApp>>;

beforeAll(async () => {
  db = await startTestDb();
  await seedCosmos(db.admin, paths);
  app = await buildApp({ pool: db.app, logger: false, rateLimitMax: 100000 });
}, 180_000);

afterAll(async () => {
  await app.close();
  await db.stop();
});

async function cosmosConfig(): Promise<Config> {
  const host = { host: 'cosmos.localhost' };
  const login = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    headers: { ...host, 'content-type': 'application/json' },
    payload: { username: 'person01', password: FIXTURE_PASSWORD },
  });
  const res = await app.inject({
    method: 'GET',
    url: '/api/v1/config',
    headers: { ...host, authorization: `Bearer ${login.json().token}` },
  });
  expect(res.statusCode).toBe(200);
  return res.json() as Config;
}

describe('hidden machine groups replace the utility name guess (v3.alerts.08)', () => {
  it('hides exactly the Cosmos machines Bhavin hides today, machine by machine', async () => {
    const config = await cosmosConfig();
    expect(config.machines).toHaveLength(192);
    const before = hiddenByBhavin(config);
    const after = hiddenByFlag(config);
    expect(after.sort()).toEqual(before.sort());
  });

  it('an admin-hidden group covers what the name guess hid on a plant without segments', async () => {
    const guessed = hiddenByBhavin(await cosmosConfig(), false);
    expect(guessed.length).toBeGreaterThan(0);
    // The groups write path is the settings screens' (ticket 22, goal 1): set the flag as an admin would.
    const tenantId = (await db.admin.query("SELECT id FROM tenant WHERE slug = 'cosmos'")).rows[0]
      .id;
    await withTenant(db.admin, tenantId, (c) =>
      c.query(
        `WITH g AS (
           INSERT INTO machine_group (tenant_id, segment_id, code, name, hidden)
           SELECT tenant_id, id, code, code, true FROM segment WHERE code IN ('Utility', 'DG')
           RETURNING id, segment_id)
         UPDATE machine m SET group_id = g.id FROM g WHERE m.segment_id = g.segment_id`,
      ),
    );
    expect(hiddenByFlag(await cosmosConfig()).sort()).toEqual(guessed.sort());
  });
});
