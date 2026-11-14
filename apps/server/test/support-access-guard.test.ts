import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { isPublicRoute, routeTable } from '../src/kernel/index.js';
import { SUPPORT_WRITES } from '../src/modules/identity/index.js';
import { A, pw } from './people-harness.js';
import {
  GRANT,
  HOST_B,
  NO_SUCH,
  newKey,
  startSupportApp,
  type Grant,
  type Send,
  type SupportApp,
} from './support-harness.js';

let t: SupportApp;
let admin: string;
let bAdmin: string;
let one: string;
let two: string;

const PEOPLE = '/api/v1/people';
const ENDED = 'Support access is not approved or has ended';
const WRITE_REFUSED = 'Not allowed under support access';
const FEATURES = '/api/v1/settings/features';
const read: Omit<Send, 'token' | 'grant'> = { method: 'GET', url: PEOPLE };

const names = (res: { json: () => { items: { name: string }[] } }) =>
  res.json().items.map((p) => p.name);

async function expectRefused(res: Awaited<ReturnType<SupportApp['send']>>, message = ENDED) {
  expect(res.statusCode, res.body).toBe(403);
  expect(res.json()).toEqual({ error: { code: 'forbidden', message } });
}

async function actions(grant: Grant, query = '') {
  const url = `/api/v1/support-access/${grant.id}/actions${query}`;
  const res = await t.send({ method: 'GET', url, token: admin });
  expect(res.statusCode, res.body).toBe(200);
  return res.json() as {
    items: { id: string; at: string; kind: string; method: string; route: string; ip: string }[];
    nextCursor: string | null;
  };
}

const trail = async (grant: Grant) =>
  (await actions(grant)).items.map((a) => `${a.kind} ${a.method} ${a.route}`);

const generalFeature = async () =>
  (await t.send({ method: 'GET', url: '/api/v1/config', token: admin })).json().features.general;

/** Makes writing one kind of audit line fail, as a full disk or a lost connection would, until `restore()`. */
async function breakAudit(action: string) {
  await t.db.admin.query(
    `CREATE FUNCTION test_audit_down() RETURNS trigger LANGUAGE plpgsql AS
     $$ BEGIN RAISE EXCEPTION 'audit is down (test)'; END $$`,
  );
  await t.db.admin.query(
    `CREATE TRIGGER test_audit_down BEFORE INSERT ON audit_log FOR EACH ROW
     WHEN (NEW.action = '${action}') EXECUTE FUNCTION test_audit_down()`,
  );
  return () => t.db.admin.query('DROP FUNCTION test_audit_down() CASCADE');
}

beforeAll(async () => {
  t = await startSupportApp();
  admin = await t.signIn('admin');
  bAdmin = await t.signIn('b-admin', HOST_B);
  ({ one, two } = t.keys);
}, 120_000);

afterAll(() => t.stop());

describe('using an approved grant', () => {
  it('lets the named support person read what the admin reads, as themselves', async () => {
    const grant = await t.approve(admin);
    const people = await t.support(one, grant.id, read);
    expect(people.statusCode, people.body).toBe(200);
    expect(names(people)).toContain('Asha Admin');
    expect(names(people)).not.toContain('Bina Admin');
    const me = await t.support(one, grant.id, { method: 'GET', url: '/api/v1/auth/me' });
    expect(me.json().user).toMatchObject({
      username: 'support:dev-one',
      name: 'dev-one (support)',
      role: 'admin',
      shared: false,
      actingPerson: null,
      mustChangePassword: false,
    });
  });

  it('leaves an ordinary sign-in as it was', async () => {
    const me = await t.send({ method: 'GET', url: '/api/v1/auth/me', token: admin });
    expect(me.statusCode).toBe(200);
    expect(me.json().user).toMatchObject({ username: 'admin', role: 'admin' });
    expect((await t.send({ ...read, token: admin })).statusCode).toBe(200);
  });
});

