import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
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
const machines = async () => (await call('GET', '/api/v1/machines')).json() as Machine[];

describe("Cosmos's real plant through the settings API", () => {
  it('lists all 192 machines, the 6 segments and the real shifts', async () => {
    expect(await machines()).toHaveLength(192);
    expect((await call('GET', '/api/v1/segments')).json()).toHaveLength(6);
    expect((await call('GET', '/api/v1/shifts')).json().length).toBeGreaterThan(0);
  });

  it("moves TC-3 from cell 7 to cell 2: one dated move, and the board's config follows", async () => {
    const tc3 = (await machines()).find((m) => m.code === 'TC-3')!;
    expect(tc3.cell).toBe('7');
    const res = await call('PATCH', `/api/v1/machines/${tc3.id}`, {
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
      .find((s: { code: string }) => s.code === 'Utility');
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
      const res = await call('PATCH', `/api/v1/machines/${m.id}`, { groupId: group.id });
      expect(res.statusCode, m.code).toBe(200);
    }
    const config = (await call('GET', '/api/v1/config')).json();
    const hidden = new Set(
      config.groups.filter((g: { hidden: boolean }) => g.hidden).map((g: { id: string }) => g.id),
    );
    const offBoard = config.machines.filter((m: { group_id: string }) => hidden.has(m.group_id));
    expect(offBoard).toHaveLength(30);
    const off = await call('DELETE', `/api/v1/machines/${onUtility[0]!.id}`);
    expect(off.json().status).toBe('scrapped');
    expect((await call('GET', '/api/v1/config')).json().machines).toHaveLength(191);
    expect(await machines()).toHaveLength(192);
  });
});
