import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  A,
  PEOPLE_LOCK,
  holdLock,
  peopleLockKey,
  startPeopleApp,
  waitUntilBlocked,
  type PeopleApp,
  type Res,
} from './people-harness.js';

const TEMP = 'Temp-pass-4821';
const PUSH = {
  endpoint: 'https://fcm.googleapis.com/fcm/send/race-endpoint',
  keys: { p256dh: 'test-p256dh', auth: 'test-auth' },
};

let t: PeopleApp;
let admin: string;
let n = 0;
type Lock = Awaited<ReturnType<typeof holdLock>>;

async function addPerson(name: string): Promise<string> {
  const res = await t.call('POST', '/api/v1/people', admin, { name, team: 'maintenance' });
  expect(res.statusCode, res.body).toBe(201);
  return res.json().id;
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
  return res.json().id;
}

/** A person with a personal login, signed in. */
async function addUser(role = 'technician') {
  n += 1;
  const personId = await addPerson(`Race Person ${n}`);
  const username = `race.user${n}`;
  const loginId = await addLogin(username, { role, personId });
  const token = await t.signIn(username, undefined, TEMP);
  return { personId, username, loginId, token };
}

/** Runs `request` and holds it at `lock` until `whileHeld` has changed the data underneath it. */
async function race(
  lock: Lock,
  request: () => Promise<Res>,
  whileHeld: (lock: Lock) => Promise<unknown>,
): Promise<Res> {
  const pending = request();
  try {
    await waitUntilBlocked(t.db);
    await whileHeld(lock);
  } finally {
    await lock.release();
  }
  return pending;
}

const peopleLock = () => holdLock(t.db, PEOPLE_LOCK, [peopleLockKey(A)]);
const count = async (sql: string, params: unknown[] = []): Promise<number> =>
  Number((await t.db.admin.query(sql, params)).rows[0].n);

beforeAll(async () => {
  t = await startPeopleApp();
  admin = await t.signIn('admin');
}, 120_000);

afterAll(() => t.stop());

describe('an admin who loses admin while a request waits is refused', () => {
  const losses: [string, string][] = [
    ['login switched off', 'UPDATE login SET disabled_at = now() WHERE id = $1'],
    ['demoted', "UPDATE login SET role = 'head' WHERE id = $1"],
    [
      'person switched off',
      'UPDATE person SET active = false WHERE id = (SELECT person_id FROM login WHERE id = $1)',
    ],
  ];
  const requests: [string, (token: string, target: string) => Promise<Res>][] = [
    ['add a person', (tok) => t.call('POST', '/api/v1/people', tok, { name: 'X', team: 'vendor' })],
    [
      'edit a person',
      (tok, target) => t.call('PUT', `/api/v1/people/${target}`, tok, { title: 'Changed' }),
    ],
    [
      'add a login',
      (tok, target) =>
        t.call('POST', '/api/v1/logins', tok, {
          username: 'late.login',
          role: 'operator',
          shared: false,
          personId: target,
          temporaryPassword: TEMP,
        }),
    ],
    [
      'edit a login',
      (tok, target) =>
        t.call('PUT', `/api/v1/logins/${target}`, tok, { temporaryPassword: 'Late-reset-9921' }),
    ],
  ];

  for (const [lost, sql] of losses) {
    for (const [what, send] of requests) {
      it(`${what}, after the admin's ${lost}`, async () => {
        const boss = await addUser('admin');
        const target = await addUser('operator');
        const subject =
          what.includes('login') && what !== 'add a login' ? target.loginId : target.personId;
        const audits = await count('SELECT count(*)::int AS n FROM audit_log');
        const res = await race(
          await peopleLock(),
          () => send(boss.token, subject),
          (lock) => lock.query(sql, [boss.loginId]),
        );
        expect(res.statusCode, res.body).toBe(403);
        expect(await count('SELECT count(*)::int AS n FROM audit_log')).toBe(audits);
        const title = await count('SELECT count(*)::int AS n FROM person WHERE title = $1', [
          'Changed',
        ]);
        expect(title).toBe(0);
        expect(
          await count("SELECT count(*)::int AS n FROM login WHERE username = 'late.login'"),
        ).toBe(0);
        expect(await t.signIn(target.username, undefined, TEMP)).toBeTruthy();
      });
    }
  }
});

