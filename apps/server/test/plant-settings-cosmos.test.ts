import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { LIST_NAMES } from '@uptimo/shared';
import { buildApp } from '../src/app.js';
import { FIXTURE_PASSWORD, seedCosmos } from '../src/seed/cosmos.js';
import { startTestDb, type TestDb } from './harness.js';

// Cosmos's real plant (192 machines, 6 segments, real cells and shifts); only the people are invented.
const doc = (name: string) =>
  fileURLToPath(new URL(`../../../docs/discovery/${name}`, import.meta.url));
const paths = {
  exportPath: doc('source/cosmos-platform-export-2026-10-28.json'),
  livePath: doc('bhavin-v3/live-config-2026-11-09.json'),
  glossaryPath: doc('bhavin-v3/glossary-2026-11-09.json'),
};

let db: TestDb;
let app: Awaited<ReturnType<typeof buildApp>>;
let token = '';

beforeAll(async () => {
  db = await startTestDb();
  await seedCosmos(db.admin, paths);
  app = await buildApp({ pool: db.app, logger: false, rateLimitMax: 100000 });
  const username = (await db.admin.query("SELECT username FROM login WHERE role = 'admin' LIMIT 1"))
    .rows[0].username;
  const login = await call('POST', '/api/v1/auth/login', { username, password: FIXTURE_PASSWORD });
  token = login.json().token;
}, 180_000);
afterAll(async () => {
  await app.close();
  await db.stop();
});

function call(method: string, url: string, payload?: object) {
  return app.inject({
    method: method as 'GET',
    url,
    headers: {
      host: 'cosmos.localhost',
      ...(payload ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    ...(payload ? { payload } : {}),
  });
}
type Machine = { id: string; code: string; cell: string | null; segmentId: string | null };
const machines = async () => (await call('GET', '/api/v1/machines')).json().items as Machine[];

describe("Cosmos's real plant through the settings API", () => {
  it('lists all 192 machines, the 6 segments and the real shifts', async () => {
    expect(await machines()).toHaveLength(192);
    expect((await call('GET', '/api/v1/segments')).json().items).toHaveLength(6);
    expect((await call('GET', '/api/v1/shifts')).json().items.length).toBeGreaterThan(0);
  });

  it("moves TC-3 from cell 7 to cell 2: one dated move, and the board's config follows", async () => {
    const tc3 = (await machines()).find((m) => m.code === 'TC-3')!;
    expect(tc3.cell).toBe('7');
    const res = await call('PUT', `/api/v1/machines/${tc3.id}`, {
      cell: '2',
      effectiveFrom: '2026-11-14',
    });
    expect(res.statusCode).toBe(200);
    expect((await call('GET', `/api/v1/machines/${tc3.id}/moves`)).json()).toEqual([
      expect.objectContaining({ fromCell: '7', toCell: '2', effectiveFrom: '2026-11-14' }),
    ]);
    const config = (await call('GET', '/api/v1/config')).json();
    expect(config.machines.find((m: { id: string }) => m.id === tc3.id).cell).toBe('2');
  });

  it('a hidden group puts the real utility machines off the board, and switching one off drops it from the picker', async () => {
    const all = await machines();
    const utility = (await call('GET', '/api/v1/segments'))
      .json()
      .items.find((s: { code: string }) => s.code === 'Utility');
    const group = (
      await call('POST', '/api/v1/groups', {
        segmentId: utility.id,
        code: 'UTIL',
        name: 'Utilities',
        hidden: true,
      })
    ).json();
    const onUtility = all.filter((m) => m.segmentId === utility.id);
    expect(onUtility).toHaveLength(30);
    for (const m of onUtility) {
      const res = await call('PUT', `/api/v1/machines/${m.id}`, { groupId: group.id });
      expect(res.statusCode, m.code).toBe(200);
    }
    const config = (await call('GET', '/api/v1/config')).json();
    const hidden = new Set(
      config.groups.filter((g: { hidden: boolean }) => g.hidden).map((g: { id: string }) => g.id),
    );
    const offBoard = config.machines.filter((m: { group_id: string }) => hidden.has(m.group_id));
    expect(offBoard).toHaveLength(30);
    const off = await call('PUT', `/api/v1/machines/${onUtility[0]!.id}`, { active: false });
    expect(off.json()).toMatchObject({ status: 'scrapped', active: false });
    expect((await call('GET', '/api/v1/config')).json().machines).toHaveLength(191);
    expect(await machines()).toHaveLength(192);
  });
});

describe("Cosmos's real lists and glossary through the settings API", () => {
  it('every list returns exactly what the plant holds, with the real flags', async () => {
    for (const list of LIST_NAMES) {
      const stored = await db.admin.query(
        'SELECT count(*)::int AS n, count(*) FILTER (WHERE pauses_sla)::int AS pauses FROM list_item WHERE list = $1',
        [list],
      );
      const items = (await call('GET', `/api/v1/settings/lists/${list}`)).json().items;
      expect(items, list).toHaveLength(stored.rows[0].n);
      expect(
        items.filter((i: { pausesSla: boolean }) => i.pausesSla),
        list,
      ).toHaveLength(stored.rows[0].pauses);
    }
    const waits = (await call('GET', '/api/v1/settings/lists/wait_reason')).json().items;
    expect(waits.length).toBeGreaterThan(3);
    expect(waits.some((w: { pausesSla: boolean }) => w.pausesSla)).toBe(true);
  });

  it('switching a real wait reason off and changing its clock flag shows in the config the floor reads', async () => {
    const waits = (await call('GET', '/api/v1/settings/lists/wait_reason')).json().items;
    const target = waits.find((w: { pausesSla: boolean }) => w.pausesSla);
    const res = await call('PUT', `/api/v1/settings/lists/wait_reason/${target.id}`, {
      code: target.code,
      label: target.label,
      pausesSla: 'false',
      active: false,
    });
    expect(res.json()).toMatchObject({ pausesSla: false, active: false });
    const config = (await call('GET', '/api/v1/config')).json();
    expect(config.lists.wait_reason.find((w: { id: string }) => w.id === target.id)).toMatchObject({
      pausesSla: false,
      active: false,
    });
    const legacy = (await call('GET', '/api/v1/lists/wait_reason')).json();
    expect(legacy.find((w: { id: string }) => w.id === target.id).active).toBe(false);
    const on = await call('PUT', `/api/v1/settings/lists/wait_reason/${target.id}`, {
      active: true,
    });
    expect(on.json().active).toBe(true);
  });

  it('lists the real glossary and edits one term', async () => {
    const stored = await db.admin.query('SELECT count(*)::int AS n FROM glossary_term');
    const terms = (await call('GET', '/api/v1/settings/glossary')).json().items;
    expect(terms).toHaveLength(stored.rows[0].n);
    expect(terms.length).toBeGreaterThan(10);
    const res = await call('PUT', `/api/v1/settings/glossary/${terms[0].id}`, {
      english: 'checked by the plant',
    });
    expect(res.json().english).toBe('checked by the plant');
  });
});
