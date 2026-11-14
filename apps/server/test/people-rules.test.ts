import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { A, startPeopleApp, type PeopleApp } from './people-harness.js';

const TEMP = 'Temp-pass-4821';
let t: PeopleApp;
let admin: string;
let n = 0;

async function addPerson(name: string, phone?: string): Promise<string> {
  const res = await t.call('POST', '/api/v1/people', admin, {
    name,
    team: 'maintenance',
    ...(phone ? { phone } : {}),
  });
  expect(res.statusCode, res.body).toBe(201);
  return res.json().person.id;
}

async function addLogin(username: string, extra: object): Promise<string> {
  const res = await t.call('POST', '/api/v1/logins', admin, {
    username,
    role: 'technician',
    shared: false,
    temporaryPassword: TEMP,
    ...extra,
  });
  expect(res.statusCode, res.body).toBe(201);
  return res.json().login.id;
}

async function addUser(role = 'technician') {
  n += 1;
  const personId = await addPerson(`Rule Person ${n}`);
  const username = `rule.user${n}`;
  const loginId = await addLogin(username, { role, personId });
  return { personId, username, loginId, token: await t.signIn(username, undefined, TEMP) };
}

const features = async (value: object | null) => {
  await t.db.admin.query("DELETE FROM setting WHERE tenant_id = $1 AND key = 'features'", [A]);
  if (value)
    await t.db.admin.query(
      "INSERT INTO setting (tenant_id, key, value) VALUES ($1, 'features', $2)",
      [A, JSON.stringify(value)],
    );
};

/** A ticket in progress that names `personId` in the way given. */
async function activeTicket(personId: string, how: 'crew' | 'lead' | 'segment' | 'assigned') {
  n += 1;
  const machine = (
    await t.db.admin.query('INSERT INTO machine (tenant_id, code) VALUES ($1, $2) RETURNING id', [
      A,
      `RM-${n}`,
    ])
  ).rows[0].id;
  const ticket = (
    await t.db.admin.query(
      `INSERT INTO ticket (tenant_id, ref, kind, status, machine_id, problem, reported_at, severity, lead_person_id, assigned_to_person_id)
       VALUES ($1, $2, 'stopped', 'working', $3, 'Belt', now(), 'S3', $4, $5) RETURNING id, ref`,
      [
        A,
        `RT-${n}`,
        machine,
        how === 'lead' ? personId : null,
        how === 'assigned' ? personId : null,
      ],
    )
  ).rows[0];
  if (how === 'crew')
    await t.db.admin.query(
      "INSERT INTO crew_member (tenant_id, ticket_id, person_id, role) VALUES ($1, $2, $3, 'primary')",
      [A, ticket.id, personId],
    );
  if (how === 'segment')
    await t.db.admin.query(
      "INSERT INTO work_segment (tenant_id, ticket_id, person_id, role, started_at) VALUES ($1, $2, $3, 'primary', now())",
      [A, ticket.id, personId],
    );
  return ticket as { id: string; ref: string };
}

beforeAll(async () => {
  t = await startPeopleApp();
  admin = await t.signIn('admin');
}, 120_000);

afterAll(() => t.stop());