describe('a call that is not let in', () => {
  it('answers 401 for a wrong key, a key with no grant named, and a grant that is not an id', async () => {
    const grant = await t.approve(admin);
    const ended = {
      error: { code: 'unauthenticated', message: 'Your sign-in has ended. Please sign in again.' },
    };
    const calls: Send[] = [
      { ...read, token: newKey(), grant: grant.id },
      { ...read, token: one },
      { ...read, token: one, grant: 'not-an-id' },
      { ...read, token: one.slice(0, 20), grant: grant.id },
      { ...read, token: admin, grant: grant.id },
    ];
    for (const call of calls) {
      const res = await t.send(call);
      expect(res.statusCode, JSON.stringify({ ...call, token: 'x' })).toBe(401);
      expect(res.json()).toEqual(ended);
    }
    expect(await trail(grant)).toEqual([]);
  });

  it('answers 401 for a key shorter than 32 random bytes, even one that is on the list', async () => {
    const grant = await t.approve(admin, { platformUser: 'dev-short' });
    const res = await t.support(t.keys.short, grant.id, read);
    expect(res.statusCode).toBe(401);
    expect(await trail(grant)).toEqual([]);
  });

  it('answers 401 on a host that names no customer, or one we do not know', async () => {
    const grant = await t.approve(admin);
    for (const host of ['localhost', 'nobody.localhost']) {
      const res = await t.support(one, grant.id, { ...read, host });
      expect(res.statusCode, host).toBe(401);
    }
  });

  it('answers 403 with a real key when no such grant exists', async () => {
    await expectRefused(await t.support(one, NO_SUCH, read));
  });

  it("answers 403 when one person's grant is used with another person's key, and notes it", async () => {
    const grant = await t.approve(admin);
    await expectRefused(await t.support(two, grant.id, read));
    expect(await trail(grant)).toEqual([`refused GET ${PEOPLE}`]);
    expect((await t.support(one, grant.id, read)).statusCode).toBe(200);
  });

  it('answers 403 once the grant has run out', async () => {
    const grant = await t.approve(admin);
    expect((await t.support(one, grant.id, read)).statusCode).toBe(200);
    await t.db.admin.query(
      "UPDATE platform_access SET expires_at = now() - interval '1 second' WHERE id = $1",
      [grant.id],
    );
    await expectRefused(await t.support(one, grant.id, read));
    expect((await t.grants(admin)).find((g) => g.id === grant.id)?.status).toBe('ended');
  });

  it('answers 403 as soon as the admin ends the grant; ending it twice is 404', async () => {
    const grant = await t.approve(admin);
    expect((await t.support(one, grant.id, read)).statusCode).toBe(200);
    const end = () =>
      t.send({ method: 'DELETE', url: `/api/v1/support-access/${grant.id}`, token: admin });
    expect((await end()).statusCode).toBe(200);
    await expectRefused(await t.support(one, grant.id, read));
    expect((await end()).statusCode).toBe(404);
    expect(await trail(grant)).toEqual([`refused GET ${PEOPLE}`, `request GET ${PEOPLE}`]);
  });

  it('answers 403 for a grant from before approval was required, which has no approver', async () => {
    const legacy = (await t.db.admin.query(
      `ALTER TABLE platform_access DISABLE TRIGGER platform_access_guard;
         ALTER TABLE platform_access DROP CONSTRAINT platform_access_approver_required;
         INSERT INTO platform_access (tenant_id, platform_user, granted_by, reason, expires_at)
           VALUES ('${A}', 'dev-one', 'seed', 'From before the rule', now() + interval '1 day')
           RETURNING id;
         ALTER TABLE platform_access ADD CONSTRAINT platform_access_approver_required
           CHECK (approved_by_login_id IS NOT NULL) NOT VALID;
         ALTER TABLE platform_access ENABLE TRIGGER platform_access_guard`,
    )) as unknown as { rows: { id: string }[] }[];
    const id = legacy[2]!.rows[0]!.id;
    await expectRefused(await t.support(one, id, read));
    const listed = (await t.grants(admin)).find((g) => g.id === id);
    expect(listed).toMatchObject({ status: 'ended', approvedBy: null });
    const end = await t.send({
      method: 'DELETE',
      url: `/api/v1/support-access/${id}`,
      token: admin,
    });
    expect(end.statusCode).toBe(404);
  });
});

describe('one customer only', () => {
  it("answers 403 on another customer's host and reaches none of its data", async () => {
    const grant = await t.approve(admin);
    const there = await t.support(one, grant.id, { ...read, host: HOST_B });
    await expectRefused(there);
    expect(there.body).not.toContain('Bina');
    const theirs = await t.approve(bAdmin, {}, HOST_B);
    await expectRefused(await t.support(one, theirs.id, read));
    const own = await t.support(one, theirs.id, { ...read, host: HOST_B });
    expect(names(own)).toEqual(['Bina Admin']);
  });
});

