import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { buildApp } from '../src/app.js';
import { importRealExport } from '../src/modules/imports/real-import.js';
import { FIXTURE_PASSWORD, seedCosmos } from '../src/seed/cosmos.js';
import { startTestDb, type TestDb } from './harness.js';

const doc = (name: string) =>
  fileURLToPath(new URL(`../../../docs/discovery/${name}`, import.meta.url));

export type App = Awaited<ReturnType<typeof buildApp>>;

export interface RealPlant {
  db: TestDb;
  app: App;
  tenantId: string;
  /** A login in this plant (the password is the seed's fixture password); returns its bearer token. */
  signIn: (login: NewLogin) => Promise<string>;
  get: (url: string, token: string, host?: string) => Promise<Awaited<ReturnType<App['inject']>>>;
  stop: () => Promise<void>;
}

export interface NewLogin {
  username: string;
  role: string;
  shared?: boolean;
  cell?: string | null;
}

/** Cosmos's real plant (machines, shifts) with the 275 real pseudonymised tickets in; names and phones are invented. */
export async function startRealPlant(): Promise<RealPlant> {
  const db = await startTestDb();
  await seedCosmos(db.admin, {
    exportPath: doc('source/cosmos-platform-export-2026-10-28.json'),
    livePath: doc('bhavin-v3/live-config-2026-11-09.json'),
    glossaryPath: doc('bhavin-v3/glossary-2026-11-09.json'),
  });
  const tenantId = (await db.admin.query("SELECT id FROM tenant WHERE slug = 'cosmos'")).rows[0].id;
  const app = await buildApp({ pool: db.app, logger: false, rateLimitMax: 100000 });
  const fixture = JSON.parse(
    readFileSync(new URL('./fixtures/bhavin-export.pseudonymised.json', import.meta.url), 'utf8'),
  );
  await importRealExport(db.app, tenantId, { tickets: fixture.tickets });

  const get: RealPlant['get'] = (url, token, host = 'cosmos.localhost') =>
    app.inject({ method: 'GET', url, headers: { host, authorization: `Bearer ${token}` } });

  const signIn = async (login: NewLogin): Promise<string> => {
    // A login of one person has its own (invented) person; a shared one names who is acting at sign-in.
    const own = (
      await db.admin.query(
        "INSERT INTO person (tenant_id, name, team) VALUES ($1, $2, 'maintenance') RETURNING id",
        [tenantId, `Test ${login.username}`],
      )
    ).rows[0].id as string;
    await db.admin.query(
      `INSERT INTO login (id, tenant_id, person_id, username, password_hash, role, shared, cell)
       SELECT $1, $2, $3, $4, password_hash, $5, $6, $7 FROM login WHERE tenant_id = $2 LIMIT 1`,
      [
        randomUUID(),
        tenantId,
        login.shared ? null : own,
        login.username,
        login.role,
        login.shared ?? false,
        login.cell ?? null,
      ],
    );
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { host: 'cosmos.localhost', 'content-type': 'application/json' },
      payload: {
        username: login.username,
        password: FIXTURE_PASSWORD,
        ...(login.shared ? { actingPersonId: own } : {}),
      },
    });
    return res.json().token as string;
  };
  return {
    db,
    app,
    tenantId,
    signIn,
    get,
    stop: async () => {
      await app.close();
      await db.stop();
    },
  };
}