describe('switching off a person who is on a ticket in progress', () => {
  for (const how of ['crew', 'lead', 'segment', 'assigned'] as const) {
    it(`is refused while they are ${how === 'assigned' ? 'assigned to one' : `its ${how}`}, naming the ticket`, async () => {
      const u = await addUser();
      const ticket = await activeTicket(u.personId, how);
      const audits = (await t.db.admin.query('SELECT 1 FROM audit_log')).rowCount;
      const res = await t.call('PATCH', `/api/v1/people/${u.personId}`, admin, { active: false });
      expect(res.statusCode, res.body).toBe(409);
      expect(res.json().error.code).toBe('conflict');
      expect(res.json().error.message).toContain(ticket.ref);
      expect(res.json().error.message).toMatch(/transfer or close/i);
      expect((await t.call('GET', '/api/v1/auth/me', u.token)).statusCode).toBe(200);
      const people = (await t.call('GET', '/api/v1/people', admin)).json().people;
      expect(people.find((p: { id: string }) => p.id === u.personId).active).toBe(true);
      expect((await t.db.admin.query('SELECT 1 FROM audit_log')).rowCount).toBe(audits);

      await t.db.admin.query(
        "UPDATE ticket SET status = 'closed', closed_at = now() WHERE id = $1",
        [ticket.id],
      );
      const later = await t.call('PATCH', `/api/v1/people/${u.personId}`, admin, { active: false });
      expect(later.statusCode, later.body).toBe(200);
    });
  }

  it('lists every ticket that blocks it', async () => {
    const u = await addUser();
    const one = await activeTicket(u.personId, 'crew');
    const two = await activeTicket(u.personId, 'lead');
    const res = await t.call('PATCH', `/api/v1/people/${u.personId}`, admin, { active: false });
    expect(res.json().error.message).toContain(one.ref);
    expect(res.json().error.message).toContain(two.ref);
  });

  it('lets someone go who is only on a closed ticket', async () => {
    const u = await addUser();
    const ticket = await activeTicket(u.personId, 'crew');
    await t.db.admin.query("UPDATE ticket SET status = 'cancelled' WHERE id = $1", [ticket.id]);
    const res = await t.call('PATCH', `/api/v1/people/${u.personId}`, admin, { active: false });
    expect(res.statusCode, res.body).toBe(200);
  });
});

describe('a ticket cannot be handed to a person who is switched off', () => {
  async function working(token: string, personId: string): Promise<string> {
    const res = await t.call('POST', '/api/v1/tickets', token, {
      kind: 'general',
      location: 'Shop floor',
      workType: 'repair',
      problem: 'Door hinge',
      startNow: true,
      startByPersonId: personId,
    });
    expect(res.statusCode, res.body).toBe(201);
    return res.json().ticket.id;
  }

  it('refuses a transfer to them and a pause assigned to them (422), and accepts an active person', async () => {
    const me = await addUser();
    const off = await addUser();
    await t.call('PATCH', `/api/v1/people/${off.personId}`, admin, { active: false });
    const live = await addUser();
    const id = await working(me.token, me.personId);
    const transfer = await t.call('POST', `/api/v1/tickets/${id}/transfer`, me.token, {
      personId: me.personId,
      toPersonId: off.personId,
      note: 'Next shift',
    });
    expect(transfer.statusCode, transfer.body).toBe(422);
    expect(transfer.json().error.field).toBe('toPersonId');
    const pause = await t.call('POST', `/api/v1/tickets/${id}/pause`, me.token, {
      personId: me.personId,
      reasonCode: 'spare',
      assignToPersonId: off.personId,
    });
    expect(pause.statusCode, pause.body).toBe(422);
    expect(pause.json().error.field).toBe('assignToPersonId');
    const ok = await t.call('POST', `/api/v1/tickets/${id}/transfer`, me.token, {
      personId: me.personId,
      toPersonId: live.personId,
      note: 'Next shift',
    });
    expect(ok.statusCode, ok.body).toBe(200);
  });
});

