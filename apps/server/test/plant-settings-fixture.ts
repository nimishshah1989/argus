import { hash } from '@node-rs/argon2';
import type { Pool } from 'pg';
import { buildApp } from '../src/app.js';
import { startTestDb, type TestDb } from './harness.js';

export const A = '10000000-0000-0000-0000-000000000001';
export const B = '20000000-0000-0000-0000-000000000001';
export const ROLES = [
  'operator',
  'technician',
  'supervisor',
  'head',
  'plant_head',
  'admin',
  'board',
] as const;
export const PASSWORD = 'correct-horse-battery';
// Tenant A: a segment, a group inside it, two machines (M_USED has a ticket); tenant B has one of each.
export const SEG_A = '10000000-0000-0000-0000-000000000101';
export const GROUP_A = '10000000-0000-0000-0000-000000000102';
export const M_FREE = '10000000-0000-0000-0000-000000000103';
export const M_USED = '10000000-0000-0000-0000-000000000104';
export const SHIFT_A = '10000000-0000-0000-0000-000000000105';
export const SEG_B = '20000000-0000-0000-0000-000000000101';
export const GROUP_B = '20000000-0000-0000-0000-000000000102';
export const M_B = '20000000-0000-0000-0000-000000000103';
export const SHIFT_B = '20000000-0000-0000-0000-000000000105';
export const ITEM_A = '10000000-0000-0000-0000-000000000106';
export const TERM_A = '10000000-0000-0000-0000-000000000107';
export const LOGO_A = '10000000-0000-0000-0000-000000000108';
export const ITEM_B = '20000000-0000-0000-0000-000000000106';
export const TERM_B = '20000000-0000-0000-0000-000000000107';
export const LOGO_B = '20000000-0000-0000-0000-000000000108';

export type App = Awaited<ReturnType<typeof buildApp>>;
export type Res = Awaited<ReturnType<App['inject']>>;

/** One request the way the browser sends an image: raw bytes and their type, no JSON. */
export type SendRaw = (
  url: string,
  token: string | null,
  body: { type: string; bytes: Buffer; host?: string },
) => Promise<Res>;

export interface Fixture {
  raw: SendRaw;
  db: TestDb;
  admin: Pool;
  app: App;
  tokens: Record<string, string>;
  call: (method: string, url: string, token: string, payload?: object) => Promise<Res>;
  stop: () => Promise<void>;
}

