import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { A, B, ROLES, startPeopleApp, type PeopleApp, TEMP, pw } from './people-harness.js';

let t: PeopleApp;
let admin: string;
let bAdmin: string;
let n = 0;

const PHONE = '+919000000001';
const person = (extra: object = {}) => ({
  name: `Test Person ${++n}`,
  team: 'maintenance',
  ...extra,
});

async function rows(tenant = A) {
  return (
    await t.db.admin.query(
      'SELECT action, entity, entity_id, login_id, before, after FROM audit_log WHERE tenant_id = $1 ORDER BY created_at, id',
      [tenant],
    )
  ).rows;
}

async function addPerson(extra: object = {}): Promise<{ id: string; name: string }> {
  const res = await t.call('POST', '/api/v1/people', admin, person(extra));
  expect(res.statusCode, res.body).toBe(201);
  return res.json();
}

async function addLogin(username: string, extra: object = {}): Promise<string> {
  const { id: personId } = await addPerson();
  const body = { username, role: 'technician', shared: false, personId, ...extra };
  const res = await t.call('POST', '/api/v1/logins', admin, {
    temporaryPassword: TEMP,
    ...body,
  });
  expect(res.statusCode, res.body).toBe(201);
  return res.json().id;
}

beforeAll(async () => {
  t = await startPeopleApp();
  admin = await t.signIn('admin');
  bAdmin = await t.signIn('b-admin', 'plant-two.localhost');
}, 120_000);

afterAll(() => t.stop());

describe('who may manage people and logins', () => {
  const calls: [string, 'GET' | 'POST' | 'PUT', object?][] = [
    ['/api/v1/people', 'GET'],
    ['/api/v1/people', 'POST', person()],
    ['/api/v1/people/10000000-0000-4000-8000-000000000001', 'PUT', { name: 'X' }],
    ['/api/v1/logins', 'GET'],
    ['/api/v1/logins', 'POST', { username: 'nope', role: 'operator', shared: true }],
    ['/api/v1/logins/10000000-0000-4000-8000-000000000001', 'PUT', { role: 'head' }],
  ];

  it.each(ROLES)('answers 403 to every route for %s, and changes nothing', async (role) => {
    const token = await t.signIn(role);
    const before = (await rows()).length;
    for (const [url, method, payload] of calls)
      expect((await t.call(method, url, token, payload)).statusCode, `${method} ${url}`).toBe(403);
    expect((await rows()).length).toBe(before);
  });

  it('answers 401 without a sign-in and 200 to the admin', async () => {
    for (const [url, method, payload] of calls)
      expect((await t.call(method, url, undefined, payload)).statusCode).toBe(401);
    expect((await t.call('GET', '/api/v1/people', admin)).statusCode).toBe(200);
    expect((await t.call('GET', '/api/v1/logins', admin)).statusCode).toBe(200);
  });
});