describe('a login is not added for a person who is being switched off', () => {
  it('answers 409 and adds nothing', async () => {
    const personId = await addPerson('Leaving Person');
    const res = await race(
      await peopleLock(),
      () =>
        t.call('POST', '/api/v1/logins', admin, {
          username: 'for.leaver',
          role: 'operator',
          shared: false,
          personId,
          temporaryPassword: TEMP,
        }),
      (lock) => lock.query('UPDATE person SET active = false WHERE id = $1', [personId]),
    );
    expect(res.statusCode, res.body).toBe(409);
    expect(await count("SELECT count(*)::int AS n FROM login WHERE username = 'for.leaver'")).toBe(
      0,
    );
  });
});

describe('a sign-in is not created for a login that stops being valid while it is signing in', () => {
  const signInAttempt = (username: string, extra: object = {}) =>
    t.call('POST', '/api/v1/auth/login', undefined, { username, password: TEMP, ...extra });
  const sessions = (loginId: string) =>
    count('SELECT count(*)::int AS n FROM session WHERE login_id = $1', [loginId]);

  it('refuses when the login is switched off meanwhile', async () => {
    const u = await addUser();
    const before = await sessions(u.loginId);
    const lock = await holdLock(t.db, 'SELECT 1 FROM login WHERE id = $1 FOR UPDATE', [u.loginId]);
    const res = await race(
      lock,
      () => signInAttempt(u.username),
      (l) => l.query('UPDATE login SET disabled_at = now() WHERE id = $1', [u.loginId]),
    );
    expect(res.statusCode).toBe(401);
    expect(await sessions(u.loginId)).toBe(before);
  });

  it('refuses when the password is reset meanwhile', async () => {
    const u = await addUser();
    const before = await sessions(u.loginId);
    const lock = await holdLock(t.db, 'SELECT 1 FROM login WHERE id = $1 FOR UPDATE', [u.loginId]);
    const res = await race(
      lock,
      () => signInAttempt(u.username),
      (l) =>
        l.query("UPDATE login SET password_hash = password_hash || 'x' WHERE id = $1", [u.loginId]),
    );
    expect(res.statusCode).toBe(401);
    expect(await sessions(u.loginId)).toBe(before);
  });

  it('refuses when the person is switched off meanwhile', async () => {
    const u = await addUser();
    const before = await sessions(u.loginId);
    const lock = await holdLock(t.db, 'SELECT 1 FROM person WHERE id = $1 FOR UPDATE', [
      u.personId,
    ]);
    const res = await race(
      lock,
      () => signInAttempt(u.username),
      (l) => l.query('UPDATE person SET active = false WHERE id = $1', [u.personId]),
    );
    expect(res.statusCode).toBe(401);
    expect(await sessions(u.loginId)).toBe(before);
  });

  it('refuses a shared login acting as a person switched off meanwhile', async () => {
    const acting = await addPerson('Shared Acting');
    const loginId = await addLogin('race.shared', { role: 'operator', shared: true });
    const before = await sessions(loginId);
    const lock = await holdLock(t.db, 'SELECT 1 FROM person WHERE id = $1 FOR UPDATE', [acting]);
    const res = await race(
      lock,
      () => signInAttempt('race.shared', { actingPersonId: acting }),
      (l) => l.query('UPDATE person SET active = false WHERE id = $1', [acting]),
    );
    expect(res.statusCode).toBe(401);
    expect(await sessions(loginId)).toBe(before);
  });
});

