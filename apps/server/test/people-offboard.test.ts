import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { A, startPeopleApp, type PeopleApp } from './people-harness.js';

const TEMP = 'Temp-pass-4821';
const TARA_PHONE = '+919000000011';
const RAVI_PHONE = '+919000000012';

let t: PeopleApp;
let admin: string;
let tara: string;
let ravi: string;
let ticketId: string;
const tokens: Record<string, string> = {};

async function addPerson(name: string, phone: string): Promise<string> {
  const res = await t.call('POST', '/api/v1/people', admin, { name, team: 'maintenance', phone });
  expect(res.statusCode, res.body).toBe(201);
  return res.json().id;
}

async function addLogin(body: object): Promise<void> {
  const res = await t.call('POST', '/api/v1/logins', admin, { temporaryPassword: TEMP, ...body });
  expect(res.statusCode, res.body).toBe(201);
}

async function sharedSignIn(actingPersonId: string): Promise<string> {
  const res = await t.call('POST', '/api/v1/auth/login', undefined, {
    username: 'cell-one',
    password: TEMP,
    actingPersonId,
  });
  expect(res.statusCode, res.body).toBe(200);
  return res.json().token;
}

async function subscribe(endpoint: string, username: string, actingPersonId: string) {
  await t.db.admin.query(
    `INSERT INTO push_subscription (tenant_id, login_id, acting_person_id, endpoint, keys, role)
     SELECT $1, id, $3, $4, '{}', role FROM login WHERE tenant_id = $1 AND username = $2`,
    [A, username, actingPersonId, endpoint],
  );
}

const endpoints = async (): Promise<string[]> =>
  (await t.db.admin.query('SELECT endpoint FROM push_subscription ORDER BY endpoint')).rows.map(
    (r) => r.endpoint,
  );

const status = async (token: string): Promise<number> =>
  (await t.call('GET', '/api/v1/auth/me', token)).statusCode;

beforeAll(async () => {
  t = await startPeopleApp();
  admin = await t.signIn('admin');
  tara = await addPerson('Tara Test', TARA_PHONE);
  ravi = await addPerson('Ravi Test', RAVI_PHONE);
  await addLogin({ username: 'tara', role: 'technician', shared: false, personId: tara });
  await addLogin({ username: 'ravi', role: 'technician', shared: false, personId: ravi });
  await addLogin({ username: 'cell-one', role: 'operator', shared: true, cell: 'Cell-1' });
  tokens.taraPhone = await t.signIn('tara', undefined, TEMP);
  tokens.taraLaptop = await t.signIn('tara', undefined, TEMP);
  tokens.ravi = await t.signIn('ravi', undefined, TEMP);
  tokens.sharedAsTara = await sharedSignIn(tara);
  tokens.sharedAsRavi = await sharedSignIn(ravi);
  await subscribe('https://push.test/tara-own', 'tara', tara);
  await subscribe('https://push.test/shared-as-tara', 'cell-one', tara);
  await subscribe('https://push.test/shared-as-ravi', 'cell-one', ravi);
  const machine = (
    await t.db.admin.query(
      "INSERT INTO machine (tenant_id, code) VALUES ($1, 'OFF-1') RETURNING id",
      [A],
    )
  ).rows[0].id;
  ticketId = (
    await t.db.admin.query(
      `INSERT INTO ticket (tenant_id, ref, kind, status, machine_id, problem, reported_at, closed_at, closed_by_person_id, severity)
       VALUES ($1, 'OFF-1', 'stopped', 'closed', $2, 'Belt', now() - interval '2 days', now() - interval '1 day', $3, 'S3') RETURNING id`,
      [A, machine, tara],
    )
  ).rows[0].id;
  await t.db.admin.query(
    "INSERT INTO crew_member (tenant_id, ticket_id, person_id, role, left_at, left_reason) VALUES ($1, $2, $3, 'primary', now(), 'close')",
    [A, ticketId, tara],
  );
}, 120_000);

afterAll(() => t.stop());

describe('a technician never gets a phone number', () => {
  it('in the plant config, the ticket list, a ticket, or the people screens', async () => {
    const replies = [
      await t.call('GET', '/api/v1/config', tokens.ravi),
      await t.call('GET', '/api/v1/tickets', tokens.ravi),
      await t.call('GET', `/api/v1/tickets/${ticketId}`, tokens.ravi),
      await t.call('GET', '/api/v1/people', tokens.ravi),
      await t.call('GET', '/api/v1/logins', tokens.ravi),
      await t.call('GET', '/api/v1/auth/me', tokens.ravi),
    ];
    expect(replies.map((r) => r.statusCode)).toEqual([200, 200, 200, 403, 403, 200]);
    for (const reply of replies) expect(reply.body).not.toMatch(/9000000011|9000000012|"phone"/);
    const asAdmin = await t.call('GET', '/api/v1/people', admin);
    expect(asAdmin.body).toContain(TARA_PHONE);
  });
});

