import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { withTenant } from '@uptimo/db';
import {
  ErasedPersonError,
  ErasureKeyMissing,
  erasePerson,
  insertPeople,
} from '../src/modules/identity/index.js';
import { importBhavin } from '../src/modules/imports/bhavin.js';
import {
  makeOrdinaryTicket,
  makeSyntheticExport,
  seedSyntheticTenant,
  syntheticIds,
} from './import-fixture.js';
import { A, B, startPeopleApp, type PeopleApp } from './people-harness.js';

/** Built at runtime so no test file carries a key-shaped literal. */
const KEY = ['erasure', 'test', 'plant'].join('-').padEnd(40, 'x');
const PHONE = '+919000000111';
const NAME = 'Rajesh Kumar Test';
const REFUSED = /erased/i;

let t: PeopleApp;
let admin: string;
let bAdmin: string;

const create = (name: string, phone?: string, token = admin, call = t.call) =>
  call('POST', '/api/v1/people', token, { name, team: 'maintenance', ...(phone ? { phone } : {}) });

const eraseAs = (tenant: string, personId: string, ref: string) =>
  withTenant(t.db.router, tenant, (tx) =>
    erasePerson(tx, { tenantId: tenant, personId, requestRef: ref, operator: 'agent-test' }),
  );

beforeAll(async () => {
  process.env.ERASURE_HASH_KEY = KEY;
  t = await startPeopleApp();
  admin = await t.signIn('admin');
  bAdmin = await t.signIn('b-admin', 'plant-two.localhost');
  await seedSyntheticTenant(t.db.admin);
}, 120_000);

afterAll(async () => {
  delete process.env.ERASURE_HASH_KEY;
  await t.stop();
});

