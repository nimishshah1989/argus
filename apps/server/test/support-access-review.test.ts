import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { A } from './people-harness.js';
import {
  HOST_B,
  NO_SUCH,
  newKey,
  startSupportApp,
  type Send,
  type SupportApp,
} from './support-harness.js';

let t: SupportApp;
let admin: string;
let bAdmin: string;
let one: string;

const REFUSED = { error: { code: 'forbidden', message: 'Not allowed under support access' } };
const FEATURES = '/api/v1/settings/features';
const put = (url: string, value: unknown): Omit<Send, 'token' | 'grant'> => ({
  method: 'PUT',
  url,
  payload: { value },
});

beforeAll(async () => {
  t = await startSupportApp();
  admin = await t.signIn('admin');
  bAdmin = await t.signIn('b-admin', HOST_B);
  one = t.keys.one;
}, 120_000);

afterAll(() => t.stop());

const settingOf = async (key: string) =>
  (await t.send({ method: 'GET', url: '/api/v1/settings', token: admin }))
    .json()
    .find((s: { key: string }) => s.key === key)?.value;

describe('settings that support may not change', () => {
  it('refuses the AI monthly cap, and changes nothing', async () => {
    const grant = await t.approve(admin);
    const before = await settingOf('ai.monthlyCapUsd');
    const res = await t.support(one, grant.id, put('/api/v1/settings/ai.monthlyCapUsd', 4));
    expect(res.statusCode, res.body).toBe(403);
    expect(res.json()).toEqual(REFUSED);
    expect(await settingOf('ai.monthlyCapUsd')).toEqual(before);
  });

  it('refuses a change to the temporary-password rule but writes the other features', async () => {
    const grant = await t.approve(admin);
    const call = (value: object) => t.support(one, grant.id, put(FEATURES, value));
    const turnedOn = await call({ general: false, pause: false, enforcePasswordChange: true });
    expect(turnedOn.statusCode, turnedOn.body).toBe(403);
    expect(turnedOn.json()).toEqual(REFUSED);
    expect((await settingOf('features'))?.enforcePasswordChange).not.toBe(true);
    const other = await call({ general: false, pause: true });
    expect(other.statusCode, other.body).toBe(200);
    expect(await settingOf('features')).toMatchObject({ general: false, pause: true });
    // The admin may still turn it on, and support may then send it back unchanged.
    const adminOn = await t.send({
      ...put(FEATURES, { general: false, pause: true, enforcePasswordChange: true }),
      token: admin,
    });
    expect(adminOn.statusCode).toBe(200);
    const unchanged = await call({ general: true, pause: true, enforcePasswordChange: true });
    expect(unchanged.statusCode, unchanged.body).toBe(200);
    const turnedOff = await call({ general: true, pause: true, enforcePasswordChange: false });
    expect(turnedOff.statusCode, turnedOff.body).toBe(403);
    expect((await settingOf('features'))?.enforcePasswordChange).toBe(true);
  });

  it('still writes the company name and the severity matrix', async () => {
    const grant = await t.approve(admin);
    const name = await t.support(one, grant.id, put('/api/v1/settings/company.name', 'Cosmos Ltd'));
    expect(name.statusCode, name.body).toBe(200);
  });
});

describe('the plant structure support may change, and the ticket clocks it may not', () => {
  it('reaches the machine, segment, group, shift and logo writes', async () => {
    const grant = await t.approve(admin);
    const calls: Omit<Send, 'token' | 'grant'>[] = [
      { method: 'POST', url: '/api/v1/segments', payload: {} },
      { method: 'POST', url: '/api/v1/groups', payload: {} },
      { method: 'POST', url: '/api/v1/machines', payload: {} },
      { method: 'POST', url: '/api/v1/shifts', payload: {} },
      { method: 'PUT', url: `/api/v1/segments/${NO_SUCH}`, payload: {} },
      { method: 'PUT', url: `/api/v1/groups/${NO_SUCH}`, payload: {} },
      { method: 'PUT', url: `/api/v1/machines/${NO_SUCH}`, payload: {} },
      { method: 'PUT', url: `/api/v1/shifts/${NO_SUCH}`, payload: {} },
      { method: 'PUT', url: '/api/v1/company/logo', payload: {} },
    ];
    for (const call of calls) {
      const res = await t.support(one, grant.id, call);
      expect(res.json(), `${call.method} ${call.url}`).not.toEqual(REFUSED);
    }
    const made = await t.support(one, grant.id, {
      method: 'POST',
      url: '/api/v1/segments',
      payload: { code: 'SUPPORT-MADE', name: 'Made by support' },
    });
    expect(made.statusCode, made.body).toBe(201);
  });

  it('keeps the machine criticality closed: it re-arms the clocks of open tickets', async () => {
    const grant = await t.approve(admin);
    const res = await t.support(one, grant.id, {
      method: 'PUT',
      url: `/api/v1/machines/${NO_SUCH}/criticality`,
      payload: { criticality: 'A' },
    });
    expect(res.statusCode, res.body).toBe(403);
    expect(res.json()).toEqual(REFUSED);
  });
});

describe('a grant whose approver can no longer approve', () => {
  it('stops at once when that admin is switched off', async () => {
    const grant = await t.approve(bAdmin, {}, HOST_B);
    const read: Omit<Send, 'token' | 'grant'> = {
      method: 'GET',
      url: '/api/v1/people',
      host: HOST_B,
    };
    expect((await t.support(one, grant.id, read)).statusCode).toBe(200);
    await t.db.admin.query("UPDATE login SET disabled_at = now() WHERE username = 'b-admin'");
    const res = await t.support(one, grant.id, read);
    expect(res.statusCode, res.body).toBe(403);
    expect(res.json().error.message).toBe('Support access is not approved or has ended');
  });
});

describe('guessing a key does not lock out the person who has the right one', () => {
  it('lets a right key through from an address that is being limited', async () => {
    const grant = await t.approve(admin);
    const shared = '203.0.113.50';
    const read: Omit<Send, 'token' | 'grant'> = {
      method: 'GET',
      url: '/api/v1/people',
      ip: shared,
    };
    for (let i = 0; i < 20; i += 1)
      expect((await t.support(newKey(), grant.id, read)).statusCode).toBe(401);
    expect((await t.support(newKey(), grant.id, read)).statusCode).toBe(429);
    expect((await t.support(one, grant.id, read)).statusCode).toBe(200);
  });
});

describe('what the log says about a support call', () => {
  it('names the grant and not the admin who approved it', async () => {
    const grant = await t.approve(admin);
    const approver = (
      await t.db.admin.query("SELECT id FROM login WHERE username = 'admin' AND tenant_id = $1", [
        A,
      ])
    ).rows[0].id as string;
    t.logged.length = 0;
    await t.support(one, grant.id, { method: 'GET', url: '/api/v1/people' });
    const lines = t.logged.filter((line) => line.includes('request completed'));
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.every((line) => line.includes(`"supportGrantId":"${grant.id}"`))).toBe(true);
    expect(t.logged.some((line) => line.includes(approver))).toBe(false);
  });
});