describe('a push registration is refused when its login or person stops being valid', () => {
  const subscribe = (token: string, actingPersonId: string) =>
    t.call('POST', '/api/v1/push/subscribe', token, { subscription: PUSH, actingPersonId });
  const subs = () => count('SELECT count(*)::int AS n FROM push_subscription');

  it('refuses when the login is switched off meanwhile (401)', async () => {
    const u = await addUser();
    const lock = await holdLock(t.db, 'SELECT 1 FROM login WHERE id = $1 FOR UPDATE', [u.loginId]);
    const res = await race(
      lock,
      () => subscribe(u.token, u.personId),
      (l) => l.query('UPDATE login SET disabled_at = now() WHERE id = $1', [u.loginId]),
    );
    expect(res.statusCode, res.body).toBe(401);
    expect(await subs()).toBe(0);
  });

  it('refuses when the person is switched off meanwhile (401)', async () => {
    const u = await addUser();
    const lock = await holdLock(t.db, 'SELECT 1 FROM person WHERE id = $1 FOR UPDATE', [
      u.personId,
    ]);
    const res = await race(
      lock,
      () => subscribe(u.token, u.personId),
      (l) => l.query('UPDATE person SET active = false WHERE id = $1', [u.personId]),
    );
    expect(res.statusCode, res.body).toBe(401);
    expect(await subs()).toBe(0);
  });

  it('registers a phone for a login that is valid', async () => {
    const u = await addUser();
    expect((await subscribe(u.token, u.personId)).statusCode).toBe(200);
    expect(await subs()).toBe(1);
  });
});

describe('a refused call changes nothing about the sign-in', () => {
  it('does not extend a session whose acting person was switched off behind its back', async () => {
    const u = await addUser();
    await t.db.admin.query(
      "UPDATE session SET last_seen_at = now() - interval '5 days', expires_at = now() + interval '10 days' WHERE login_id = $1",
      [u.loginId],
    );
    const before = (
      await t.db.admin.query('SELECT last_seen_at, expires_at FROM session WHERE login_id = $1', [
        u.loginId,
      ])
    ).rows;
    await t.db.admin.query('UPDATE person SET active = false WHERE id = $1', [u.personId]);
    expect((await t.call('GET', '/api/v1/auth/me', u.token)).statusCode).toBe(401);
    const after = (
      await t.db.admin.query('SELECT last_seen_at, expires_at FROM session WHERE login_id = $1', [
        u.loginId,
      ])
    ).rows;
    expect(after).toEqual(before);
  });
});

describe('locks are taken person first, then login, everywhere', () => {
  it('a push registration waiting behind a switch-off does not deadlock with it', async () => {
    const u = await addUser();
    const lock = await holdLock(t.db, 'SELECT 1 FROM person WHERE id = $1 FOR UPDATE', [
      u.personId,
    ]);
    const res = await race(
      lock,
      () =>
        t.call('POST', '/api/v1/push/subscribe', u.token, {
          subscription: PUSH,
          actingPersonId: u.personId,
        }),
      (l) => l.query('UPDATE login SET disabled_at = now() WHERE id = $1', [u.loginId]),
    );
    expect(res.statusCode, res.body).toBe(401);
  });

  it('a sign-in waiting behind a switch-off does not deadlock with it', async () => {
    const u = await addUser();
    const lock = await holdLock(t.db, 'SELECT 1 FROM person WHERE id = $1 FOR UPDATE', [
      u.personId,
    ]);
    const res = await race(
      lock,
      () =>
        t.call('POST', '/api/v1/auth/login', undefined, { username: u.username, password: TEMP }),
      (l) => l.query('UPDATE login SET disabled_at = now() WHERE id = $1', [u.loginId]),
    );
    expect(res.statusCode, res.body).toBe(401);
  });
});

describe('a person is not switched off while they are being put on a ticket', () => {
  it('a handover to them that waits behind the switch-off is refused once they are off', async () => {
    const worker = await addUser();
    const target = await addUser();
    const ticket = await t.call('POST', '/api/v1/tickets', worker.token, {
      kind: 'general',
      location: 'Shop floor',
      workType: 'repair',
      problem: 'Door hinge',
      startNow: true,
      startByPersonId: worker.personId,
    });
    const id = ticket.json().ticket.id;
    const lock = await holdLock(t.db, 'SELECT 1 FROM person WHERE id = $1 FOR UPDATE', [
      target.personId,
    ]);
    const res = await race(
      lock,
      () =>
        t.call('POST', `/api/v1/tickets/${id}/pause`, worker.token, {
          personId: worker.personId,
          reasonCode: 'spare',
          assignToPersonId: target.personId,
        }),
      (l) => l.query('UPDATE person SET active = false WHERE id = $1', [target.personId]),
    );
    expect(res.statusCode, res.body).toBe(422);
  });
});
