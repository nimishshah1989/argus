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

export type App = Awaited<ReturnType<typeof buildApp>>;
export type Res = Awaited<ReturnType<App['inject']>>;

export interface Fixture {
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
  const [seg, group, machine, shift] = ids;
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
}

export async function startFixture(): Promise<Fixture> {
  const db = await startTestDb();
  const admin = db.admin;
  await seedTenant(admin, A, 'plant-a', ROLES);
  await seedTenant(admin, B, 'plant-b', ['admin']);
  await seedPlant(admin, A, [SEG_A, GROUP_A, M_FREE, SHIFT_A], 'Cell 1');
  await seedPlant(admin, B, [SEG_B, GROUP_B, M_B, SHIFT_B], 'Cell 9');
  // A second machine in tenant A that carries a ticket, so switching it off must keep the history.
  await admin.query(
    "INSERT INTO machine (id, tenant_id, code, segment_id, cell) VALUES ($1, $2, 'VC-02', $3, 'Cell 1')",
    [M_USED, A, SEG_A],
  );
  await admin.query(
    "INSERT INTO ticket (tenant_id, ref, kind, status, machine_id, problem, reported_at, severity) VALUES ($1, 'BD-0001', 'stopped', 'closed', $2, 'Spindle noise', now(), 'S3')",
    [A, M_USED],
  );
  const app = await buildApp({ pool: db.app, logger: false, rateLimitMax: 100000 });
  const host = (slug: string) => ({
    host: `${slug}.localhost`,
    'content-type': 'application/json',
  });
  const tokens: Record<string, string> = {};
  const logins: Array<[string, string, string]> = [
    ...ROLES.map((r): [string, string, string] => [r, 'plant-a', `plant-a-${r}`]),
    ['b-admin', 'plant-b', 'plant-b-admin'],
  ];
  for (const [key, slug, username] of logins) {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: host(slug),
      payload: { username, password: PASSWORD },
    });
    tokens[key] = res.json().token as string;
  }
  const call: Fixture['call'] = (method, url, token, payload) =>
    app.inject({
      method: method as 'GET',
      url,
      // Like the web client: a JSON content type only when there is a body.
      headers: {
        host: host(token === tokens['b-admin'] ? 'plant-b' : 'plant-a').host,
        ...(payload ? { 'content-type': 'application/json' } : {}),
        authorization: `Bearer ${token}`,
      },
      ...(payload ? { payload } : {}),
    });
  return {
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
