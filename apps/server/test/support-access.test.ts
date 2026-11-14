import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { A, PASSWORD, ROLES } from './people-harness.js';
import {
  DAY_MS,
  GRANT,
  HOST_B,
  NO_SUCH,
  startSupportApp,
  type Send,
  type SupportApp,
} from './support-harness.js';

let t: SupportApp;
let admin: string;
let bAdmin: string;

const URL = '/api/v1/support-access';
const span = (g: { createdAt: string; expiresAt: string }) =>
  Date.parse(g.expiresAt) - Date.parse(g.createdAt);

/** The four routes, aimed at one grant. */
const routes = (id: string): Send[] => [
  { method: 'POST', url: URL, payload: GRANT },
  { method: 'GET', url: URL },
  { method: 'DELETE', url: `${URL}/${id}` },
  { method: 'GET', url: `${URL}/${id}/actions` },
];

beforeAll(async () => {
  t = await startSupportApp();
  admin = await t.signIn('admin');
  bAdmin = await t.signIn('b-admin', HOST_B);
}, 120_000);

afterAll(() => t.stop());

describe('approving support access', () => {
  it('lets the admin approve three days for one named person, and shows the grant as active', async () => {
    const res = await t.send({ method: 'POST', url: URL, token: admin, payload: GRANT });
    expect(res.statusCode, res.body).toBe(201);
    const grant = res.json();
    expect(grant).toEqual({
      id: expect.any(String),
      platformUser: 'dev-one',
      reason: 'Look at a wrong day report',
      createdAt: expect.any(String),
      expiresAt: expect.any(String),
      approvedBy: 'admin',
    });
    expect(span(grant)).toBe(3 * DAY_MS);
    expect(Math.abs(Date.parse(grant.createdAt) - Date.now())).toBeLessThan(60_000);
    expect((await t.grants(admin)).find((g) => g.id === grant.id)).toEqual({
      ...grant,
      status: 'active',
    });
  });

  it('trims the name and the reason', async () => {
    const grant = await t.approve(admin, { platformUser: '  dev-two ', reason: ' Check a list  ' });
    expect(grant).toMatchObject({ platformUser: 'dev-two', reason: 'Check a list' });
  });

  it('allows seven days and no more', async () => {
    expect(span(await t.approve(admin, { days: 7 }))).toBe(7 * DAY_MS);
    expect(span(await t.approve(admin, { days: 1 }))).toBe(DAY_MS);
  });

  it.each([
    [{ days: 8 }, 'days'],
    [{ days: 0 }, 'days'],
    [{ days: -1 }, 'days'],
    [{ days: 2.5 }, 'days'],
    [{ days: '3' }, 'days'],
    [{ days: null }, 'days'],
    [{ days: undefined }, 'days'],
    [{ platformUser: '   ' }, 'platformUser'],
    [{ platformUser: 'x'.repeat(81) }, 'platformUser'],
    [{ reason: '' }, 'reason'],
    [{ reason: 'x'.repeat(501) }, 'reason'],
    [{ expiresAt: '2099-01-01T00:00:00Z' }, 'expiresAt'],
    [{ approvedBy: 'someone-else' }, 'approvedBy'],
  ])('answers 422 for %j and creates nothing', async (bad, field) => {
    const before = (await t.grants(admin)).length;
    const res = await t.send({
      method: 'POST',
      url: URL,
      token: admin,
      payload: { ...GRANT, ...bad },
    });
    expect(res.statusCode, res.body).toBe(422);
    expect(res.json().error).toMatchObject({ code: 'validation', field });
    expect(await t.grants(admin)).toHaveLength(before);
  });

  it('lists the newest grant first', async () => {
    const first = await t.approve(admin, { reason: 'older' });
    const second = await t.approve(admin, { reason: 'newer' });
    const ids = (await t.grants(admin)).map((g) => g.id);
    expect(ids.indexOf(second.id)).toBeLessThan(ids.indexOf(first.id));
  });
});