describe('people', () => {
  it('adds, lists and edits a person; the admin sees the phone', async () => {
    const created = await addPerson({ phone: PHONE, title: 'Setter', cell: 'Cell-1' });
    expect(created).toMatchObject({ phone: PHONE, title: 'Setter', cell: 'Cell-1', active: true });
    const edit = await t.call('PUT', `/api/v1/people/${created.id}`, admin, {
      name: 'Renamed Person',
      team: 'production',
      title: null,
    });
    expect(edit.statusCode, edit.body).toBe(200);
    const listed = (await t.call('GET', '/api/v1/people', admin)).json().items;
    expect(listed.find((p: { id: string }) => p.id === created.id)).toMatchObject({
      name: 'Renamed Person',
      team: 'production',
      title: null,
      phone: PHONE,
    });
  });

  it.each([
    '9000000001',
    '+0123456789',
    '+91 90000 00001',
    '+91-9000000001',
    '+9190000',
    '+1234567890123456',
    '+91900000000a',
    '00919000000001',
  ])('refuses the phone %s with 422 and says why', async (bad) => {
    const before = (await rows()).length;
    const res = await t.call('POST', '/api/v1/people', admin, person({ phone: bad }));
    expect(res.statusCode).toBe(422);
    expect(res.json().error).toMatchObject({ code: 'validation', field: 'phone' });
    expect(res.json().error.message).toMatch(/\+/);
    const own = await addPerson();
    const edit = await t.call('PUT', `/api/v1/people/${own.id}`, admin, { phone: bad });
    expect(edit.statusCode).toBe(422);
    expect((await rows()).length).toBe(before + 1);
  });

  it('accepts 8 to 15 digits and an empty phone', async () => {
    for (const ok of ['+12345678', '+123456789012345', '', null, undefined])
      expect(
        (await t.call('POST', '/api/v1/people', admin, person({ phone: ok }))).statusCode,
      ).toBe(201);
    const none = await addPerson({ phone: '' });
    expect(none).toMatchObject({ phone: null });
  });

  it('answers 409 when the number belongs to someone else, even after an edit', async () => {
    await addPerson({ phone: '+919000000003' });
    expect(
      (await t.call('POST', '/api/v1/people', admin, person({ phone: '+919000000003' })))
        .statusCode,
    ).toBe(409);
    const other = await addPerson();
    const edit = await t.call('PUT', `/api/v1/people/${other.id}`, admin, {
      phone: '+919000000003',
    });
    expect(edit.statusCode).toBe(409);
  });

  it('refuses unknown fields, an empty edit, a bad team and a bad id', async () => {
    const p = await addPerson();
    for (const body of [{ role: 'admin' }, {}, { team: 'cafeteria' }, { name: '  ' }])
      expect((await t.call('PUT', `/api/v1/people/${p.id}`, admin, body)).statusCode).toBe(422);
    expect((await t.call('PUT', '/api/v1/people/not-an-id', admin, { name: 'X' })).statusCode).toBe(
      404,
    );
    expect(
      (await t.call('POST', '/api/v1/people', admin, person({ pending: false }))).statusCode,
    ).toBe(422);
  });

  it('writes one audit row per change, with before and after, never the phone', async () => {
    const start = (await rows()).length;
    const p = await addPerson({ phone: '+919000000004' });
    await t.call('PUT', `/api/v1/people/${p.id}`, admin, { title: 'Lead' });
    await t.call('PUT', `/api/v1/people/${p.id}`, admin, { active: false });
    await t.call('PUT', `/api/v1/people/${p.id}`, admin, { active: true });
    const mine = (await rows()).slice(start);
    expect(mine.map((r) => r.action)).toEqual([
      'person.create',
      'person.update',
      'person.switch_off',
      'person.switch_on',
    ]);
    expect(mine.every((r) => r.entity === 'person' && r.entity_id === p.id)).toBe(true);
    const adminLogin = (await t.db.admin.query("SELECT id FROM login WHERE username = 'admin'"))
      .rows[0].id;
    expect(mine.every((r) => r.login_id === adminLogin)).toBe(true);
    expect(mine[1].before.title).toBeNull();
    expect(mine[1].after.title).toBe('Lead');
    expect(mine[2].before.active).toBe(true);
    expect(mine[2].after.active).toBe(false);
    expect(JSON.stringify(mine)).not.toContain('9000000004');
  });

  it('keeps one customer out of the other: no reads, no edits, no logins on its people', async () => {
    const mine = await addPerson({ phone: '+919000000005' });
    const theirs = (
      await t.callB('POST', '/api/v1/people', bAdmin, person({ name: 'Bina Only' }))
    ).json();
    const aList = JSON.stringify((await t.call('GET', '/api/v1/people', admin)).json());
    const bList = JSON.stringify(
      (await t.callB('GET', '/api/v1/people', bAdmin, undefined)).json(),
    );
    expect(aList).not.toContain('Bina Only');
    expect(bList).toContain('Bina Only');
    expect(bList).not.toContain(mine.name);
    expect(
      (await t.call('PUT', `/api/v1/people/${theirs.id}`, admin, { name: 'Hacked' })).statusCode,
    ).toBe(404);
    const login = await t.call('POST', '/api/v1/logins', admin, {
      username: 'cross',
      role: 'operator',
      shared: false,
      personId: theirs.id,
      temporaryPassword: TEMP,
    });
    expect(login.statusCode).toBe(404);
    const after = await t.db.admin.query('SELECT name FROM person WHERE id = $1', [theirs.id]);
    expect(after.rows[0].name).toBe('Bina Only');
    expect((await rows(B)).map((r) => r.action)).toEqual(['person.create']);
    expect(B).not.toBe(A);
  });
});