describe('switching a person off', () => {
  it('clears the number, ends every sign-in and device, disables the logins, keeps the name', async () => {
    const before = (await t.db.admin.query('SELECT 1 FROM audit_log WHERE tenant_id = $1', [A]))
      .rowCount;
    const res = await t.call('PUT', `/api/v1/people/${tara}`, admin, { active: false });
    expect(res.statusCode, res.body).toBe(200);
    expect(res.json()).toMatchObject({ active: false, phone: null, name: 'Tara Test' });

    for (const gone of ['taraPhone', 'taraLaptop'])
      expect(await status(tokens[gone]!), gone).toBe(401);
    expect(await status(tokens.ravi!)).toBe(200);
    expect(await status(tokens.sharedAsRavi!)).toBe(200);
    expect(await endpoints()).toEqual([
      'https://push.test/shared-as-ravi',
      'https://push.test/shared-as-tara',
    ]);
    expect(await status(tokens.sharedAsTara!), 'the shared phone keeps its sign-in').toBe(200);

    const refused = await t.call('POST', '/api/v1/auth/login', undefined, {
      username: 'tara',
      password: TEMP,
    });
    expect(refused.statusCode).toBe(401);
    const asThem = await t.call('POST', '/api/v1/auth/login', undefined, {
      username: 'cell-one',
      password: TEMP,
      actingPersonId: tara,
    });
    expect(asThem.statusCode).toBe(422);
    const logins = (await t.call('GET', '/api/v1/logins', admin)).json().items;
    expect(logins.find((l: { username: string }) => l.username === 'tara').active).toBe(false);
    expect(logins.find((l: { username: string }) => l.username === 'cell-one').active).toBe(true);

    const audit = (
      await t.db.admin.query(
        "SELECT action, before, after FROM audit_log WHERE tenant_id = $1 AND action = 'person.switch_off'",
        [A],
      )
    ).rows;
    expect(audit).toHaveLength(1);
    expect(audit[0].after).toMatchObject({
      active: false,
      sessionsEnded: 2,
      devicesRemoved: 1,
      actingCleared: 1,
      loginsDisabled: ['tara'],
    });
    expect(JSON.stringify(audit)).not.toContain('9000000011');
    const total = (await t.db.admin.query('SELECT 1 FROM audit_log WHERE tenant_id = $1', [A]))
      .rowCount;
    expect(total).toBe((before ?? 0) + 1);
  });

  it('keeps the name on past tickets, and the number is free for someone else', async () => {
    const detail = (await t.call('GET', `/api/v1/tickets/${ticketId}`, tokens.ravi)).json();
    const crew = detail.people.map((p: { personId: string }) => p.personId);
    expect(crew).toEqual([tara]);
    const config = (await t.call('GET', '/api/v1/config', tokens.ravi)).json();
    expect(config.people.find((p: { id: string }) => p.id === tara)).toMatchObject({
      name: 'Tara Test',
      active: false,
    });
    const taken = await t.call('POST', '/api/v1/people', admin, {
      name: 'New Hand',
      team: 'maintenance',
      phone: TARA_PHONE,
    });
    expect(taken.statusCode, taken.body).toBe(201);
  });

  it('is a no-op the second time: no new audit row', async () => {
    const count = async () =>
      (await t.db.admin.query('SELECT 1 FROM audit_log WHERE tenant_id = $1', [A])).rowCount;
    const before = await count();
    const again = await t.call('PUT', `/api/v1/people/${tara}`, admin, { active: false });
    expect(again.statusCode).toBe(200);
    expect(await count()).toBe(before);
  });

  it('refuses a number on a switched-off person unless the same request switches them on', async () => {
    const res = await t.call('PUT', `/api/v1/people/${tara}`, admin, { phone: '+919000000013' });
    expect(res.statusCode).toBe(409);
  });

  it('switching on brings back neither the number, the devices nor the logins', async () => {
    const on = await t.call('PUT', `/api/v1/people/${tara}`, admin, { active: true });
    expect(on.statusCode, on.body).toBe(200);
    expect(on.json()).toMatchObject({ active: true, phone: null });
    expect(await endpoints()).toEqual([
      'https://push.test/shared-as-ravi',
      'https://push.test/shared-as-tara',
    ]);
    expect(await status(tokens.sharedAsTara!), 'the shared phone keeps its sign-in').toBe(200);
    const stillOff = await t.call('POST', '/api/v1/auth/login', undefined, {
      username: 'tara',
      password: TEMP,
    });
    expect(stillOff.statusCode).toBe(401);
    const logins = (await t.call('GET', '/api/v1/logins', admin)).json().items;
    const loginId = logins.find((l: { username: string }) => l.username === 'tara').id;
    const enable = await t.call('PUT', `/api/v1/logins/${loginId}`, admin, {
      active: true,
      temporaryPassword: 'Back-again-2210',
    });
    expect(enable.statusCode, enable.body).toBe(200);
    expect(
      (await t.call('POST', '/api/v1/auth/login', undefined, { username: 'tara', password: TEMP }))
        .statusCode,
    ).toBe(401);
    expect(
      (
        await t.call('POST', '/api/v1/auth/login', undefined, {
          username: 'tara',
          password: 'Back-again-2210',
        })
      ).statusCode,
    ).toBe(200);
  });

  it('will not switch a login on while its person is off', async () => {
    const off = await t.call('PUT', `/api/v1/people/${ravi}`, admin, { active: false });
    expect(off.statusCode).toBe(200);
    const logins = (await t.call('GET', '/api/v1/logins', admin)).json().items;
    const loginId = logins.find((l: { username: string }) => l.username === 'ravi').id;
    const res = await t.call('PUT', `/api/v1/logins/${loginId}`, admin, {
      active: true,
      temporaryPassword: 'Back-again-2210',
    });
    expect(res.statusCode).toBe(409);
    const withPhone = await t.call('PUT', `/api/v1/people/${ravi}`, admin, {
      active: true,
      phone: '+919000000014',
    });
    expect(withPhone.json().phone).toBe('+919000000014');
  });
});
