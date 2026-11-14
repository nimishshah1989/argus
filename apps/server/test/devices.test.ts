import { hash } from '@node-rs/argon2';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { A, PASSWORD, ROLES, startPeopleApp, type PeopleApp } from './people-harness.js';

let t: PeopleApp;

const LIST = '/api/v1/auth/sessions';
const end = (id: string) => `${LIST}/${id}`;
const B_HOST = 'plant-two.localhost';

interface Device {
  id: string;
  device: string | null;
  current: boolean;
  lastSeenAt: string;
  createdAt: string;
}

/** A sign-in from a named phone. Returns the token. */
async function signInOn(username: string, device?: string, host = 'cosmos.localhost') {
  const send = host === B_HOST ? t.callB : t.call;
  const res = await send('POST', '/api/v1/auth/login', undefined, {
    username,
    password: PASSWORD,
    ...(device ? { device } : {}),
  });
  expect(res.statusCode, `sign in as ${username}`).toBe(200);
  return res.json().token as string;
}

async function devices(token: string, send = t.call): Promise<Device[]> {
  const res = await send('GET', LIST, token);
  expect(res.statusCode, res.body).toBe(200);
  return res.json().items;
}

const me = (token: string, send = t.call) => send('GET', '/api/v1/auth/me', token);

/** A DELETE has no body, so it carries no content type, as the app's other deletes do. */
const del = (url: string, token?: string, host = 'cosmos.localhost') =>
  t.app.inject({
    method: 'DELETE',
    url,
    headers: { host, ...(token ? { authorization: `Bearer ${token}` } : {}) },
  });

async function deviceLabelled(token: string, label: string, send = t.call): Promise<Device> {
  const found = (await devices(token, send)).find((d) => d.device === label);
  expect(found, `a device called ${label}`).toBeDefined();
  return found as Device;
}