describe('logins', () => {
  it('adds a login with a temporary password that must be changed, then clears the flag', async () => {
    const id = await addLogin('new.tech');
    const listed = (await t.call('GET', '/api/v1/logins', admin)).json().items;
    const row = listed.find((l: { id: string }) => l.id === id);
    expect(row).toMatchObject({
      username: 'new.tech',
      role: 'technician',
      shared: false,
      mustChangePassword: true,
      active: true,
    });
    expect(JSON.stringify(listed)).not.toMatch(/argon2|password_hash|Temp-pass/);
    const first = await t.call('POST', '/api/v1/auth/login', undefined, {
      username: 'new.tech',
      password: TEMP,
    });
    expect(first.statusCode).toBe(200);
    expect(first.json().user.mustChangePassword).toBe(true);
    const change = await t.call('POST', '/api/v1/auth/password', first.json().token, {
      old: TEMP,
      password: pw('better'),
    });
    expect(change.statusCode).toBe(200);
    const me = await t.call('GET', '/api/v1/auth/me', first.json().token);
    expect(me.json().user.mustChangePassword).toBe(false);
    const after = (await t.call('GET', '/api/v1/logins', admin)).json().items;
    expect(after.find((l: { id: string }) => l.id === id).mustChangePassword).toBe(false);
  });

  it('adds a shared login with a cell and no person', async () => {
    const res = await t.call('POST', '/api/v1/logins', admin, {
      username: 'cell-two',
      role: 'operator',
      shared: true,
      cell: 'Cell-2',
      temporaryPassword: TEMP,
    });
    expect(res.statusCode, res.body).toBe(201);
    expect(res.json()).toMatchObject({ shared: true, personId: null, cell: 'Cell-2' });
  });

  it('refuses mixed-up logins: personal without a person, shared with one, a cell on a personal login', async () => {
    const p = await addPerson();
    const base = { role: 'operator', temporaryPassword: TEMP };
    const bad = [
      { ...base, username: 'bad.one', shared: false },
      { ...base, username: 'bad.two', shared: true, personId: p.id },
      { ...base, username: 'bad.three', shared: false, personId: p.id, cell: 'Cell-1' },
      { ...base, username: 'Upper.Case', shared: true },
      { ...base, username: 'bad.four', shared: true, role: 'root' },
    ];
    for (const body of bad)
      expect(
        (await t.call('POST', '/api/v1/logins', admin, body)).statusCode,
        JSON.stringify(body),
      ).toBe(422);
  });

  it('answers 409 for a taken username', async () => {
    await addLogin('taken.name');
    const p = await addPerson();
    const res = await t.call('POST', '/api/v1/logins', admin, {
      username: 'taken.name',
      role: 'operator',
      shared: false,
      personId: p.id,
      temporaryPassword: TEMP,
    });
    expect(res.statusCode).toBe(409);
  });

  it('refuses a common, short or username-shaped password everywhere a password is set', async () => {
    const p = await addPerson();
    const make = (temporaryPassword: string) =>
      t.call('POST', '/api/v1/logins', admin, {
        username: 'pw.check',
        role: 'operator',
        shared: false,
        personId: p.id,
        temporaryPassword,
      });
    for (const weak of [
      'password',
      'Password',
      'PASSWORD1',
      '12345678',
      'qwertyuiop',
      'short1',
      'pw.check',
      'PW.Check',
    ]) {
      const res = await make(weak);
      expect(res.statusCode, weak).toBe(422);
      expect(res.json().error.field).toBe('temporaryPassword');
    }
    const id = await addLogin('pw.owner');
    expect(
      (await t.call('PUT', `/api/v1/logins/${id}`, admin, { temporaryPassword: 'welcome1' }))
        .statusCode,
    ).toBe(422);
    const token = await t.signIn('pw.owner', undefined, TEMP);
    for (const weak of ['password1', 'pw.owner', '1234567890']) {
      const res = await t.call('POST', '/api/v1/auth/password', token, {
        old: TEMP,
        password: weak,
      });
      expect(res.statusCode, weak).toBe(422);
      expect(res.json().error.field).toBe('password');
    }
    expect((await t.call('GET', '/api/v1/auth/me', token)).statusCode).toBe(200);
    const stillOld = await t.call('POST', '/api/v1/auth/login', undefined, {
      username: 'pw.owner',
      password: TEMP,
    });
    expect(stillOld.statusCode).toBe(200);
  });

  it('resets a password: the old one and every open sign-in stop working, the flag is set again', async () => {
    const id = await addLogin('reset.me');
    const open = await t.signIn('reset.me', undefined, TEMP);
    const res = await t.call('PUT', `/api/v1/logins/${id}`, admin, {
      temporaryPassword: pw('another'),
    });
    expect(res.statusCode, res.body).toBe(200);
    expect((await t.call('GET', '/api/v1/auth/me', open)).statusCode).toBe(401);
    const oldPw = await t.call('POST', '/api/v1/auth/login', undefined, {
      username: 'reset.me',
      password: TEMP,
    });
    expect(oldPw.statusCode).toBe(401);
    const fresh = await t.call('POST', '/api/v1/auth/login', undefined, {
      username: 'reset.me',
      password: pw('another'),
    });
    expect(fresh.json().user.mustChangePassword).toBe(true);
  });

  it('switches a login off and on: off ends sign-ins, on needs a new temporary password', async () => {
    const id = await addLogin('toggle.me');
    const open = await t.signIn('toggle.me', undefined, TEMP);
    expect((await t.call('PUT', `/api/v1/logins/${id}`, admin, { active: false })).statusCode).toBe(
      200,
    );
    expect((await t.call('GET', '/api/v1/auth/me', open)).statusCode).toBe(401);
    const refused = await t.call('POST', '/api/v1/auth/login', undefined, {
      username: 'toggle.me',
      password: TEMP,
    });
    expect(refused.statusCode).toBe(401);
    expect((await t.call('PUT', `/api/v1/logins/${id}`, admin, { active: true })).statusCode).toBe(
      422,
    );
    const on = await t.call('PUT', `/api/v1/logins/${id}`, admin, {
      active: true,
      temporaryPassword: pw('third'),
    });
    expect(on.statusCode, on.body).toBe(200);
    const back = await t.call('POST', '/api/v1/auth/login', undefined, {
      username: 'toggle.me',
      password: pw('third'),
    });
    expect(back.json().user.mustChangePassword).toBe(true);
  });

  it('will not leave the plant without an admin, however it is tried', async () => {
    const adminLogin = (await t.db.admin.query("SELECT id FROM login WHERE username = 'admin'"))
      .rows[0].id;
    const adminPerson = (
      await t.db.admin.query("SELECT person_id FROM login WHERE username = 'admin'")
    ).rows[0].person_id;
    expect(
      (await t.call('PUT', `/api/v1/logins/${adminLogin}`, admin, { active: false })).statusCode,
    ).toBe(409);
    expect(
      (await t.call('PUT', `/api/v1/logins/${adminLogin}`, admin, { role: 'head' })).statusCode,
    ).toBe(409);
    expect(
      (await t.call('PUT', `/api/v1/people/${adminPerson}`, admin, { active: false })).statusCode,
    ).toBe(409);
    expect((await t.call('GET', '/api/v1/auth/me', admin)).statusCode).toBe(200);
    const second = await addLogin('second.admin', { role: 'admin' });
    expect(
      (await t.call('PUT', `/api/v1/logins/${second}`, admin, { active: false })).statusCode,
    ).toBe(200);
  });

  it('audits each login change without any password, and keeps the other customer out', async () => {
    const start = (await rows()).length;
    const id = await addLogin('audit.me');
    await t.call('PUT', `/api/v1/logins/${id}`, admin, { role: 'supervisor' });
    await t.call('PUT', `/api/v1/logins/${id}`, admin, { temporaryPassword: pw('fourth') });
    await t.call('PUT', `/api/v1/logins/${id}`, admin, { active: false });
    await t.call('PUT', `/api/v1/logins/${id}`, admin, {
      active: true,
      temporaryPassword: pw('fifth'),
    });
    const mine = (await rows()).slice(start).filter((r) => r.entity === 'login');
    expect(mine.map((r) => r.action)).toEqual([
      'login.create',
      'login.update',
      'login.reset_password',
      'login.disable',
      'login.enable',
    ]);
    expect(mine[1].before.role).toBe('technician');
    expect(mine[1].after.role).toBe('supervisor');
    expect(JSON.stringify(mine)).not.toMatch(/temp|argon2|hash/i);
    const theirs = (await t.callB('GET', '/api/v1/logins', bAdmin, undefined)).json().items;
    expect(theirs.map((l: { username: string }) => l.username)).toEqual(['b-admin']);
    expect(
      (await t.callB('PUT', `/api/v1/logins/${id}`, bAdmin, { role: 'admin' })).statusCode,
    ).toBe(404);
  });
});

