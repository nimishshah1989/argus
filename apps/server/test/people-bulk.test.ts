import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { A, PASSWORD, ROLES, startPeopleApp, type PeopleApp, TEMP } from './people-harness.js';

/**
 * MILESTONES 21 goal 1's bulk half (LOCK: "switching a person off needs a reason", "sign out devices, each
 * confirmed with a reason and a count") and the last sign-in the people and logins lists now carry.
 */

let t: PeopleApp;
let admin: string;
let n = 0;

interface Person {
  id: string;
  name: string;
  active: boolean;
  lastSignInAt: string | null;
}
interface Login {
  id: string;
  username: string;
  personId: string | null;
  lastSignInAt: string | null;
}

const PEOPLE = '/api/v1/people';
const LOGINS = '/api/v1/logins';

async function makePerson(extra: object = {}): Promise<Person> {
  const res = await t.call('POST', PEOPLE, admin, {
    name: `Bulk Person ${++n}`,
    team: 'maintenance',
    ...extra,
  });
  expect(res.statusCode, res.body).toBe(201);
  return res.json() as Person;
}

async function makeLogin(personId: string, username = `bulk-${++n}`): Promise<Login> {
  const res = await t.call('POST', LOGINS, admin, {
    username,
    role: 'technician',
    shared: false,
    personId,
    temporaryPassword: TEMP,
  });
  expect(res.statusCode, res.body).toBe(201);
  return res.json() as Login;
}

const people = async (): Promise<Person[]> =>
  (await t.call('GET', PEOPLE, admin)).json().items as Person[];
const logins = async (): Promise<Login[]> =>
  (await t.call('GET', LOGINS, admin)).json().items as Login[];

async function trail(entityId: string) {
  const rows = (
    await t.db.admin.query(
      `SELECT action, before, after FROM audit_log
       WHERE tenant_id = $1 AND entity_id = $2 ORDER BY at, id`,
      [A, entityId],
    )
  ).rows as {
    action: string;
    before: Record<string, unknown> | null;
    after: Record<string, unknown>;
  }[];
  return rows;
}

const newestSession = async (loginId: string): Promise<string> => {
  const row = (
    await t.db.admin.query('SELECT max(created_at) AS at FROM session WHERE login_id = $1', [
      loginId,
    ])
  ).rows[0];
  return (row.at as Date).toISOString();
};

beforeAll(async () => {
  t = await startPeopleApp();
  admin = await t.signIn('admin');
}, 120_000);

afterAll(() => t.stop());

describe('the last sign-in the lists carry', () => {
  it('is null until a login signs in, then the newest session start', async () => {
    const person = await makePerson();
    const login = await makeLogin(person.id);
    expect(login.lastSignInAt).toBeNull();

    expect((await people()).find((p) => p.id === person.id)?.lastSignInAt).toBeNull();
    expect((await logins()).find((l) => l.id === login.id)?.lastSignInAt).toBeNull();

    await t.signIn(login.username, undefined, TEMP);
    const first = await newestSession(login.id);
    expect((await logins()).find((l) => l.id === login.id)?.lastSignInAt).toBe(first);
    expect((await people()).find((p) => p.id === person.id)?.lastSignInAt).toBe(first);

    await new Promise((resolve) => setTimeout(resolve, 5));
    await t.signIn(login.username, undefined, TEMP);
    const second = await newestSession(login.id);
    expect(second > first).toBe(true);
    expect((await people()).find((p) => p.id === person.id)?.lastSignInAt).toBe(second);
  });

  it('keeps the newest sign-in after a sign-out, because the session remains as a row', async () => {
    const person = await makePerson();
    const login = await makeLogin(person.id);
    await t.signIn(login.username, undefined, TEMP);
    const at = await newestSession(login.id);
    await t.call('POST', `${PEOPLE}/${person.id}/sign-out`, admin, { reason: 'New phone' });
    expect((await logins()).find((l) => l.id === login.id)?.lastSignInAt).toBe(at);
  });
});

describe('switching a person off with a reason', () => {
  it('keeps the reason on the audit line, never before', async () => {
    const person = await makePerson();
    const res = await t.call('PUT', `${PEOPLE}/${person.id}`, admin, {
      active: false,
      reason: '  Retired on 17 Nov  ',
    });
    expect(res.statusCode, res.body).toBe(200);
    const row = (await trail(person.id)).find((r) => r.action === 'person.switch_off');
    expect(row).toBeDefined();
    expect(row!.after.reason).toBe('Retired on 17 Nov');
    expect(row!.before).not.toHaveProperty('reason');
  });

  it('still allows a switch-off without a reason, and stores none', async () => {
    const person = await makePerson();
    const res = await t.call('PUT', `${PEOPLE}/${person.id}`, admin, { active: false });
    expect(res.statusCode, res.body).toBe(200);
    const row = (await trail(person.id)).find((r) => r.action === 'person.switch_off');
    expect(row!.after).not.toHaveProperty('reason');
  });

  it('ignores the reason on any other edit, including switch-on', async () => {
    const person = await makePerson();
    const edit = await t.call('PUT', `${PEOPLE}/${person.id}`, admin, {
      title: 'Lead',
      reason: 'because',
    });
    expect(edit.statusCode, edit.body).toBe(200);
    const update = (await trail(person.id)).find((r) => r.action === 'person.update');
    expect(update!.after).not.toHaveProperty('reason');

    await t.call('PUT', `${PEOPLE}/${person.id}`, admin, { active: false });
    const on = await t.call('PUT', `${PEOPLE}/${person.id}`, admin, {
      active: true,
      reason: 'back',
    });
    expect(on.statusCode, on.body).toBe(200);
    const switchOn = (await trail(person.id)).find((r) => r.action === 'person.switch_on');
    expect(switchOn!.after).not.toHaveProperty('reason');
  });

  it('refuses a reason over 500 characters and a reason on its own', async () => {
    const person = await makePerson();
    const tooLong = await t.call('PUT', `${PEOPLE}/${person.id}`, admin, {
      active: false,
      reason: 'x'.repeat(501),
    });
    expect(tooLong.statusCode).toBe(422);
    expect(tooLong.json().error.field).toBe('reason');
    const alone = await t.call('PUT', `${PEOPLE}/${person.id}`, admin, { reason: 'only this' });
    expect(alone.statusCode).toBe(422);
  });
});

