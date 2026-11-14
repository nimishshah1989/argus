import { randomUUID } from 'node:crypto';
import { hash } from '@node-rs/argon2';
import type { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { startTestDb, type TestDb } from './harness.js';

// DOMAIN §3: a shared phone is used by the plant's active people of the team its role serves. The list the phone is
// shown and the check on its choice are one rule: whoever is listed can be chosen, and nobody else can.
const TENANT = '83000000-0000-0000-0000-000000000001';
const OTHER = '83000000-0000-0000-0000-000000000002';
const PASSWORD = 'correct-horse-battery';
const HOST = 'choices.localhost';

type App = Awaited<ReturnType<typeof buildApp>>;
let db: TestDb;
let admin: Pool;
let app: App;
const people: Record<string, string> = {};
let asha = '';

const SHARED_ROLES = [
  'operator',
  'technician',
  'supervisor',
  'head',
  'plant_head',
  'admin',
  'board',
];
const EXPECTED: Record<string, string[]> = {
  operator: ['floor', 'floor2'],
  technician: ['fitter'],
  supervisor: ['floor', 'floor2', 'fitter'],
  head: ['floor', 'floor2', 'fitter'],
  plant_head: ['floor', 'floor2', 'fitter'],
  admin: [],
  board: ['floor', 'floor2', 'fitter'],
};

const call = (method: 'GET' | 'POST', url: string, token: string | null, payload?: object) =>
  app.inject({
    method,
    url,
    headers: {
      host: HOST,
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    ...(payload ? { payload } : {}),
  });

const signIn = async (username: string, actingPersonId?: string) =>
  call('POST', '/api/v1/auth/login', null, {
    username,
    password: PASSWORD,
    ...(actingPersonId ? { actingPersonId } : {}),
  });

const listed = async (token: string) => {
  const res = await call('GET', '/api/v1/auth/acting', token);
  expect(res.statusCode, res.body).toBe(200);
  return res.json().people as Array<{ id: string; name: string; team: string }>;
};

const ids = (names: string[]) => names.map((name) => people[name]!).sort();

describe('a phone whose chosen person stops being allowed', () => {
  const phoneActing = async (token: string) =>
    (await call('GET', '/api/v1/auth/me', token)).json().user.actingPersonId as string;

  it('is asked again on the very next request, and works once a valid person is chosen', async () => {
    const token = (await signIn('phone-operator', people.floor)).json().token as string;
    expect(await phoneActing(token)).toBe(people.floor);
    expect((await call('GET', '/api/v1/state', token)).statusCode).toBe(200);
    // an admin moves the person to another team while the phone is acting as them
    await admin.query("UPDATE person SET team = 'maintenance' WHERE id = $1", [people.floor]);
    try {
      const refused = await call('GET', '/api/v1/state', token);
      expect(refused.statusCode, refused.body).toBe(403);
      expect(refused.json().error.code).toBe('choose_acting_person');
      expect(await phoneActing(token)).toBe('');
      expect((await call('GET', '/api/v1/auth/acting', token)).statusCode).toBe(200);
      const chosen = await call('POST', '/api/v1/auth/acting', token, {
        actingPersonId: people.floor2,
      });
      expect(chosen.statusCode, chosen.body).toBe(200);
      expect((await call('GET', '/api/v1/state', token)).statusCode).toBe(200);
    } finally {
      await admin.query("UPDATE person SET team = 'production' WHERE id = $1", [people.floor]);
    }
  });

  it('is asked again when the person was switched off behind its back, instead of the phone losing its sign-in', async () => {
    const token = (await signIn('phone-operator', people.floor2)).json().token as string;
    await admin.query('UPDATE person SET active = false WHERE id = $1', [people.floor2]);
    try {
      const refused = await call('GET', '/api/v1/state', token);
      expect(refused.statusCode, refused.body).toBe(403);
      expect(refused.json().error.code).toBe('choose_acting_person');
    } finally {
      await admin.query('UPDATE person SET active = true WHERE id = $1', [people.floor2]);
    }
    expect(
      (await call('POST', '/api/v1/auth/acting', token, { actingPersonId: people.floor }))
        .statusCode,
    ).toBe(200);
  });

  it('leaves a phone whose person is still allowed, and a personal login, exactly as they were', async () => {
    const phone = (await signIn('phone-head', people.fitter)).json().token as string;
    expect(await phoneActing(phone)).toBe(people.fitter);
    expect((await call('GET', '/api/v1/state', phone)).statusCode).toBe(200);
    const personal = (await signIn('asha')).json().token as string;
    expect(await phoneActing(personal)).toBe(people.fitter);
    expect((await call('GET', '/api/v1/state', personal)).statusCode).toBe(200);
  });
});

describe('who a shared phone may choose', () => {
  it.each(SHARED_ROLES)(
    'a %s phone is shown, and may choose, exactly its own teams',
    async (role) => {
      const token = (await signIn(`phone-${role}`)).json().token as string;
      const shown = (await listed(token)).map((p) => p.id).sort();
      expect(shown).toEqual(ids(EXPECTED[role]!));

      const accepted: string[] = [];
      for (const [name, id] of Object.entries(people)) {
        const chosen = await call('POST', '/api/v1/auth/acting', token, { actingPersonId: id });
        if (chosen.statusCode === 200) accepted.push(id);
        else {
          expect(chosen.statusCode, `${role} choosing ${name}`).toBe(422);
          expect(chosen.json().error).toMatchObject({
            code: 'validation',
            field: 'actingPersonId',
          });
        }
      }
      expect(accepted.sort()).toEqual(shown);
    },
  );

  it.each(SHARED_ROLES)(
    'a %s phone signing in with a person is held to the same rule',
    async (role) => {
      const shown = (await listed((await signIn(`phone-${role}`)).json().token)).map((p) => p.id);
      for (const [name, id] of Object.entries(people)) {
        const res = await signIn(`phone-${role}`, id);
        expect(res.statusCode === 200, `${role} signing in as ${name}`).toBe(shown.includes(id));
      }
    },
  );

  it('refuses a choice the phone is not allowed and leaves who is using it unchanged', async () => {
    const token = (await signIn('phone-operator', people.floor)).json().token as string;
    const refused = await call('POST', '/api/v1/auth/acting', token, {
      actingPersonId: people.fitter,
    });
    expect(refused.statusCode).toBe(422);
    const me = (await call('GET', '/api/v1/auth/me', token)).json().user;
    expect(me.actingPersonId).toBe(people.floor);
  });

  it('never lists a vendor or a person who is switched off, on any phone', async () => {
    for (const role of SHARED_ROLES) {
      const shown = (await listed((await signIn(`phone-${role}`)).json().token)).map((p) => p.id);
      expect(shown, role).not.toContain(people.vendor);
      expect(shown, role).not.toContain(people.retired);
    }
  });

  it('lists names and teams only, and only this plant’s people', async () => {
    const token = (await signIn('phone-head')).json().token as string;
    const shown = await listed(token);
    for (const person of shown) expect(Object.keys(person).sort()).toEqual(['id', 'name', 'team']);
    expect(shown.map((p) => p.id)).not.toContain(people.elsewhere);
    const strangers = await call('POST', '/api/v1/auth/acting', token, {
      actingPersonId: people.elsewhere,
    });
    expect(strangers.statusCode).toBe(422);
  });

  it('is open to a phone with nobody chosen yet (that is when the picker asks), and to no personal login', async () => {
    const token = (await signIn('phone-operator')).json().token as string;
    expect((await call('GET', '/api/v1/auth/me', token)).json().user.actingPerson).toBeNull();
    expect((await call('GET', '/api/v1/auth/acting', token)).statusCode).toBe(200);
    const personal = (await signIn('asha')).json().token as string;
    const refused = await call('GET', '/api/v1/auth/acting', personal);
    expect(refused.statusCode).toBe(403);
    expect(refused.json().error.code).toBe('forbidden');
    expect((await call('GET', '/api/v1/auth/acting', null)).statusCode).toBe(401);
  });
});

beforeAll(async () => {
  db = await startTestDb();
  admin = db.admin;
  const passwordHash = await hash(PASSWORD, {
    algorithm: 2,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
  await admin.query(
    "INSERT INTO tenant (id, slug, name) VALUES ($1, 'choices', 'Choices'), ($2, 'elsewhere', 'Elsewhere')",
    [TENANT, OTHER],
  );
  const add = async (name: string, team: string, active = true, tenant = TENANT) => {
    people[name] = randomUUID();
    await admin.query(
      'INSERT INTO person (id, tenant_id, name, team, active) VALUES ($1, $2, $3, $4, $5)',
      [people[name], tenant, name, team, active],
    );
  };
  await add('floor', 'production');
  await add('floor2', 'production');
  await add('fitter', 'maintenance');
  await add('vendor', 'vendor');
  await add('retired', 'production', false);
  await add('elsewhere', 'production', true, OTHER);
  asha = people.fitter!;
  const login = (username: string, role: string, shared: boolean, person: string | null) =>
    admin.query(
      'INSERT INTO login (tenant_id, person_id, username, password_hash, role, shared) VALUES ($1, $2, $3, $4, $5, $6)',
      [TENANT, person, username, passwordHash, role, shared],
    );
  for (const role of SHARED_ROLES) await login(`phone-${role}`, role, true, null);
  await login('asha', 'technician', false, asha);
  app = await buildApp({ pool: db.app, logger: false, rateLimitMax: 100000 });
}, 120_000);

afterAll(async () => {
  await app.close();
  await db.stop();
});