describe('a shared floor phone keeps working when the person it was acting as is switched off', () => {
  it('clears who it acts as, keeps the sign-in and the phone registration, ends personal ones', async () => {
    const leaver = await addUser();
    const other = await addPerson('Stays On');
    await addLogin('floor.phone', { role: 'operator', shared: true, cell: 'Cell-9' });
    const sign = (acting: string) =>
      t.call('POST', '/api/v1/auth/login', undefined, {
        username: 'floor.phone',
        password: TEMP,
        actingPersonId: acting,
      });
    const asLeaver = (await sign(leaver.personId)).json().token as string;
    const asOther = (await sign(other)).json().token as string;
    const subscribe = (token: string, acting: string, endpoint: string) =>
      t.call('POST', '/api/v1/push/subscribe', token, {
        subscription: { endpoint, keys: { p256dh: 'p', auth: 'a' } },
        actingPersonId: acting,
      });
    await subscribe(asLeaver, leaver.personId, 'https://fcm.googleapis.com/fcm/send/floor-phone');
    await subscribe(
      leaver.token,
      leaver.personId,
      'https://fcm.googleapis.com/fcm/send/personal-phone',
    );

    const off = await t.call('PATCH', `/api/v1/people/${leaver.personId}`, admin, {
      active: false,
    });
    expect(off.statusCode, off.body).toBe(200);

    const me = await t.call('GET', '/api/v1/auth/me', asLeaver);
    expect(me.statusCode, me.body).toBe(200);
    expect(me.json().user).toMatchObject({ actingPerson: null, actingPersonId: '', name: '' });
    expect(me.json().user.shared).toBe(true);
    // The phone can still read (to show who may be chosen) but cannot act until someone is chosen.
    expect((await t.call('GET', '/api/v1/config', asLeaver)).statusCode).toBe(200);
    const raise = await t.call('POST', '/api/v1/tickets', asLeaver, {
      kind: 'general',
      location: 'Shop floor',
      workType: 'repair',
      problem: 'Door hinge',
      reportedByPersonId: other,
    });
    expect(raise.statusCode, raise.body).toBe(403);
    expect(raise.json().error.code).toBe('choose_acting_person');
    const push = await t.call('POST', '/api/v1/push/subscribe', asLeaver, {});
    expect(push.json().error.code).toBe('choose_acting_person');
    expect(
      (await t.call('GET', '/api/v1/auth/me', asOther)).json().user.actingPerson,
    ).toMatchObject({
      id: other,
      name: 'Stays On',
    });
    expect((await t.call('GET', '/api/v1/auth/me', asOther)).json().user.actingPersonId).toBe(
      other,
    );
    expect((await t.call('GET', '/api/v1/auth/me', leaver.token)).statusCode).toBe(401);
    const subs = (
      await t.db.admin.query('SELECT endpoint, acting_person_id FROM push_subscription')
    ).rows;
    expect(subs).toEqual([
      { endpoint: 'https://fcm.googleapis.com/fcm/send/floor-phone', acting_person_id: null },
    ]);
    const audit = (
      await t.db.admin.query(
        "SELECT after FROM audit_log WHERE action = 'person.switch_off' ORDER BY created_at DESC LIMIT 1",
      )
    ).rows[0].after;
    expect(audit).toMatchObject({ sessionsEnded: 1, devicesRemoved: 1, actingCleared: 1 });
  });

  it('asks again: the phone can sign in and register as someone else', async () => {
    const res = await t.call('POST', '/api/v1/auth/login', undefined, {
      username: 'floor.phone',
      password: TEMP,
      actingPersonId: (await t.db.admin.query("SELECT id FROM person WHERE name = 'Stays On'"))
        .rows[0].id,
    });
    expect(res.statusCode).toBe(200);
  });
});

describe('a shared login is never an admin', () => {
  it('refuses to create one or to promote one (422)', async () => {
    const create = await t.call('POST', '/api/v1/logins', admin, {
      username: 'shared.admin',
      role: 'admin',
      shared: true,
      temporaryPassword: TEMP,
    });
    expect(create.statusCode).toBe(422);
    expect(create.json().error.field).toBe('role');
    const id = await addLogin('shared.floor', { role: 'operator', shared: true });
    const promote = await t.call('PATCH', `/api/v1/logins/${id}`, admin, { role: 'admin' });
    expect(promote.statusCode).toBe(422);
    expect(promote.json().error.field).toBe('role');
  });

  it('gets 403 from every route if one exists anyway, and does not count as the last admin', async () => {
    const hash = (
      await t.db.admin.query("SELECT password_hash FROM login WHERE username = 'admin'")
    ).rows[0].password_hash;
    await t.db.admin.query(
      "INSERT INTO login (tenant_id, username, password_hash, role, shared) VALUES ($1, 'legacy.shared', $2, 'admin', true)",
      [A, hash],
    );
    const person = (await t.call('GET', '/api/v1/people', admin)).json().people[0].id;
    const token = (
      await t.call('POST', '/api/v1/auth/login', undefined, {
        username: 'legacy.shared',
        password: 'correct-horse-battery',
        actingPersonId: person,
      })
    ).json().token;
    expect((await t.call('GET', '/api/v1/people', token)).statusCode).toBe(403);
    expect(
      (await t.call('POST', '/api/v1/people', token, { name: 'Z', team: 'vendor' })).statusCode,
    ).toBe(403);
    const adminLogin = (await t.db.admin.query("SELECT id FROM login WHERE username = 'admin'"))
      .rows[0].id;
    const last = await t.call('PATCH', `/api/v1/logins/${adminLogin}`, admin, { disabled: true });
    expect(last.statusCode, last.body).toBe(409);
  });
});