async function seedTenant(admin: Pool, id: string, slug: string, roles: readonly string[]) {
  const passwordHash = await hash(PASSWORD, {
    algorithm: 2,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
  await admin.query('INSERT INTO tenant (id, slug, name) VALUES ($1, $2, $2)', [id, slug]);
  for (const role of roles) {
    const person = await admin.query(
      "INSERT INTO person (tenant_id, name, team) VALUES ($1, $2, 'maintenance') RETURNING id",
      [id, `${slug} ${role}`],
    );
    await admin.query(
      'INSERT INTO login (tenant_id, person_id, username, password_hash, role, shared) VALUES ($1, $2, $3, $4, $5, false)',
      [id, person.rows[0].id, `${slug}-${role}`, passwordHash, role],
    );
  }
}

async function seedPlant(admin: Pool, t: string, ids: string[], cell: string) {
  const [seg, group, machine, shift, item, term] = ids;
  await admin.query(
    "INSERT INTO segment (id, tenant_id, code, name) VALUES ($1, $2, 'CNC', 'CNC')",
    [seg, t],
  );
  await admin.query(
    "INSERT INTO machine_group (id, tenant_id, segment_id, code, name) VALUES ($1, $2, $3, 'VC', 'VC machines')",
    [group, t, seg],
  );
  await admin.query(
    "INSERT INTO machine (id, tenant_id, code, segment_id, group_id, cell, criticality) VALUES ($1, $2, 'VC-01', $3, $4, $5, 'B')",
    [machine, t, seg, group, cell],
  );
  await admin.query(
    "INSERT INTO shift (id, tenant_id, code, name, starts_at, ends_at) VALUES ($1, $2, 'DAY', 'Day', '08:00', '18:30')",
    [shift, t],
  );
  await admin.query(
    "INSERT INTO list_item (id, tenant_id, list, code, label) VALUES ($1, $2, 'wait_reason', 'spare', 'Waiting for spare')",
    [item, t],
  );
  await admin.query(
    "INSERT INTO glossary_term (id, tenant_id, source, english) VALUES ($1, $2, 'ખરાબ', 'broken')",
    [term, t],
  );
}

/** Two plants and everything the tests read: logins, plants, a machine with a closed ticket, a ticket counter. */
async function seedAll(admin: Pool): Promise<void> {
  await seedTenant(admin, A, 'plant-a', ROLES);
  await seedTenant(admin, B, 'plant-b', ['admin']);
  // Shared floor logins (one phone, many people): the role alone decides what they may change.
  for (const [username, role] of [
    ['shared-operator', 'operator'],
    ['shared-head', 'head'],
  ]) {
    await admin.query(
      `INSERT INTO login (tenant_id, person_id, username, password_hash, role, shared)
       SELECT l.tenant_id, l.person_id, $2, l.password_hash, $3, true FROM login l
        WHERE l.tenant_id = $1 AND l.username = 'plant-a-operator'`,
      [A, `plant-a-${username}`, role],
    );
  }
  await seedPlant(admin, A, [SEG_A, GROUP_A, M_FREE, SHIFT_A, ITEM_A, TERM_A], 'Cell 1');
  await seedPlant(admin, B, [SEG_B, GROUP_B, M_B, SHIFT_B, ITEM_B, TERM_B], 'Cell 9');
  // A second machine in tenant A that carries a ticket, so switching it off must keep the history.
  await admin.query(
    "INSERT INTO machine (id, tenant_id, code, segment_id, cell) VALUES ($1, $2, 'VC-02', $3, 'Cell 1')",
    [M_USED, A, SEG_A],
  );
  await admin.query(
    "INSERT INTO ticket (tenant_id, ref, kind, status, machine_id, problem, reported_at, severity) VALUES ($1, 'BD-0001', 'stopped', 'closed', $2, 'Spindle noise', now(), 'S3')",
    [A, M_USED],
  );
  await admin.query(
    "INSERT INTO ref_counter (tenant_id, prefix, next_value) VALUES ($1, 'BD', 1000)",
    [A],
  );
}

const hostOf = (slug: string) => ({
  host: `${slug}.localhost`,
  'content-type': 'application/json',
});

/** A token for every login the tests use, keyed by role (and 'b-admin', 'shared-*'). */
async function signInAll(app: App, admin: Pool): Promise<Record<string, string>> {
  const logins: Array<[string, string, string]> = [
    ...ROLES.map((r): [string, string, string] => [r, 'plant-a', `plant-a-${r}`]),
    ['b-admin', 'plant-b', 'plant-b-admin'],
    ['shared-operator', 'plant-a', 'plant-a-shared-operator'],
    ['shared-head', 'plant-a', 'plant-a-shared-head'],
  ];
  const acting = (
    await admin.query("SELECT person_id FROM login WHERE username = 'plant-a-operator'")
  ).rows[0].person_id as string;
  const tokens: Record<string, string> = {};
  for (const [key, slug, username] of logins) {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: hostOf(slug),
      payload: {
        username,
        password: PASSWORD,
        ...(key.startsWith('shared-') ? { actingPersonId: acting } : {}),
      },
    });
    if (res.statusCode !== 200)
      throw new Error(`login failed for ${username}: ${res.statusCode} ${res.body}`);
    tokens[key] = res.json().token as string;
  }
  return tokens;
}

export async function startFixture(filesDir?: string): Promise<Fixture> {
  const db = await startTestDb();
  const admin = db.admin;
  await seedAll(admin);
  const app = await buildApp({ pool: db.app, logger: false, rateLimitMax: 100000, filesDir });
  const tokens = await signInAll(app, admin);
  const call: Fixture['call'] = (method, url, token, payload) =>
    app.inject({
      method: method as 'GET',
      url,
      // Like the web client: a JSON content type only when there is a body.
      headers: {
        host: hostOf(token === tokens['b-admin'] ? 'plant-b' : 'plant-a').host,
        ...(payload ? { 'content-type': 'application/json' } : {}),
        authorization: `Bearer ${token}`,
      },
      ...(payload ? { payload } : {}),
    });
  const raw: SendRaw = (url, token, body) =>
    app.inject({
      method: 'PUT',
      url,
      headers: {
        host: `${body.host ?? 'plant-a'}.localhost`,
        'content-type': body.type,
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      payload: body.bytes,
    });
  return {
    raw,
    db,
    admin,
    app,
    tokens,
    call,
    stop: async () => {
      await app.close();
      await db.stop();
    },
  };
}