describe('what a support person may not do', () => {
  it('cannot approve, list, read the actions of, or end support access', async () => {
    const grant = await t.approve(admin);
    const calls: [Omit<Send, 'token' | 'grant'>, string][] = [
      [{ method: 'POST', url: '/api/v1/support-access', payload: GRANT }, WRITE_REFUSED],
      [{ method: 'GET', url: '/api/v1/support-access' }, WRITE_REFUSED],
      [{ method: 'DELETE', url: `/api/v1/support-access/${grant.id}` }, WRITE_REFUSED],
      [{ method: 'GET', url: `/api/v1/support-access/${grant.id}/actions` }, WRITE_REFUSED],
    ];
    for (const [call, message] of calls)
      await expectRefused(await t.support(one, grant.id, call), message);
    const listed = await t.grants(admin);
    expect(listed.find((g) => g.id === grant.id)?.status).toBe('active');
    expect(
      listed.filter((g) => g.reason === GRANT.reason && g.createdAt > grant.createdAt),
    ).toEqual([]);
  });

  it("cannot change the approving admin's password or choose who is acting", async () => {
    const grant = await t.approve(admin);
    const password = { old: 'correct-horse-battery', password: pw('support') };
    await expectRefused(
      await t.support(one, grant.id, {
        method: 'POST',
        url: '/api/v1/auth/password',
        payload: password,
      }),
      WRITE_REFUSED,
    );
    await expectRefused(
      await t.support(one, grant.id, {
        method: 'POST',
        url: '/api/v1/auth/acting',
        payload: { actingPersonId: NO_SUCH },
      }),
      WRITE_REFUSED,
    );
    expect(await t.signIn('admin')).toEqual(expect.any(String));
  });

  it("cannot list the approving admin's signed-in devices", async () => {
    const grant = await t.approve(admin);
    await expectRefused(
      await t.support(one, grant.id, { method: 'GET', url: '/api/v1/auth/sessions' }),
      WRITE_REFUSED,
    );
  });

  it('cannot write tickets, people or logins, and nothing changes', async () => {
    const grant = await t.approve(admin);
    const before = (await t.send({ ...read, token: admin })).json();
    const logins = (await t.send({ method: 'GET', url: '/api/v1/logins', token: admin })).json();
    const aLogin = logins.items[0].id as string;
    const writes: Omit<Send, 'token' | 'grant'>[] = [
      { method: 'POST', url: '/api/v1/tickets', payload: { kind: 'general', problem: 'x' } },
      { method: 'POST', url: `/api/v1/tickets/${NO_SUCH}/start`, payload: {} },
      { method: 'POST', url: `/api/v1/tickets/${NO_SUCH}/close`, payload: {} },
      { method: 'POST', url: '/api/v1/tickets/past', payload: {} },
      { method: 'POST', url: PEOPLE, payload: { name: 'Made By Support', team: 'maintenance' } },
      { method: 'PUT', url: `${PEOPLE}/${before.items[0].id}`, payload: { name: 'Renamed' } },
      { method: 'POST', url: '/api/v1/logins', payload: { username: 'made-by-support' } },
      { method: 'PUT', url: `/api/v1/logins/${aLogin}`, payload: { role: 'operator' } },
    ];
    for (const call of writes)
      await expectRefused(await t.support(one, grant.id, call), WRITE_REFUSED);
    expect((await t.send({ ...read, token: admin })).json()).toEqual(before);
    expect((await t.send({ method: 'GET', url: '/api/v1/logins', token: admin })).json()).toEqual(
      logins,
    );
    expect(await trail(grant)).toEqual(
      writes
        .map((w) => `refused ${w.method} ${w.url}`.replace(/\/[0-9a-f-]{36}/, '/:id'))
        .reverse(),
    );
  });

  it('may change a plant setting, and the change is real', async () => {
    const grant = await t.approve(admin);
    const put = (general: boolean) =>
      t.support(one, grant.id, {
        method: 'PUT',
        url: FEATURES,
        payload: { value: { general, pause: true } },
      });
    expect((await put(false)).statusCode).toBe(200);
    expect(await generalFeature()).toBe(false);
    expect((await put(true)).statusCode).toBe(200);
    expect(await generalFeature()).toBe(true);
  });

  it('refuses every write route that is not on the short list, whatever is added later', async () => {
    const grant = await t.approve(admin);
    const table = routeTable(t.app).filter((r) => !isPublicRoute(r.method, r.url));
    const keys = table.map((r) => `${r.method} ${r.url}`);
    for (const allowed of SUPPORT_WRITES) expect(keys, allowed).toContain(allowed);
    const writes = table.filter((r) => r.method !== 'GET' && r.method !== 'HEAD');
    expect(writes.length).toBeGreaterThan(SUPPORT_WRITES.size + 20);
    const reached: string[] = [];
    for (const { method, url } of writes) {
      if (SUPPORT_WRITES.has(`${method} ${url}`)) continue;
      const res = await t.support(one, grant.id, {
        method: method as 'POST',
        url: url.replace(/:[A-Za-z]+/g, NO_SUCH),
      });
      const refused = res.statusCode === 403 && res.json().error.message === WRITE_REFUSED;
      if (!refused) reached.push(`${method} ${url} → ${res.statusCode}`);
    }
    expect(reached).toEqual([]);
    expect([...SUPPORT_WRITES].filter((w) => !/\/(settings|lists|translations)\//.test(w))).toEqual(
      [],
    );
  });
});

describe('the trail the customer sees', () => {
  it('has one line per call, with the route as registered: no ids, no query', async () => {
    const grant = await t.approve(admin);
    await t.support(one, grant.id, { method: 'GET', url: `${PEOPLE}?name=someone&x=1` });
    await t.support(one, grant.id, { method: 'GET', url: `/api/v1/tickets/${NO_SUCH}` });
    await t.support(one, grant.id, {
      method: 'PUT',
      url: FEATURES,
      payload: { value: { general: true, pause: true } },
    });
    await t.support(one, grant.id, { method: 'POST', url: PEOPLE, payload: {} });
    await t.send({ method: 'DELETE', url: `/api/v1/support-access/${grant.id}`, token: admin });
    await t.support(one, grant.id, read);
    const { items, nextCursor } = await actions(grant);
    expect(nextCursor).toBeNull();
    expect(items.map((a) => [a.kind, a.method, a.route])).toEqual([
      ['refused', 'GET', PEOPLE],
      ['refused', 'POST', PEOPLE],
      ['request', 'PUT', '/api/v1/settings/:key'],
      ['request', 'GET', '/api/v1/tickets/:id'],
      ['request', 'GET', PEOPLE],
    ]);
    for (const a of items) {
      expect(a).toEqual({
        id: expect.stringMatching(/^[0-9a-f-]{36}$/),
        at: expect.any(String),
        kind: a.kind,
        method: a.method,
        route: a.route,
        ip: '127.0.0.1',
      });
      expect(Number.isNaN(Date.parse(a.at))).toBe(false);
    }
    expect(JSON.stringify(items)).not.toContain(NO_SUCH);
    expect(JSON.stringify(items)).not.toContain('someone');
  });

  it('pages through the lines, newest first, without losing or repeating one', async () => {
    const grant = await t.approve(admin);
    for (let i = 0; i < 5; i += 1) await t.support(one, grant.id, read);
    const all = (await actions(grant)).items.map((a) => a.id);
    expect(all).toHaveLength(5);
    const paged: string[] = [];
    let cursor: string | null = null;
    do {
      const page = await actions(grant, `?limit=2${cursor ? `&cursor=${cursor}` : ''}`);
      expect(page.items.length).toBeLessThanOrEqual(2);
      paged.push(...page.items.map((a) => a.id));
      cursor = page.nextCursor;
    } while (cursor);
    expect(paged).toEqual(all);
  });

  // No route shows the plant's own audit lines yet (the audit screen is a later milestone), so this one test
  // reads them where they are kept, as people-api.test.ts does.
  it('marks a change made under the grant as such, never as the work of the admin who approved it', async () => {
    const grant = await t.approve(admin);
    const features = (general: boolean) => ({
      method: 'PUT' as const,
      url: FEATURES,
      payload: { value: { general, pause: false } },
    });
    const policies = ['S1', 'S2', 'S3', 'S4'].map((severity, i) => ({
      severity,
      ackMinutes: 5 + i,
      restoreMinutes: 60,
      businessHoursOnly: false,
    }));
    const byStaff: Omit<Send, 'token' | 'grant'>[] = [
      features(false),
      {
        method: 'POST',
        url: '/api/v1/settings/lists/wait_reason',
        payload: { code: 'by-staff', label: 'Added by support' },
      },
      { method: 'PUT', url: '/api/v1/settings/sla-policies', payload: { policies } },
    ];
    for (const call of byStaff) {
      const res = await t.support(one, grant.id, call);
      expect(res.statusCode, res.body).toBeLessThan(300);
    }
    expect((await t.send({ ...features(true), token: admin })).statusCode).toBe(200);
    const { rows } = await t.db.admin.query(
      `SELECT a.action, a.login_id IS NOT NULL AS names_a_login, a.platform_access_id AS grant_id
       FROM audit_log a JOIN platform_access g ON g.id = $1
       WHERE a.tenant_id = g.tenant_id AND a.created_at > g.created_at AND a.action NOT LIKE 'support%'
       ORDER BY a.created_at, a.id`,
      [grant.id],
    );
    expect(rows).toEqual([
      { action: 'setting.update', names_a_login: false, grant_id: grant.id },
      { action: expect.stringMatching(/\.create$/), names_a_login: false, grant_id: grant.id },
      { action: 'sla_policy.update', names_a_login: false, grant_id: grant.id },
      { action: 'setting.update', names_a_login: true, grant_id: null },
    ]);
  });
});

describe('when the trail cannot be written', () => {
  it('fails the call and does nothing: no read, no write', async () => {
    const grant = await t.approve(admin);
    await t.support(one, grant.id, {
      method: 'PUT',
      url: FEATURES,
      payload: { value: { general: true, pause: true } },
    });
    const restore = await breakAudit('support.request');
    try {
      const reading = await t.support(one, grant.id, read);
      expect(reading.statusCode).toBe(500);
      expect(reading.json().error.code).toBe('internal');
      expect(reading.body).not.toContain('Asha');
      const writing = await t.support(one, grant.id, {
        method: 'PUT',
        url: FEATURES,
        payload: { value: { general: false, pause: true } },
      });
      expect(writing.statusCode).toBe(500);
      expect(await generalFeature()).toBe(true);
    } finally {
      await restore();
    }
    expect((await t.support(one, grant.id, read)).statusCode).toBe(200);
  });

  it('still answers 403 to a refused call', async () => {
    const grant = await t.approve(admin);
    const restore = await breakAudit('support.refused');
    try {
      await expectRefused(await t.support(two, grant.id, read));
      await expectRefused(
        await t.support(one, grant.id, { method: 'POST', url: PEOPLE, payload: {} }),
        WRITE_REFUSED,
      );
    } finally {
      await restore();
    }
    expect(await trail(grant)).toEqual([]);
  });
});

describe('guessing a key', () => {
  it('answers 429 after twenty wrong keys from one address, and a right key is never counted', async () => {
    const grant = await t.approve(admin);
    const guesser = '203.0.113.9';
    const staff = '203.0.113.10';
    for (let i = 0; i < 30; i += 1)
      expect((await t.support(one, grant.id, { ...read, ip: staff })).statusCode).toBe(200);
    for (let i = 0; i < 20; i += 1)
      expect((await t.support(newKey(), grant.id, { ...read, ip: guesser })).statusCode).toBe(401);
    const blocked = await t.support(newKey(), grant.id, { ...read, ip: guesser });
    expect(blocked.statusCode).toBe(429);
    expect(blocked.json().error.code).toBe('rate_limited');
    expect((await t.support(one, grant.id, { ...read, ip: guesser })).statusCode).toBe(429);
    expect((await t.support(one, grant.id, { ...read, ip: staff })).statusCode).toBe(200);
    expect((await t.send({ ...read, token: admin, ip: guesser })).statusCode).toBe(200);
  });
});

describe('what the server logs', () => {
  it('never writes a key, or the grant a call named, to the log', async () => {
    const grant = await t.approve(admin);
    await t.support(one, grant.id, read);
    await t.support(newKey(), grant.id, read);
    const restore = await breakAudit('support.request');
    try {
      expect((await t.support(one, grant.id, read)).statusCode).toBe(500);
    } finally {
      await restore();
    }
    const log = t.logged.join('\n');
    expect(t.logged.length).toBeGreaterThan(100);
    expect(log).toContain('audit is down (test)');
    for (const secret of [one, two, grant.id]) expect(log.includes(secret)).toBe(false);
    expect(log.toLowerCase()).not.toContain('x-support-grant');
  });
});
