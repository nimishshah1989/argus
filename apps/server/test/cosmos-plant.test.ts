import { fileURLToPath } from 'node:url';
import { withTenant } from '@uptimo/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { FIXTURE_PASSWORD, seedCosmos } from '../src/seed/cosmos.js';
import { shiftAt } from '../src/ticket-report.js';
import { startTestDb, type TestDb } from './harness.js';

const doc = (name: string) =>
  fileURLToPath(new URL(`../../../docs/discovery/${name}`, import.meta.url));
const paths = {
  exportPath: doc('source/cosmos-platform-export-2026-10-28.json'),
  livePath: doc('bhavin-v3/live-config-2026-11-09.json'),
  glossaryPath: doc('bhavin-v3/glossary-2026-11-09.json'),
};

let db: TestDb;
let app: Awaited<ReturnType<typeof buildApp>>;
let tenantId: string;

beforeAll(async () => {
  db = await startTestDb();
  await seedCosmos(db.admin, paths);
  tenantId = (await db.admin.query("SELECT id FROM tenant WHERE slug = 'cosmos'")).rows[0].id;
  app = await buildApp({ pool: db.app, logger: false, rateLimitMax: 100000 });
}, 180_000);

afterAll(async () => {
  await app.close();
  await db.stop();
});

function login(password: string) {
  return app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    headers: { host: 'cosmos.localhost', 'content-type': 'application/json' },
    payload: { username: 'person01', password },
  });
}

describe('cosmos plant', () => {
  it('a seeded login signs in', async () => {
    const ok = await login(FIXTURE_PASSWORD);
    expect(ok.statusCode).toBe(200);
    expect(ok.json().token).toBeTruthy();
    expect((await login('wrong-password-here')).statusCode).toBe(401);
  });

  it.each([
    ['2026-11-13T18:28:00+05:30', '1'],
    ['2026-11-13T18:29:00+05:30', '2'],
    ['2026-11-13T18:30:00+05:30', '2'],
    ['2026-11-14T04:59:00+05:30', '2'],
    ['2026-11-14T05:00:00+05:30', '1'],
  ])('an event at %s falls in shift %s', async (instant, shift) => {
    const got = await withTenant(db.app, tenantId, (c) => shiftAt(c, tenantId, new Date(instant)));
    expect(got).toBe(shift);
  });
});