describe('what the generated people and logins screens send and expect', () => {
  it('lists answer {items, nextCursor: null}; create and edit answer the row itself', async () => {
    const people = (await t.call('GET', '/api/v1/people', admin)).json();
    expect(people.nextCursor).toBeNull();
    expect(Array.isArray(people.items)).toBe(true);
    const created = await t.call('POST', '/api/v1/people', admin, person());
    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({ active: true, phone: null });
    expect(created.json()).not.toHaveProperty('person');
    const logins = (await t.call('GET', '/api/v1/logins', admin)).json();
    expect(logins.nextCursor).toBeNull();
    expect(logins.items.every((l: { active: unknown }) => typeof l.active === 'boolean')).toBe(
      true,
    );
    expect(logins.items[0]).not.toHaveProperty('disabled');
  });

  it('reads a form that sends every value as text: "false" switches off, "" means none', async () => {
    const p = await addPerson({ phone: '+919000000051', title: 'Setter' });
    const off = await t.call('PUT', `/api/v1/people/${p.id}`, admin, {
      name: p.name,
      title: '',
      phone: '',
      active: 'false',
    });
    expect(off.statusCode, off.body).toBe(200);
    expect(off.json()).toMatchObject({ active: false, title: null, phone: null });
    const on = await t.call('PUT', `/api/v1/people/${p.id}`, admin, { active: 'true' });
    expect(on.json().active).toBe(true);
    const bad = await t.call('PUT', `/api/v1/people/${p.id}`, admin, { active: 'maybe' });
    expect(bad.statusCode).toBe(422);
    expect(bad.json().error.field).toBe('active');
  });

  it('creates from a form that leaves optional fields empty', async () => {
    const res = await t.call('POST', '/api/v1/people', admin, {
      name: 'Form Person',
      team: 'vendor',
      phone: '',
      title: '',
      cell: '',
    });
    expect(res.statusCode, res.body).toBe(201);
    expect(res.json()).toMatchObject({ phone: null, title: null });
    expect(res.json()).not.toHaveProperty('kind');
  });

  it('a form that sends the whole row back unchanged changes nothing and writes no audit row', async () => {
    const p = await addPerson({ phone: '+919000000052', title: 'Lead' });
    const before = (await rows()).length;
    const same = await t.call('PUT', `/api/v1/people/${p.id}`, admin, {
      name: p.name,
      shortName: '',
      phone: '+919000000052',
      team: 'maintenance',
      title: 'Lead',
      cell: '',
      defaultShift: '',
      active: 'true',
    });
    expect(same.statusCode, same.body).toBe(200);
    expect((await rows()).length).toBe(before);
  });

  it('a login form may send username, shared and person back, never change them', async () => {
    const id = await addLogin('form.login');
    const row = (await t.call('GET', '/api/v1/logins', admin))
      .json()
      .items.find((l: { id: string }) => l.id === id);
    const back = await t.call('PUT', `/api/v1/logins/${id}`, admin, {
      username: row.username,
      shared: 'false',
      personId: row.personId,
      role: 'supervisor',
      cell: '',
      temporaryPassword: '',
      active: 'true',
    });
    expect(back.statusCode, back.body).toBe(200);
    expect(back.json()).toMatchObject({ role: 'supervisor', active: true });
    for (const [field, value] of [
      ['username', 'other.name'],
      ['shared', 'true'],
      ['personId', '10000000-0000-4000-8000-0000000000dd'],
    ] as const) {
      const res = await t.call('PUT', `/api/v1/logins/${id}`, admin, { [field]: value });
      expect(res.statusCode, field).toBe(422);
      expect(res.json().error.field).toBe(field);
    }
  });

  it('switches a login off and on with "false" and "true"; on needs a temporary password', async () => {
    const id = await addLogin('text.switch');
    const off = await t.call('PUT', `/api/v1/logins/${id}`, admin, { active: 'false' });
    expect(off.json().active).toBe(false);
    const blank = await t.call('PUT', `/api/v1/logins/${id}`, admin, {
      active: 'true',
      temporaryPassword: '',
    });
    expect(blank.statusCode).toBe(422);
    expect(blank.json().error.field).toBe('temporaryPassword');
  });

  it('answers 404 for an id that is not a uuid before it reads the body', async () => {
    for (const url of ['/api/v1/people/nope', '/api/v1/logins/nope']) {
      const res = await t.call('PUT', url, admin, { bogus: true });
      expect(res.statusCode, url).toBe(404);
    }
  });

  it('has no PATCH and no DELETE', async () => {
    const p = await addPerson();
    for (const method of ['PATCH', 'DELETE'] as const) {
      const res = await t.app.inject({
        method,
        url: `/api/v1/people/${p.id}`,
        headers: { host: 'cosmos.localhost', authorization: `Bearer ${admin}` },
      });
      expect(res.statusCode, method).toBe(404);
    }
  });
});