describe('signing a person out of every device', () => {
  it('ends every session of that person, replies with the count and audits the reason', async () => {
    const person = await makePerson();
    const login = await makeLogin(person.id);
    const first = (
      await t.call('POST', '/api/v1/auth/login', undefined, {
        username: login.username,
        password: TEMP,
      })
    ).json().token as string;
    const second = (
      await t.call('POST', '/api/v1/auth/login', undefined, {
        username: login.username,
        password: TEMP,
      })
    ).json().token as string;

    const res = await t.call('POST', `${PEOPLE}/${person.id}/sign-out`, admin, {
      reason: 'Phone lost on site',
    });
    expect(res.statusCode, res.body).toBe(200);
    expect(res.json()).toEqual({ ended: 2 });
    expect((await t.call('GET', '/api/v1/auth/me', first)).statusCode).toBe(401);
    expect((await t.call('GET', '/api/v1/auth/me', second)).statusCode).toBe(401);

    const row = (await trail(person.id)).find((r) => r.action === 'person.sign_out');
    expect(row).toBeDefined();
    expect(row!.after).toMatchObject({ ended: 2, reason: 'Phone lost on site' });
  });

  it('leaves everyone else signed in', async () => {
    const person = await makePerson();
    await makeLogin(person.id);
    expect(
      (await t.call('POST', `${PEOPLE}/${person.id}/sign-out`, admin, { reason: 'Tidy up' }))
        .statusCode,
    ).toBe(200);
    expect((await t.call('GET', PEOPLE, admin)).statusCode).toBe(200);
  });

  it('names the reason when it is missing or blank', async () => {
    const person = await makePerson();
    for (const body of [{}, { reason: '' }, { reason: '   ' }]) {
      const res = await t.call('POST', `${PEOPLE}/${person.id}/sign-out`, admin, body);
      expect(res.statusCode, JSON.stringify(body)).toBe(422);
      expect(res.json().error.field).toBe('reason');
    }
  });

  it('is the admin’s alone', async () => {
    const person = await makePerson();
    for (const role of ROLES) {
      const token = await t.signIn(role);
      const res = await t.call('POST', `${PEOPLE}/${person.id}/sign-out`, token, {
        reason: 'nope',
      });
      expect(res.statusCode, role).toBe(403);
    }
  });

  it('answers 404 to an unknown person, and to another customer’s', async () => {
    expect(
      (
        await t.call('POST', `${PEOPLE}/10000000-0000-4000-8000-0000000000ff/sign-out`, admin, {
          reason: 'x',
        })
      ).statusCode,
    ).toBe(404);
    expect(
      (await t.call('POST', `${PEOPLE}/not-a-uuid/sign-out`, admin, { reason: 'x' })).statusCode,
    ).toBe(404);
    const bAdmin = await t.signIn('b-admin', 'plant-two.localhost');
    const mine = await makePerson();
    expect(
      (await t.callB('POST', `${PEOPLE}/${mine.id}/sign-out`, bAdmin, { reason: 'x' })).statusCode,
    ).toBe(404);
  });

  it('keeps change-shift and switch-off as client loops: no bulk endpoint exists', async () => {
    expect((await t.call('POST', `${PEOPLE}/bulk`, admin, { ids: [] })).statusCode).toBe(404);
    const patch = await t.app.inject({
      method: 'PATCH',
      url: PEOPLE,
      headers: { host: 'cosmos.localhost', authorization: `Bearer ${admin}` },
    });
    expect(patch.statusCode).toBe(404);
    // The loop's own calls still work, each audited.
    const person = await makePerson();
    const res = await t.call('PUT', `${PEOPLE}/${person.id}`, admin, {
      active: false,
      reason: 'Left',
    });
    expect(res.statusCode, res.body).toBe(200);
  });
});

describe('a sign-in the screen already shows', () => {
  it('keeps the shared phone’s login list readable with its own last sign-in', async () => {
    const rows = await logins();
    expect(rows.every((row) => 'lastSignInAt' in row)).toBe(true);
    const adminLogin = rows.find((row) => row.username === 'admin');
    expect(adminLogin?.lastSignInAt).not.toBeNull();
    expect(new Date(adminLogin!.lastSignInAt!).toISOString()).toBe(adminLogin!.lastSignInAt);
    // The password sign-in the harness used is the newest one for that login.
    const res = await t.call('POST', '/api/v1/auth/login', undefined, {
      username: 'admin',
      password: PASSWORD,
    });
    expect(res.statusCode).toBe(200);
  });
});