describe('an erased person stays erased', () => {
  let erasedId: string;

  it('refuses to erase at all when the key is missing, and changes nothing', async () => {
    const made = await create(NAME, PHONE);
    expect(made.statusCode, made.body).toBe(201);
    erasedId = made.json().id;
    delete process.env.ERASURE_HASH_KEY;
    await expect(eraseAs(A, erasedId, 'request-0001')).rejects.toBeInstanceOf(ErasureKeyMissing);
    process.env.ERASURE_HASH_KEY = KEY;
    const row = (
      await t.db.admin.query('SELECT name, active FROM person WHERE id = $1', [erasedId])
    ).rows[0];
    expect(row).toEqual({ name: NAME, active: true });
  });

  it('erases once the key is there', async () => {
    await eraseAs(A, erasedId, 'request-0002');
    const row = (
      await t.db.admin.query('SELECT name, erasure_hash FROM person WHERE id = $1', [erasedId])
    ).rows[0];
    expect(row.name).toBe('Former staff');
    expect(row.erasure_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('refuses to create the same person again, however the name is typed, with a clear 409', async () => {
    for (const name of [NAME, NAME.toUpperCase(), `  ${NAME.replace(' ', '   ')} `]) {
      const res = await create(name, PHONE);
      expect(res.statusCode, name).toBe(409);
      expect(res.json().error.code).toBe('conflict');
      expect(res.json().error.field).toBe('name');
      expect(res.json().error.message).toMatch(REFUSED);
      expect(res.body).not.toMatch(/rajesh|9000000111/i);
    }
    const count = await t.db.admin.query(
      'SELECT count(*)::int n FROM person WHERE tenant_id = $1 AND lower(name) = lower($2)',
      [A, NAME],
    );
    expect(count.rows[0].n).toBe(0);
  });

  const lastCreateAudit = async (tenant: string, id: string) =>
    (
      await t.db.admin.query(
        "SELECT after FROM audit_log WHERE tenant_id = $1 AND action = 'person.create' AND entity_id = $2",
        [tenant, id],
      )
    ).rows[0].after;

  it('lets the name through with no number or another one, and notes the possible match in the audit trail only', async () => {
    for (const phone of [undefined, '+919000000222']) {
      const res = await create(NAME, phone);
      expect(res.statusCode, res.body).toBe(201);
      expect(res.json()).not.toHaveProperty('possibleErasedMatch');
      expect(await lastCreateAudit(A, res.json().id)).toMatchObject({ possibleErasedMatch: true });
    }
  });

  it('does not flag a different name, or the same details in another plant', async () => {
    const other = await create('Rajesh Kumar Tester', PHONE);
    expect(other.statusCode).toBe(201);
    expect(await lastCreateAudit(A, other.json().id)).not.toHaveProperty('possibleErasedMatch');
    const elsewhere = await create(NAME, PHONE, bAdmin, t.callB);
    expect(elsewhere.statusCode).toBe(201);
    expect(await lastCreateAudit(B, elsewhere.json().id)).not.toHaveProperty('possibleErasedMatch');
  });

  it('never shows either hash in a reply, the audit trail or the refusal', async () => {
    const hashes = (
      await t.db.admin.query(
        'SELECT erasure_hash h, erasure_name_hash n FROM person WHERE id = $1',
        [erasedId],
      )
    ).rows[0];
    expect(hashes.h).not.toBe(hashes.n);
    const list = await t.call('GET', '/api/v1/people', admin);
    const refused = await create(NAME, PHONE);
    const audit = await t.db.admin.query('SELECT row_to_json(a)::text AS j FROM audit_log a');
    const seen = [list.body, refused.body, ...audit.rows.map((r) => r.j)].join('\n');
    expect(seen).not.toContain(hashes.h);
    expect(seen).not.toContain(hashes.n);
  });

  it('refuses to create anyone while the key is missing in a plant that has erased people, and creates freely in one that has none', async () => {
    delete process.env.ERASURE_HASH_KEY;
    try {
      const blocked = await create('Someone New', PHONE.replace('111', '333'));
      expect(blocked.statusCode).toBe(503);
      expect(blocked.json().error.code).toBe('not_configured');
      const free = await create('Someone Else', undefined, bAdmin, t.callB);
      expect(free.statusCode).toBe(201);
    } finally {
      process.env.ERASURE_HASH_KEY = KEY;
    }
  });

  it('refuses onboarding a person with the erased name and number, and lets one with no number in', async () => {
    const onboard = (phone: string | null) =>
      withTenant(t.db.app, A, (tx) =>
        insertPeople(
          tx,
          A,
          [
            {
              name: NAME,
              team: 'maintenance',
              title: null,
              phone,
              defaultShift: null,
              login: null,
            },
          ],
          'unused-hash',
        ),
      );
    await expect(onboard(PHONE)).rejects.toBeInstanceOf(ErasedPersonError);
    await expect(onboard(null)).resolves.toBeUndefined();
  });
});

describe('editing a person into an erased identity', () => {
  const NAME2 = 'Pooja Erased Test';
  const PHONE2 = '+919000000555';
  const edit = (id: string, body: object) => t.call('PUT', `/api/v1/people/${id}`, admin, body);

  beforeAll(async () => {
    const made = await create(NAME2, PHONE2);
    expect(made.statusCode, made.body).toBe(201);
    await eraseAs(A, made.json().id, 'request-0200');
  });

  it('refuses giving someone the erased number when they already have the erased name', async () => {
    const made = await create(NAME2);
    expect(made.statusCode, made.body).toBe(201);
    const res = await edit(made.json().id, { phone: PHONE2 });
    expect(res.statusCode, res.body).toBe(409);
    expect(res.json().error.field).toBe('name');
    expect(res.body).not.toMatch(/pooja|9000000555/i);
  });

  it('refuses giving someone the erased name when they already have the erased number', async () => {
    const made = await create('Someone With That Number', PHONE2);
    expect(made.statusCode, made.body).toBe(201);
    const res = await edit(made.json().id, { name: NAME2 });
    expect(res.statusCode, res.body).toBe(409);
    expect(res.json().error.field).toBe('name');
  });

  it('still lets an edit through that does not make an erased pair', async () => {
    const made = await create('Plain Colleague', '+919000000556');
    const res = await edit(made.json().id, { title: 'Fitter', name: 'Plain Colleague Two' });
    expect(res.statusCode, res.body).toBe(200);
  });

  it('does not let an erased person be renamed back to a real name', async () => {
    const erased = (
      await t.db.admin.query(
        "SELECT id FROM person WHERE tenant_id = $1 AND erasure_hash IS NOT NULL AND name = 'Former staff' LIMIT 1",
        [A],
      )
    ).rows[0].id as string;
    const res = await edit(erased, { name: 'A Real Name' });
    expect(res.statusCode, res.body).toBe(409);
    expect(res.json().error.message).toMatch(/cannot be changed/);
    const number = await edit(erased, { phone: '+919000000557' });
    expect(number.statusCode, number.body).toBe(409);
  });

  it('lets a form save another field of an erased person with the same name resent', async () => {
    const erased = (
      await t.db.admin.query(
        "SELECT id FROM person WHERE tenant_id = $1 AND erasure_hash IS NOT NULL AND name = 'Former staff' LIMIT 1",
        [A],
      )
    ).rows[0].id as string;
    const res = await edit(erased, { name: 'Former staff', title: 'Fitter' });
    expect(res.statusCode, res.body).toBe(200);
  });
});

describe('an import that creates someone with an erased name', () => {
  const MIRA = 'Mira Former';

  it('still imports, and lists the possible match by row number only', async () => {
    const ids = syntheticIds;
    const mira = (
      await t.db.admin.query(
        "INSERT INTO person (tenant_id, name, team, phone) VALUES ($1, $2, 'maintenance', '+919000000444') RETURNING id",
        [ids.tenant, MIRA],
      )
    ).rows[0].id as string;
    await eraseAs(ids.tenant, mira, 'request-0100');

    const input = makeSyntheticExport([makeOrdinaryTicket({ reportedByPerson: MIRA })]);
    const out = await importBhavin(t.db.app, ids.tenant, input);
    expect(out.stats).toMatchObject({
      imported: 1,
      errored: 0,
      possiblyErasedMatches: 1,
      status: 'done',
    });
    expect(out.stats.issues).toContainEqual(
      expect.objectContaining({ code: 'possible_erased_match', rowNumber: expect.any(Number) }),
    );
    const hashes = (
      await t.db.admin.query(
        'SELECT erasure_hash h, erasure_name_hash n FROM person WHERE id = $1',
        [mira],
      )
    ).rows[0];
    // (The batch lists the people it created by name, as before; the new report carries no name.)
    expect(JSON.stringify(out.stats.issues)).not.toContain('Mira');
    const seen = JSON.stringify(out.stats);
    expect(seen).not.toContain(hashes.h);
    expect(seen).not.toContain(hashes.n);
  });

  it('flags nothing when no name matches', async () => {
    const input = makeSyntheticExport([
      makeOrdinaryTicket({ legacyId: 'synthetic-legacy-0300', ref: 'BD-0300' }),
    ]);
    const out = await importBhavin(t.db.app, syntheticIds.tenant, input);
    expect(out.stats.possiblyErasedMatches).toBe(0);
  });
});