describe('a login that must change its password', () => {
  const asNew = async () => {
    const u = await addUser();
    return u.token;
  };

  it('works as before while the switch is off (the default)', async () => {
    await features(null);
    expect((await t.call('GET', '/api/v1/config', await asNew())).statusCode).toBe(200);
    await features({ enforcePasswordChange: false });
    expect((await t.call('GET', '/api/v1/tickets', await asNew())).statusCode).toBe(200);
  });

  it('is refused everywhere except the password screens once the switch is on', async () => {
    await features({ enforcePasswordChange: true });
    const u = await addUser();
    for (const [method, url] of [
      ['GET', '/api/v1/config'],
      ['GET', '/api/v1/tickets'],
      ['GET', '/api/v1/state'],
      ['POST', '/api/v1/push/subscribe'],
    ] as const) {
      const res = await t.call(method, url, u.token, method === 'POST' ? {} : undefined);
      expect(res.statusCode, url).toBe(403);
      expect(res.json().error.code).toBe('must_change_password');
    }
    expect((await t.call('GET', '/api/v1/auth/me', u.token)).statusCode).toBe(200);
    expect((await t.call('GET', '/api/v1/brand')).statusCode).toBe(200);
    const change = await t.call('POST', '/api/v1/auth/password', u.token, {
      old: TEMP,
      password: 'a-much-better-secret-7',
    });
    expect(change.statusCode, change.body).toBe(200);
    expect((await t.call('GET', '/api/v1/config', u.token)).statusCode).toBe(200);
    const out = await asNew();
    expect((await t.call('POST', '/api/v1/auth/logout', out, {})).statusCode).toBe(200);
    await features(null);
  });

  it('also stops an admin who has not changed the temporary password', async () => {
    await features({ enforcePasswordChange: true });
    const boss = await addUser('admin');
    const res = await t.call('GET', '/api/v1/people', boss.token);
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('must_change_password');
    await features(null);
  });
});

describe('weak passwords in their usual disguises', () => {
  it.each([
    'Admin@123',
    'Password@123',
    'Welcome@123',
    'India@123',
    'P@ssw0rd',
    'Passw0rd!',
    '  password1  ',
  ])('refuses %s as a temporary and as a new password', async (weak) => {
    const u = await addUser();
    const personId = await addPerson(`Weak Probe ${weak.trim()}`);
    const create = await t.call('POST', '/api/v1/logins', admin, {
      username: `weak.${++n}`,
      role: 'operator',
      shared: false,
      personId,
      temporaryPassword: weak,
    });
    expect(create.statusCode, weak).toBe(422);
    const change = await t.call('POST', '/api/v1/auth/password', u.token, {
      old: TEMP,
      password: weak,
    });
    expect(change.statusCode, weak).toBe(422);
  });

  it('counts length after trimming: eight spaces around a short word is still short', async () => {
    const u = await addUser();
    const res = await t.call('POST', '/api/v1/auth/password', u.token, {
      old: TEMP,
      password: '  ab12  ',
    });
    expect(res.statusCode).toBe(422);
  });
});

describe('the audit row says when the number changed', () => {
  it('sets phoneChanged although the last four digits are the same', async () => {
    const id = await addPerson('Phone Mover', '+919000000041');
    await t.call('PATCH', `/api/v1/people/${id}`, admin, { phone: '+929000000041' });
    await t.call('PATCH', `/api/v1/people/${id}`, admin, { title: 'Lead' });
    const rows = (
      await t.db.admin.query(
        "SELECT before, after FROM audit_log WHERE entity_id = $1 AND action = 'person.update' ORDER BY created_at",
        [id],
      )
    ).rows;
    expect(rows[0].after.phoneChanged).toBe(true);
    expect(rows[0].after.phoneEnding).toBe(rows[0].before.phoneEnding);
    expect(rows[1].after.phoneChanged).toBeUndefined();
    expect(JSON.stringify(rows)).not.toContain('9000000041');
  });
});
