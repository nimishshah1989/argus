import { hash } from '@node-rs/argon2';
import type { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { startTestDb, type TestDb } from './harness.js';

const A = '10000000-0000-0000-0000-000000000001';
const ADMIN_PERSON = '10000000-0000-0000-0000-000000000021';
const TECH_PERSON = '10000000-0000-0000-0000-000000000022';
const ADMIN_LOGIN = '10000000-0000-0000-0000-000000000023';
const TECH_LOGIN = '10000000-0000-0000-0000-000000000024';
const ITEM_SPARE = '10000000-0000-0000-0000-000000000031';
const ITEM_VENDOR = '10000000-0000-0000-0000-000000000032';
const PASSWORD = 'correct-horse-battery';

type App = Awaited<ReturnType<typeof buildApp>>;
type Res = Awaited<ReturnType<App['inject']>>;

let db: TestDb;
let admin: Pool;
let app: App;

function req(
  method: 'GET' | 'PUT' | 'POST' | 'DELETE',
  url: string,
  token?: string,
  payload?: object,
): Promise<Res> {
  return app.inject({
    method,
    url,
    headers: {
      host: 'cosmos.localhost',
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    ...(payload ? { payload } : {}),
  });
}

beforeAll(async () => {
  db = await startTestDb();
  admin = db.admin;
  const passwordHash = await hash(PASSWORD, {
    algorithm: 2,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
  await admin.query("INSERT INTO tenant (id, slug, name) VALUES ($1, 'cosmos', 'Cosmos')", [A]);
  await admin.query(
    "INSERT INTO person (id, tenant_id, name, team, title) VALUES ($1, $3, 'Admin', 'maintenance', 'Head'), ($2, $3, 'Tech', 'maintenance', 'Technician')",
    [ADMIN_PERSON, TECH_PERSON, A],
  );
  await admin.query(
    `INSERT INTO login (id, tenant_id, person_id, username, password_hash, role, shared)
     VALUES ($1, $3, $5, 'admin', $7, 'admin', false), ($2, $4, $6, 'tech', $7, 'technician', false)`,
    [ADMIN_LOGIN, TECH_LOGIN, A, A, ADMIN_PERSON, TECH_PERSON, passwordHash],
  );
  await admin.query(
    "INSERT INTO list_item (id, tenant_id, list, code, label, label_gu, sort, active) VALUES ($1, $3, 'wait_reason', 'spare', 'Waiting for spare', NULL, 0, true), ($2, $3, 'wait_reason', 'vendor', 'Sent to vendor', 'વેન્ડર', 1, true)",
    [ITEM_SPARE, ITEM_VENDOR, A],
  );
  await admin.query(
    'INSERT INTO setting (tenant_id, key, value) VALUES ($1, \'features\', \'{"general": true, "pause": true}\')',
    [A],
  );
  app = await buildApp({ pool: db.app, logger: false, rateLimitMax: 100000 });
}, 120_000);

afterAll(async () => {
  await app.close();
  await db.stop();
});

async function loginAs(username: string): Promise<string> {
  const res = await req('POST', '/api/v1/auth/login', undefined, { username, password: PASSWORD });
  expect(res.statusCode).toBe(200);
  return res.json().token as string;
}

describe('settings and config', () => {
  it('returns the full config with a fingerprint and lists the missing translations', async () => {
    const token = await loginAs('admin');
    const cfg = await req('GET', '/api/v1/config', token);
    expect(cfg.statusCode).toBe(200);
    const body = cfg.json();
    expect(typeof body.fp).toBe('string');
    expect(body.features.general).toBe(true);
    expect(body.language).toBe('en');
    expect(body.lists.wait_reason).toHaveLength(2);
    const missing = await req('GET', '/api/v1/translations/missing', token);
    const codes = missing.json().map((row: { code: string }) => row.code);
    expect(codes).toContain('spare');
    expect(codes).not.toContain('vendor');
  });

  it('returns same:true for an unchanged fingerprint and changes it after an edit', async () => {
    const token = await loginAs('admin');
    const before = (await req('GET', '/api/v1/config', token)).json().fp as string;
    const same = await req('GET', `/api/v1/config?fp=${before}`, token);
    expect(same.json()).toEqual({ same: true, fp: before });
    const edit = await req('PUT', '/api/v1/lists/wait_reason/vendor', token, {
      label: 'Sent to vendor (changed)',
    });
    expect(edit.statusCode).toBe(200);
    const after = (await req('GET', '/api/v1/config', token)).json();
    expect(after.fp).not.toBe(before);
    expect(
      after.lists.wait_reason.find((row: { code: string }) => row.code === 'vendor').label,
    ).toBe('Sent to vendor (changed)');
  });

  it('sends people phones only to a login that may manage people, fingerprinted per audience', async () => {
    await admin.query('UPDATE person SET phone = $1 WHERE id = $2', ['+919999900001', TECH_PERSON]);
    const headPerson = '10000000-0000-0000-0000-000000000071';
    await admin.query('INSERT INTO person (id, tenant_id, name, team) VALUES ($1, $2, $3, $4)', [
      headPerson,
      A,
      'Phones Head',
      'maintenance',
    ]);
    await admin.query(
      `INSERT INTO login (id, tenant_id, person_id, username, password_hash, role, shared)
       SELECT $1, $2, $3, $4, password_hash, $5, false FROM login WHERE id = $6`,
      ['10000000-0000-0000-0000-000000000072', A, headPerson, 'phones-head', 'head', ADMIN_LOGIN],
    );
    const adminRes = await req('GET', '/api/v1/config', await loginAs('admin'));
    const techToken = await loginAs('tech');
    const techRes = await req('GET', '/api/v1/config', techToken);
    const headRes = await req('GET', '/api/v1/config', await loginAs('phones-head'));
    expect([adminRes.statusCode, techRes.statusCode, headRes.statusCode]).toEqual([200, 200, 200]);
    const adminBody = adminRes.json();
    const techBody = techRes.json();
    for (const p of techBody.people) expect(p).not.toHaveProperty('phone');
    for (const p of headRes.json().people) expect(p).not.toHaveProperty('phone');
    for (const p of adminBody.people) expect(p).toHaveProperty('phone');
    expect(adminBody.people.find((p: { id: string }) => p.id === TECH_PERSON).phone).toBe(
      '+919999900001',
    );
    expect(techBody.fp).not.toBe(adminBody.fp);
    const crossed = (await req('GET', `/api/v1/config?fp=${adminBody.fp}`, techToken)).json();
    expect(crossed).not.toHaveProperty('same');
    for (const p of crossed.people) expect(p).not.toHaveProperty('phone');
    const own = await req('GET', `/api/v1/config?fp=${techBody.fp}`, techToken);
    expect(own.json()).toEqual({ same: true, fp: techBody.fp });
  });

  it('only admin or head may write', async () => {
    const tech = await loginAs('tech');
    const denied = await req('PUT', '/api/v1/lists/wait_reason/vendor', tech, { label: 'x' });
    expect(denied.statusCode).toBe(403);
    expect(denied.json().error.code).toBe('forbidden');
  });

  it('updates features through /settings and reflects them in /config', async () => {
    const token = await loginAs('admin');
    const put = await req('PUT', '/api/v1/settings/features', token, {
      value: { general: false, pause: true },
    });
    expect(put.statusCode).toBe(200);
    const cfg = await req('GET', '/api/v1/config', token);
    expect(cfg.json().features.general).toBe(false);
  });

  it('reads settings and a list in the shared shape', async () => {
    const token = await loginAs('admin');
    const settings = await req('GET', '/api/v1/settings', token);
    expect(settings.statusCode).toBe(200);
    const list = await req('GET', '/api/v1/lists/wait_reason', token);
    expect(list.statusCode).toBe(200);
    expect(list.json().map((row: { code: string }) => row.code)).toEqual(['spare', 'vendor']);
  });

  it('fills a missing translation and removes it from the list', async () => {
    const token = await loginAs('admin');
    const put = await req('PUT', `/api/v1/translations/${ITEM_SPARE}`, token, { labelGu: 'સ્પેર' });
    expect(put.statusCode).toBe(200);
    const missing = await req('GET', '/api/v1/translations/missing', token);
    expect(missing.json().map((row: { code: string }) => row.code)).not.toContain('spare');
  });

  it('rejects unauthenticated /config', async () => {
    const cfg = await req('GET', '/api/v1/config');
    expect(cfg.statusCode).toBe(401);
  });
});

describe('M2-2.1 severity matrix settings', () => {
  const MACHINE = '10000000-0000-0000-0000-000000000041';

  it('rejects an invalid severity matrix', async () => {
    const token = await loginAs('admin');
    const put = await req('PUT', '/api/v1/settings/severity_matrix', token, {
      value: { default: { A: { stopped: 'S9', support: 'S2' } } },
    });
    expect(put.statusCode).toBe(422);
  });

  it('allows admin/head and forbids other roles from writing the matrix', async () => {
    const matrix = (await req('GET', '/api/v1/config', await loginAs('admin'))).json()
      .severityMatrix;
    const roles = ['head', 'operator', 'technician', 'supervisor', 'plant_head', 'board'] as const;
    for (const [index, role] of roles.entries()) {
      const personId = `10000000-0000-0000-0000-00000000006${index}`;
      await admin.query('INSERT INTO person (id, tenant_id, name, team) VALUES ($1, $2, $3, $4)', [
        personId,
        A,
        `Matrix ${role}`,
        'maintenance',
      ]);
      await admin.query(
        `INSERT INTO login (id, tenant_id, person_id, username, password_hash, role, shared)
         SELECT $1, $2, $3, $4, password_hash, $5, false FROM login WHERE id = $6`,
        [
          `10000000-0000-0000-0000-00000000005${index}`,
          A,
          personId,
          `matrix-${role}`,
          role,
          ADMIN_LOGIN,
        ],
      );
      const response = await req(
        'PUT',
        '/api/v1/settings/severity_matrix',
        await loginAs(`matrix-${role}`),
        {
          value: matrix,
        },
      );
      expect(response.statusCode, role).toBe(role === 'head' ? 200 : 403);
    }
  });

  it('saves a valid severity matrix, changes the config fingerprint, and serves it', async () => {
    const token = await loginAs('admin');
    const before = (await req('GET', '/api/v1/config', token)).json().fp as string;
    const matrix = {
      default: {
        A: { stopped: 'S1', support: 'S1' },
        B: { stopped: 'S2', support: 'S2' },
        C: { stopped: 'S3', support: 'S3' },
      },
      workRequest: 'S4',
      urgentWorkRequest: 'S2',
    };
    const put = await req('PUT', '/api/v1/settings/severity_matrix', token, { value: matrix });
    expect(put.statusCode).toBe(200);
    const cfg = await req('GET', '/api/v1/config', token);
    expect(cfg.json().severityMatrix).toEqual(matrix);
    expect(cfg.json().fp).not.toBe(before);
  });

  it('sets machine criticality and serves it in /config', async () => {
    await admin.query("INSERT INTO machine (id, tenant_id, code) VALUES ($1, $2, 'VC-SET')", [
      MACHINE,
      A,
    ]);
    const token = await loginAs('admin');
    const put = await req('PUT', `/api/v1/machines/${MACHINE}/criticality`, token, {
      criticality: 'A',
    });
    expect(put.statusCode).toBe(200);
    const cfg = await req('GET', '/api/v1/config', token);
    const machine = cfg.json().machines.find((row: { id: string }) => row.id === MACHINE);
    expect(machine.criticality).toBe('A');

    const clear = await req('PUT', `/api/v1/machines/${MACHINE}/criticality`, token, {
      criticality: null,
    });
    expect(clear.statusCode).toBe(200);
    const after = await req('GET', '/api/v1/config', token);
    expect(
      after.json().machines.find((row: { id: string }) => row.id === MACHINE).criticality,
    ).toBeNull();
  });

  it('rejects an invalid criticality value', async () => {
    const token = await loginAs('admin');
    const put = await req('PUT', `/api/v1/machines/${MACHINE}/criticality`, token, {
      criticality: 'D',
    });
    expect(put.statusCode).toBe(422);
  });

  it('rejects malformed criticality bodies without clearing the stored value', async () => {
    await admin.query("UPDATE machine SET criticality = 'A' WHERE id = $1", [MACHINE]);
    const token = await loginAs('admin');
    for (const payload of [{}, [], { criticality: 1 }, { criticality: 'D' }]) {
      const put = await req('PUT', `/api/v1/machines/${MACHINE}/criticality`, token, payload);
      expect(put.statusCode).toBe(422);
    }
    const nullBody = await app.inject({
      method: 'PUT',
      url: `/api/v1/machines/${MACHINE}/criticality`,
      headers: {
        host: 'cosmos.localhost',
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
      },
      payload: 'null',
    });
    expect(nullBody.statusCode).toBe(422);
    const stored = await admin.query('SELECT criticality FROM machine WHERE id = $1', [MACHINE]);
    expect(stored.rows[0].criticality).toBe('A');
  });

  it('forbids a technician from writing criticality', async () => {
    const tech = await loginAs('tech');
    const put = await req('PUT', `/api/v1/machines/${MACHINE}/criticality`, tech, {
      criticality: 'B',
    });
    expect(put.statusCode).toBe(403);
  });
});

describe('what /settings/:key accepts', () => {
  const ROLES = ['admin', 'head', 'plant_head', 'supervisor', 'technician', 'operator', 'board'];
  const tokens: Record<string, string> = {};
  const put = (key: string, token: string, value: unknown) =>
    req('PUT', `/api/v1/settings/${key}`, token, { value });

  beforeAll(async () => {
    for (const [index, role] of ROLES.entries()) {
      if (role === 'admin') {
        tokens[role] = await loginAs('admin');
        continue;
      }
      const personId = `10000000-0000-0000-0000-00000000008${index}`;
      await admin.query('INSERT INTO person (id, tenant_id, name, team) VALUES ($1, $2, $3, $4)', [
        personId,
        A,
        `Allow ${role}`,
        'maintenance',
      ]);
      await admin.query(
        `INSERT INTO login (id, tenant_id, person_id, username, password_hash, role, shared)
         SELECT $1, $2, $3, $4, password_hash, $5, false FROM login WHERE id = $6`,
        [
          `10000000-0000-0000-0000-00000000009${index}`,
          A,
          personId,
          `allow-${role}`,
          role,
          ADMIN_LOGIN,
        ],
      );
      tokens[role] = await loginAs(`allow-${role}`);
    }
  });

  it('refuses a key nobody has defined, and a key that only looks like one', async () => {
    for (const key of ['made_up', 'constructor', '__proto__', 'ai.consent', 'language']) {
      const res = await put(key, tokens.admin!, 'x');
      expect(res.statusCode, key).toBe(404);
      expect(res.json().error.code).toBe('not_found');
    }
    const stored = await admin.query('SELECT key FROM setting WHERE key = ANY($1)', [
      ['made_up', 'constructor', '__proto__', 'ai.consent'],
    ]);
    expect(stored.rows).toEqual([]);
  });

  it('lets only a head or admin switch features on and off', async () => {
    for (const role of ROLES) {
      const res = await put('features', tokens[role]!, { general: true, pause: true });
      expect(res.statusCode, role).toBe(['admin', 'head'].includes(role) ? 200 : 403);
    }
  });

  it('refuses a value of the wrong shape and keeps the old one', async () => {
    for (const value of ['yes', { general: 'yes' }, [], null, 3]) {
      expect((await put('features', tokens.admin!, value)).statusCode).toBe(422);
    }
    const cfg = await req('GET', '/api/v1/config', tokens.admin!);
    expect(cfg.json().features).toEqual({ general: true, pause: true });
  });

  it('lets only the admin set the AI monthly cap, and only to a positive number', async () => {
    for (const role of ROLES) {
      const res = await put('ai.monthlyCapUsd', tokens[role]!, 50);
      expect(res.statusCode, role).toBe(role === 'admin' ? 200 : 403);
    }
    for (const value of [0, -5, '50', null]) {
      expect((await put('ai.monthlyCapUsd', tokens.admin!, value)).statusCode).toBe(422);
    }
    const rows = await req('GET', '/api/v1/settings', tokens.admin!);
    expect(rows.json().find((row: { key: string }) => row.key === 'ai.monthlyCapUsd').value).toBe(
      50,
    );
  });
});