describe('who may manage support access', () => {
  it.each(ROLES)('answers 403 on all four routes for %s, and changes nothing', async (role) => {
    const grant = await t.approve(admin);
    const before = await t.grants(admin);
    const token = await t.signIn(role);
    for (const call of routes(grant.id)) {
      const res = await t.send({ ...call, token });
      expect(res.statusCode, `${call.method} ${call.url}`).toBe(403);
      expect(res.json().error.code).toBe('forbidden');
    }
    expect(await t.grants(admin)).toEqual(before);
  });

  it('answers 401 on all four routes without a sign-in', async () => {
    const grant = await t.approve(admin);
    for (const call of routes(grant.id)) {
      const res = await t.send(call);
      expect(res.statusCode, `${call.method} ${call.url}`).toBe(401);
      expect(res.json().error.code).toBe('unauthenticated');
    }
  });

  it('refuses an admin on a shared phone: the approval must name one person', async () => {
    await t.db.admin.query(
      `INSERT INTO login (tenant_id, person_id, username, password_hash, role, shared)
       SELECT tenant_id, NULL, 'office-phone', password_hash, 'admin', true
       FROM login WHERE tenant_id = $1 AND username = 'admin'`,
      [A],
    );
    const people = (await t.send({ method: 'GET', url: '/api/v1/people', token: admin })).json();
    const signIn = await t.send({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { username: 'office-phone', password: PASSWORD, actingPersonId: people.items[0].id },
    });
    expect(signIn.statusCode, signIn.body).toBe(200);
    const res = await t.send({
      method: 'POST',
      url: URL,
      token: signIn.json().token,
      payload: GRANT,
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('forbidden');
  });
});

describe('another customer', () => {
  it('cannot see, read the actions of, or end a grant of the first customer', async () => {
    const grant = await t.approve(admin);
    expect((await t.grants(bAdmin, HOST_B)).map((g) => g.id)).not.toContain(grant.id);
    for (const call of routes(grant.id).slice(2)) {
      const res = await t.send({ ...call, host: HOST_B, token: bAdmin });
      expect(res.statusCode, `${call.method} ${call.url}`).toBe(404);
      expect(res.json().error.code).toBe('not_found');
    }
    expect((await t.grants(admin)).find((g) => g.id === grant.id)?.status).toBe('active');
  });

  it('keeps its own grants to itself', async () => {
    const theirs = await t.approve(bAdmin, { reason: 'Plant two only' }, HOST_B);
    expect(theirs.approvedBy).toBe('b-admin');
    expect((await t.grants(admin)).map((g) => g.id)).not.toContain(theirs.id);
    expect((await t.grants(bAdmin, HOST_B)).map((g) => g.id)).toContain(theirs.id);
  });
});

describe('ending support access', () => {
  it('ends an active grant once: the second time, and an unknown one, are 404', async () => {
    const grant = await t.approve(admin);
    const end = () => t.send({ method: 'DELETE', url: `${URL}/${grant.id}`, token: admin });
    const first = await end();
    expect(first.statusCode, first.body).toBe(200);
    expect(first.json()).toEqual({ ok: true });
    const listed = (await t.grants(admin)).find((g) => g.id === grant.id);
    expect(listed?.status).toBe('ended');
    expect(Date.parse(listed!.expiresAt)).toBeLessThanOrEqual(Date.now() + 1000);
    expect((await end()).statusCode).toBe(404);
    for (const id of [NO_SUCH, 'not-an-id']) {
      const res = await t.send({ method: 'DELETE', url: `${URL}/${id}`, token: admin });
      expect(res.statusCode, id).toBe(404);
      expect(res.json().error.code).toBe('not_found');
    }
  });

  it('answers 404 for the actions of an unknown grant, and 422 for a bad page', async () => {
    const grant = await t.approve(admin);
    const actions = (suffix: string, id = grant.id) =>
      t.send({ method: 'GET', url: `${URL}/${id}/actions${suffix}`, token: admin });
    expect((await actions('', NO_SUCH)).statusCode).toBe(404);
    expect((await actions('', 'not-an-id')).statusCode).toBe(404);
    for (const bad of ['?limit=0', '?limit=201', '?limit=x', '?cursor=not-a-cursor']) {
      const res = await actions(bad);
      expect(res.statusCode, bad).toBe(422);
      expect(res.json().error.code).toBe('validation');
    }
    expect((await actions('')).json()).toEqual({ items: [], nextCursor: null });
  });
});