beforeAll(async () => {
  t = await startPeopleApp();
  const passwordHash = await hash(PASSWORD, {
    algorithm: 2,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
  await t.db.admin.query(
    'INSERT INTO login (tenant_id, person_id, username, password_hash, role, shared) VALUES ($1, NULL, $2, $3, $4, true)',
    [A, 'shop-phone', passwordHash, 'supervisor'],
  );
}, 120_000);

afterAll(() => t.stop());

describe('my devices', () => {
  it('lists my devices with their names and marks the one I am using', async () => {
    const phone = await signInOn('operator', 'Shop floor phone');
    const tablet = await signInOn('operator', 'Office tablet');
    const items = await devices(phone);
    expect(items.map((d) => d.device).sort()).toEqual(['Office tablet', 'Shop floor phone']);
    expect(items.filter((d) => d.current)).toHaveLength(1);
    expect(items.find((d) => d.current)?.device).toBe('Shop floor phone');
    const fromTablet = await devices(tablet);
    expect(fromTablet.find((d) => d.current)?.device).toBe('Office tablet');
    for (const d of items) {
      expect(Object.keys(d).sort()).toEqual(['createdAt', 'current', 'device', 'id', 'lastSeenAt']);
    }
  });

  it('shows a device with no name as null, and the most recently used first', async () => {
    const unnamed = await signInOn('head');
    const named = await signInOn('head', 'Desk PC');
    // A call slides "last seen" only when it is over five minutes old, so age both before using one.
    await t.db.admin.query(
      "UPDATE session SET last_seen_at = now() - interval '1 hour' WHERE login_id = (SELECT id FROM login WHERE username = 'head')",
    );
    await me(unnamed);
    const items = await devices(unnamed);
    expect(items.map((d) => d.device)).toEqual([null, 'Desk PC']);
    await me(named);
    expect((await devices(named)).map((d) => d.device)).toEqual(['Desk PC', null]);
  });

  it('never includes the sign-in token in a response', async () => {
    const token = await signInOn('supervisor', 'Gate phone');
    const listed = await t.call('GET', LIST, token);
    expect(listed.body).not.toContain(token);
    const mine = (await devices(token))[0] as Device;
    const ended = await del(end(mine.id), token);
    expect(ended.body).not.toContain(token);
  });

  it('answers 401 to a missing or unknown sign-in', async () => {
    expect((await t.call('GET', LIST)).statusCode).toBe(401);
    expect((await del(end('10000000-0000-4000-8000-000000000001'))).statusCode).toBe(401);
    expect((await t.call('GET', LIST, 'not-a-token')).statusCode).toBe(401);
  });

  it.each([...ROLES, 'admin'])('lets %s list its own devices', async (role) => {
    const token = await signInOn(role, `${role} phone`);
    const items = await devices(token);
    expect(items.map((d) => d.device)).toContain(`${role} phone`);
  });
});

describe('signing a device out', () => {
  it('ends the other device at once and leaves this one working', async () => {
    const mine = await signInOn('technician', 'Mine');
    const lost = await signInOn('technician', 'Lost phone');
    expect((await me(lost)).statusCode).toBe(200);
    const target = await deviceLabelled(mine, 'Lost phone');
    const res = await del(end(target.id), mine);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
    expect((await me(lost)).statusCode).toBe(401);
    expect((await me(mine)).statusCode).toBe(200);
    expect((await devices(mine)).map((d) => d.device)).not.toContain('Lost phone');
  });

  it('can end the device I am using, and its next call answers 401', async () => {
    const mine = await signInOn('plant_head', 'Only phone');
    const self = (await devices(mine)).find((d) => d.current) as Device;
    expect((await del(end(self.id), mine)).statusCode).toBe(200);
    expect((await me(mine)).statusCode).toBe(401);
    expect((await t.call('GET', LIST, mine)).statusCode).toBe(401);
  });

  it('answers 404 to a device that is already ended, and to a malformed or unknown id', async () => {
    const mine = await signInOn('board', 'Boardroom');
    const spare = await signInOn('board', 'Spare');
    const target = await deviceLabelled(mine, 'Spare');
    expect((await del(end(target.id), mine)).statusCode).toBe(200);
    const again = await del(end(target.id), mine);
    expect(again.statusCode).toBe(404);
    expect(again.json().error.code).toBe('not_found');
    expect((await me(spare)).statusCode).toBe(401);
    for (const id of ['not-an-id', '12345', '10000000-0000-4000-8000-00000000ffff'])
      expect((await del(end(id), mine)).statusCode, id).toBe(404);
    expect((await me(mine)).statusCode).toBe(200);
  });

  it('does not list devices whose time has run out or that were signed out', async () => {
    const mine = await signInOn('operator', 'Current one');
    await signInOn('operator', 'Forgotten phone');
    await signInOn('operator', 'Signed out phone');
    const forgotten = await deviceLabelled(mine, 'Forgotten phone');
    await t.db.admin.query(
      "UPDATE session SET expires_at = now() - interval '1 day' WHERE id = $1",
      [forgotten.id],
    );
    const signedOut = await deviceLabelled(mine, 'Signed out phone');
    await del(end(signedOut.id), mine);
    const names = (await devices(mine)).map((d) => d.device);
    expect(names).not.toContain('Forgotten phone');
    expect(names).not.toContain('Signed out phone');
    expect(names).toContain('Current one');
    expect((await del(end(forgotten.id), mine)).statusCode).toBe(404);
  });
});

describe('whose devices I can see', () => {
  it('keeps a colleague from seeing or ending my devices', async () => {
    const mine = await signInOn('supervisor', 'Supervisor phone');
    const colleague = await signInOn('head', 'Head phone');
    const target = await deviceLabelled(mine, 'Supervisor phone');
    expect((await devices(colleague)).map((d) => d.id)).not.toContain(target.id);
    const res = await del(end(target.id), colleague);
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('not_found');
    expect((await me(mine)).statusCode).toBe(200);
    expect((await me(colleague)).statusCode).toBe(200);
  });

  it('keeps another customer from seeing or ending my devices', async () => {
    const mine = await signInOn('admin', 'Admin phone');
    const other = await signInOn('b-admin', 'Other plant phone', B_HOST);
    const mineTarget = await deviceLabelled(mine, 'Admin phone');
    const otherTarget = await deviceLabelled(other, 'Other plant phone', t.callB);
    expect((await devices(other, t.callB)).map((d) => d.id)).not.toContain(mineTarget.id);
    expect((await devices(mine)).map((d) => d.id)).not.toContain(otherTarget.id);
    expect((await del(end(mineTarget.id), other, B_HOST)).statusCode).toBe(404);
    expect((await del(end(otherTarget.id), mine)).statusCode).toBe(404);
    expect((await me(mine)).statusCode).toBe(200);
    expect((await me(other, t.callB)).statusCode).toBe(200);
    expect((await t.call('GET', LIST, other)).statusCode).toBe(401);
    expect((await t.callB('GET', LIST, mine)).statusCode).toBe(401);
  });
});

describe('a shared login', () => {
  it('may not list or end devices, so colleagues cannot sign each other out', async () => {
    const person = await t.db.admin.query("SELECT id FROM person WHERE name = 'Pat head'");
    const res = await t.call('POST', '/api/v1/auth/login', undefined, {
      username: 'shop-phone',
      password: PASSWORD,
      device: 'Shop phone',
      actingPersonId: person.rows[0].id,
    });
    expect(res.statusCode, res.body).toBe(200);
    const shared = res.json().token as string;
    expect((await me(shared)).statusCode).toBe(200);
    const list = await t.call('GET', LIST, shared);
    expect(list.statusCode).toBe(403);
    expect(list.json().error.code).toBe('forbidden');
    const gone = await del(end('10000000-0000-4000-8000-000000000001'), shared);
    expect(gone.statusCode).toBe(403);
    expect(gone.json().error.code).toBe('forbidden');
    expect((await t.call('POST', '/api/v1/auth/logout', shared, {})).statusCode).toBe(200);
    expect((await me(shared)).statusCode).toBe(401);
  });
});

describe('the trail of a sign-out', () => {
  it('records who signed out which device, and never the token', async () => {
    const phone = await signInOn('technician', 'Trail phone');
    const other = await signInOn('technician', 'Trail tablet');
    const target = await deviceLabelled(phone, 'Trail tablet');
    expect((await del(end(target.id), phone)).statusCode).toBe(200);
    const { rows } = await t.db.admin.query(
      `SELECT a.before, a.after, l.username FROM audit_log a JOIN login l ON l.id = a.login_id
       WHERE a.action = 'session.revoke' AND a.entity_id = $1`,
      [target.id],
    );
    expect(rows).toEqual([
      { before: { device: 'Trail tablet' }, after: { revoked: true }, username: 'technician' },
    ]);
    expect(JSON.stringify(rows)).not.toContain(other);
  });
});

describe('a signed-out device stops getting pushes', () => {
  it('drops the push registration of the device that was signed out, and only that one', async () => {
    const phone = await signInOn('supervisor', 'Alert phone');
    const tablet = await signInOn('supervisor', 'Alert tablet');
    const keys = { p256dh: 'test-p256dh', auth: 'test-auth' };
    const register = (token: string, endpoint: string) =>
      t.call('POST', '/api/v1/push/subscribe', token, { subscription: { endpoint, keys } });
    const phoneEndpoint = 'https://fcm.googleapis.com/fcm/send/alert-phone';
    const tabletEndpoint = 'https://fcm.googleapis.com/fcm/send/alert-tablet';
    expect((await register(phone, phoneEndpoint)).statusCode).toBe(200);
    expect((await register(tablet, tabletEndpoint)).statusCode).toBe(200);
    const registered = async () =>
      (
        await t.db.admin.query('SELECT endpoint FROM push_subscription WHERE endpoint = ANY($1)', [
          [phoneEndpoint, tabletEndpoint],
        ])
      ).rows
        .map((r) => r.endpoint)
        .sort();
    expect(await registered()).toEqual([phoneEndpoint, tabletEndpoint]);
    const target = await deviceLabelled(phone, 'Alert tablet');
    expect((await del(end(target.id), phone)).statusCode).toBe(200);
    expect(await registered()).toEqual([phoneEndpoint]);
  });
});
