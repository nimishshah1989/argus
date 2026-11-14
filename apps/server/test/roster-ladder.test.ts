import { randomUUID } from 'node:crypto';
import { hash } from '@node-rs/argon2';
import type { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ESCALATION_DEFAULTS } from '@uptimo/domain';
import { withTenant } from '@uptimo/db';
import { buildApp } from '../src/app.js';
import { ensureEscalationDefaults } from '../src/modules/accountability/index.js';
import type { AppConfig } from '../src/kernel/index.js';
import { runRetentionJob } from '../src/retention.js';
import { startTestDb, type TestDb } from './harness.js';

const A = '82000000-0000-0000-0000-000000000001';
const B = '83000000-0000-0000-0000-000000000001';
const C = '85000000-0000-0000-0000-000000000001';
const D = '86000000-0000-0000-0000-000000000001';
const PASSWORD = 'correct-horse-battery';
const ROLES = ['head', 'admin', 'supervisor', 'technician', 'plant_head', 'operator', 'board'];

type App = Awaited<ReturnType<typeof buildApp>>;
let db: TestDb;
let admin: Pool;
let app: App;
let key = 0;
let today = '';
const tokens: Record<string, string> = {};
const tokenB: Record<string, string> = {};
const tokenC: Record<string, string> = {};
const tokenD: Record<string, string> = {};
const ids = {
  shiftA: randomUUID(),
  shiftAOff: randomUUID(),
  shiftB: randomUUID(),
  shiftC: randomUUID(),
  personA: randomUUID(),
  personA2: randomUUID(),
  personB: randomUUID(),
  personC: randomUUID(),
};

type Method = 'GET' | 'POST' | 'PUT';
function call(
  host: string,
  request: { method: Method; url: string; token: string; body?: object },
) {
  key += 1;
  const { method, url, token, body } = request;
  return app.inject({
    method,
    url,
    headers: {
      host: `${host}.localhost`,
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      'idempotency-key': `rl-${key}`,
    },
    ...(body ? { payload: body } : {}),
  });
}
const a = (method: Method, url: string, who = 'head', body?: object) =>
  call('rla', { method, url, token: tokens[who] ?? '', body });
const b = (method: Method, url: string, who = 'head', body?: object) =>
  call('rlb', { method, url, token: tokenB[who] ?? '', body });
const c = (method: Method, url: string, who = 'head', body?: object) =>
  call('rlc', { method, url, token: tokenC[who] ?? '', body });
const d = (method: Method, url: string, who = 'head', body?: object) =>
  call('rld', { method, url, token: tokenD[who] ?? '', body });

const dayOffset = async (days: number): Promise<string> =>
  (
    await admin.query("SELECT ((now() AT TIME ZONE 'Asia/Kolkata')::date + $1::int)::text AS d", [
      days,
    ])
  ).rows[0].d;

const line = (over: Record<string, unknown> = {}) => ({
  date: today,
  shiftId: ids.shiftA,
  personId: ids.personA,
  level: 'L1',
  ...over,
});

async function auditActions(tenant: string, entity: string): Promise<string[]> {
  return (
    await admin.query(
      'SELECT action FROM audit_log WHERE tenant_id = $1 AND entity = $2 ORDER BY at, id',
      [tenant, entity],
    )
  ).rows.map((r) => r.action);
}

async function seedTenant(
  id: string,
  slug: string,
  hashed: string,
  tokenOf: Record<string, string>,
) {
  await admin.query('INSERT INTO tenant (id, slug, name) VALUES ($1, $2, $2)', [id, slug]);
  for (const role of ROLES) {
    const person = randomUUID();
    await admin.query(
      "INSERT INTO person (id, tenant_id, name, team) VALUES ($1, $2, $3, 'maintenance')",
      [person, id, role],
    );
    await admin.query(
      `INSERT INTO login (tenant_id, person_id, username, password_hash, role, shared)
       VALUES ($1, $2, $3, $4, $3, false)`,
      [id, person, role, hashed],
    );
  }
  const host = `${slug}.localhost`;
  for (const role of ROLES) {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { host, 'content-type': 'application/json' },
      payload: { username: role, password: PASSWORD },
    });
    expect(res.statusCode, `login ${slug} ${role}`).toBe(200);
    tokenOf[role] = res.json().token as string;
  }
}

beforeAll(async () => {
  db = await startTestDb();
  admin = db.admin;
  const hashed = await hash(PASSWORD, {
    algorithm: 2,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
  const config: AppConfig = { pool: db.app, logger: false, rateLimitMax: 100000 };
  app = await buildApp(config);
  await seedTenant(A, 'rla', hashed, tokens);
  await seedTenant(B, 'rlb', hashed, tokenB);
  await seedTenant(C, 'rlc', hashed, tokenC);
  await seedTenant(D, 'rld', hashed, tokenD);
  await admin.query("UPDATE tenant SET time_zone = 'America/New_York' WHERE id = $1", [C]);
  today = await dayOffset(0);
  for (const [tenant, shift, off] of [
    [A, ids.shiftA, false],
    [A, ids.shiftAOff, true],
    [B, ids.shiftB, false],
    [C, ids.shiftC, false],
  ] as const) {
    await admin.query(
      `INSERT INTO shift (id, tenant_id, code, name, starts_at, ends_at, crosses_midnight, active)
       VALUES ($1, $2, $3, 'S', '00:00', '00:00', true, $4)`,
      [shift, tenant, off ? '2' : '1', !off],
    );
  }
  for (const [person, tenant] of [
    [ids.personA, A],
    [ids.personA2, A],
    [ids.personB, B],
    [ids.personC, C],
  ] as const) {
    await admin.query(
      "INSERT INTO person (id, tenant_id, name, team) VALUES ($1, $2, 'Duty', 'maintenance')",
      [person, tenant],
    );
  }
}, 120_000);

afterAll(async () => {
  await app.close();
  await db.stop();
});

describe('who may use the roster and the ladder (DOMAIN §3: head and admin)', () => {
  it('lets the head and the admin read and write both', async () => {
    for (const who of ['head', 'admin']) {
      expect((await a('GET', '/api/v1/roster', who)).statusCode, who).toBe(200);
      expect((await a('GET', '/api/v1/escalation-rules', who)).statusCode, who).toBe(200);
    }
  });

  it('refuses every other role, on read and on write, and a call with no sign-in', async () => {
    const someId = randomUUID();
    for (const who of ['supervisor', 'technician', 'plant_head', 'operator', 'board']) {
      for (const path of ['roster', 'escalation-rules']) {
        const url = `/api/v1/${path}`;
        expect((await a('GET', url, who)).statusCode, `${who} GET ${path}`).toBe(403);
        expect((await a('POST', url, who, line())).statusCode, `${who} POST ${path}`).toBe(403);
        expect((await a('PUT', `${url}/${someId}`, who, { level: 'L2' })).statusCode).toBe(403);
      }
    }
    expect(
      (await call('rla', { method: 'GET', url: '/api/v1/roster', token: '' })).statusCode,
    ).toBe(401);
  });
});

describe('the duty roster', () => {
  it('adds a line and lists it with the date as written', async () => {
    const res = await a('POST', '/api/v1/roster', 'head', line());
    expect(res.statusCode, res.body).toBe(201);
    expect(res.json()).toEqual({
      id: expect.any(String),
      date: today,
      shiftId: ids.shiftA,
      personId: ids.personA,
      level: 'L1',
      active: true,
    });
    const list = (await a('GET', '/api/v1/roster')).json();
    expect(list.nextCursor).toBeNull();
    expect(list.items.map((i: { id: string }) => i.id)).toContain(res.json().id);
    expect(await auditActions(A, 'roster_entry')).toContain('roster.create');
  });

  it('refuses a person twice on one shift and day, with a 409 on personId', async () => {
    const again = await a('POST', '/api/v1/roster', 'head', line({ level: 'L2' }));
    expect(again.statusCode).toBe(409);
    expect(again.json().error.field).toBe('personId');
  });

  it('refuses what cannot be a roster line, naming the field', async () => {
    const cases: Array<[string, Record<string, unknown>]> = [
      ['shiftId', { shiftId: randomUUID() }],
      ['shiftId', { shiftId: ids.shiftAOff }],
      ['shiftId', { shiftId: ids.shiftB }],
      ['personId', { personId: randomUUID() }],
      ['personId', { personId: ids.personB }],
      ['date', { date: '2026-02-30' }],
      ['date', { date: await dayOffset(-366) }],
      ['date', { date: await dayOffset(367) }],
      ['level', { level: 'L9' }],
    ];
    for (const [field, over] of cases) {
      const res = await a(
        'POST',
        '/api/v1/roster',
        'head',
        line({ personId: ids.personA2, ...over }),
      );
      expect(res.statusCode, `${field} ${JSON.stringify(over)}: ${res.body}`).toBe(422);
      expect(res.json().error.field).toBe(field);
    }
  });

  it('moves a line between levels, and sending the form back unchanged is not a change', async () => {
    const made = (
      await a('POST', '/api/v1/roster', 'head', line({ personId: ids.personA2 }))
    ).json();
    const before = (await auditActions(A, 'roster_entry')).length;
    const form = {
      date: made.date,
      shiftId: made.shiftId,
      personId: made.personId,
      level: made.level,
    };
    const same = await a('PUT', `/api/v1/roster/${made.id}`, 'head', { ...form, active: 'true' });
    expect(same.statusCode, same.body).toBe(200);
    expect((await auditActions(A, 'roster_entry')).length).toBe(before);
    const moved = await a('PUT', `/api/v1/roster/${made.id}`, 'head', { level: 'L3' });
    expect(moved.json().level).toBe('L3');
    expect((await auditActions(A, 'roster_entry')).at(-1)).toBe('roster.update');
    const person = await a('PUT', `/api/v1/roster/${made.id}`, 'head', { personId: ids.personA });
    expect(person.statusCode).toBe(422);
    expect(person.json().error.field).toBe('personId');
  });

  it('takes a person off with active: false, once, and the audit keeps the line', async () => {
    const made = (
      await a('POST', '/api/v1/roster', 'head', line({ date: await dayOffset(1), level: 'vendor' }))
    ).json();
    const off = await a('PUT', `/api/v1/roster/${made.id}`, 'head', { active: false });
    expect(off.statusCode, off.body).toBe(200);
    expect(off.json()).toEqual({ ...made, active: false });
    const stored = await admin.query('SELECT 1 FROM roster_entry WHERE id = $1', [made.id]);
    expect(stored.rowCount).toBe(0);
    const entry = (
      await admin.query(
        "SELECT before, after FROM audit_log WHERE entity_id = $1 AND action = 'roster.remove'",
        [made.id],
      )
    ).rows[0];
    expect(entry.before).toMatchObject({ personId: ids.personA, level: 'vendor' });
    expect(entry.after).toBeNull();
    expect(
      (await a('PUT', `/api/v1/roster/${made.id}`, 'head', { active: false })).statusCode,
    ).toBe(404);
  });

  it('keeps one plant out of the other', async () => {
    const mine = (
      await a('POST', '/api/v1/roster', 'head', line({ date: await dayOffset(2) }))
    ).json();
    const theirs = (
      await b(
        'POST',
        '/api/v1/roster',
        'head',
        line({ shiftId: ids.shiftB, personId: ids.personB }),
      )
    ).json();
    const listB = (await b('GET', '/api/v1/roster')).json().items.map((i: { id: string }) => i.id);
    expect(listB).toContain(theirs.id);
    expect(listB).not.toContain(mine.id);
    expect((await b('PUT', `/api/v1/roster/${mine.id}`, 'head', { level: 'L4' })).statusCode).toBe(
      404,
    );
    expect(
      (await b('PUT', `/api/v1/roster/${mine.id}`, 'head', { active: false })).statusCode,
    ).toBe(404);
    expect(
      (await admin.query('SELECT level FROM roster_entry WHERE id = $1', [mine.id])).rows[0].level,
    ).toBe('L1');
  });
});

describe('the roster list window', () => {
  const idsOf = (res: { json: () => { items: { id: string }[] } }) =>
    res.json().items.map((i) => i.id);

  it('lists today minus 7 days to today plus 35 days by default, and takes ?from and ?to', async () => {
    const at: Record<string, string> = {};
    for (const offset of [-8, -7, 35, 36]) {
      const row = await admin.query(
        `INSERT INTO roster_entry (tenant_id, date, shift_id, person_id, level)
         VALUES ($1, $2, $3, $4, 'L1') RETURNING id`,
        [A, await dayOffset(offset), ids.shiftA, ids.personA2],
      );
      at[offset] = row.rows[0].id;
    }
    const byDefault = idsOf(await a('GET', '/api/v1/roster'));
    expect(byDefault).toContain(at[-7]);
    expect(byDefault).toContain(at[35]);
    expect(byDefault).not.toContain(at[-8]);
    expect(byDefault).not.toContain(at[36]);

    const wide = await a(
      'GET',
      `/api/v1/roster?from=${await dayOffset(-8)}&to=${await dayOffset(36)}`,
    );
    expect(wide.json().nextCursor).toBeNull();
    for (const offset of [-8, -7, 35, 36]) expect(idsOf(wide)).toContain(at[offset]);
    const narrow = idsOf(
      await a('GET', `/api/v1/roster?from=${await dayOffset(35)}&to=${await dayOffset(35)}`),
    );
    expect(narrow).toEqual([at[35]]);
  });

  it('allows a span of 120 days and refuses a longer one, a backwards one and a bad date with a 422', async () => {
    const from = await dayOffset(-8);
    const ok = await a('GET', `/api/v1/roster?from=${from}&to=${await dayOffset(112)}`);
    expect(ok.statusCode, ok.body).toBe(200);
    const tooLong = await a('GET', `/api/v1/roster?from=${from}&to=${await dayOffset(113)}`);
    expect(tooLong.statusCode).toBe(422);
    expect(tooLong.json().error.field).toBe('to');
    const backwards = await a('GET', `/api/v1/roster?from=${await dayOffset(3)}&to=${from}`);
    expect(backwards.statusCode).toBe(422);
    expect(backwards.json().error.field).toBe('from');
    for (const query of ['from=tomorrow', 'to=2026-02-30']) {
      const bad = await a('GET', `/api/v1/roster?${query}`);
      expect(bad.statusCode, query).toBe(422);
      expect(bad.json().error.field).toBe(query.split('=')[0]);
    }
  });
});

describe('the escalation ladder', () => {
  const rows = async (tenant: string) =>
    (await admin.query('SELECT * FROM escalation_rule WHERE tenant_id = $1', [tenant])).rows;

  it('starts a plant that has no ladder with the agreed defaults as ordinary rows, once', async () => {
    expect(await rows(B)).toHaveLength(0);
    const first = (await b('GET', '/api/v1/escalation-rules')).json();
    expect(first.items).toHaveLength(ESCALATION_DEFAULTS.length);
    for (const d of ESCALATION_DEFAULTS) {
      expect(first.items).toContainEqual(
        expect.objectContaining({
          trigger: d.trigger,
          severityMin: d.severityMin,
          level: d.level,
          notifyRole: d.notifyRole,
          notifyPersonId: null,
          channel: 'push',
          delayMinutes: d.delayMinutes,
          repeatMinutes: d.repeatMinutes,
          repeatCap: d.repeatCap,
          active: true,
        }),
      );
    }
    await b('GET', '/api/v1/escalation-rules', 'admin');
    expect(await rows(B)).toHaveLength(ESCALATION_DEFAULTS.length);
    expect(await auditActions(B, 'escalation_rule')).toEqual(['escalation_rule.seed']);
  });

  it('keeps an edited ladder: an edit survives a later read, and so does switching every rule off', async () => {
    const [first] = (await a('GET', '/api/v1/escalation-rules')).json().items;
    const edited = await a('PUT', `/api/v1/escalation-rules/${first.id}`, 'head', {
      severityMin: 'S2',
      delayMinutes: '45',
      repeatMinutes: '60',
      repeatCap: '2',
    });
    expect(edited.statusCode, edited.body).toBe(200);
    expect(edited.json()).toMatchObject({
      severityMin: 'S2',
      delayMinutes: 45,
      repeatMinutes: 60,
      repeatCap: 2,
    });
    expect((await auditActions(A, 'escalation_rule')).at(-1)).toBe('escalation_rule.update');
    for (const rule of (await a('GET', '/api/v1/escalation-rules')).json().items) {
      await a('PUT', `/api/v1/escalation-rules/${rule.id}`, 'head', { active: 'false' });
    }
    const after = (await a('GET', '/api/v1/escalation-rules')).json().items;
    expect(after).toHaveLength(ESCALATION_DEFAULTS.length);
    expect(after.every((r: { active: boolean }) => !r.active)).toBe(true);
    expect(after.find((r: { id: string }) => r.id === first.id)).toMatchObject({
      delayMinutes: 45,
    });
  });

  it('refuses a repeat under 15 minutes, a repeat with no cap, and a cap with no repeat', async () => {
    const [rule] = (await a('GET', '/api/v1/escalation-rules')).json().items;
    const put = (body: object) => a('PUT', `/api/v1/escalation-rules/${rule.id}`, 'head', body);
    const field = async (body: object) => {
      const res = await put(body);
      expect(res.statusCode, `${JSON.stringify(body)}: ${res.body}`).toBe(422);
      return res.json().error.field;
    };
    expect(await field({ repeatMinutes: '10', repeatCap: '3' })).toBe('repeatMinutes');
    expect(await field({ repeatMinutes: '14', repeatCap: '3' })).toBe('repeatMinutes');
    expect(await field({ repeatMinutes: '30', repeatCap: '' })).toBe('repeatCap');
    expect(await field({ repeatMinutes: '30', repeatCap: '0' })).toBe('repeatCap');
    expect(await field({ repeatMinutes: '', repeatCap: '3' })).toBe('repeatMinutes');
    expect((await put({ repeatMinutes: '15', repeatCap: '1' })).statusCode).toBe(200);
    const none = await put({ repeatMinutes: '', repeatCap: '' });
    expect(none.statusCode, none.body).toBe(200);
    expect(none.json()).toMatchObject({ repeatMinutes: null, repeatCap: null });
  });

  it('adds a rule for a named person or a role, never both or neither', async () => {
    const base = {
      trigger: 'restore_missed',
      severityMin: 'S2',
      level: 'vendor',
      channel: 'whatsapp',
    };
    const both = await a('POST', '/api/v1/escalation-rules', 'head', {
      ...base,
      notifyRole: 'head',
      notifyPersonId: ids.personA,
    });
    expect(both.statusCode).toBe(422);
    expect(both.json().error.field).toBe('notifyRole');
    const neither = await a('POST', '/api/v1/escalation-rules', 'head', base);
    expect(neither.statusCode).toBe(422);
    const stranger = await a('POST', '/api/v1/escalation-rules', 'head', {
      ...base,
      notifyPersonId: ids.personB,
    });
    expect(stranger.statusCode).toBe(422);
    expect(stranger.json().error.field).toBe('notifyPersonId');
    const ok = await a('POST', '/api/v1/escalation-rules', 'head', {
      ...base,
      notifyPersonId: ids.personA,
      delayMinutes: '20',
    });
    expect(ok.statusCode, ok.body).toBe(201);
    expect(ok.json()).toMatchObject({
      level: 'vendor',
      channel: 'whatsapp',
      notifyPersonId: ids.personA,
      notifyRole: null,
      delayMinutes: 20,
    });
    const twice = await a('POST', '/api/v1/escalation-rules', 'head', {
      ...base,
      notifyPersonId: ids.personA,
    });
    expect(twice.statusCode).toBe(409);
    expect((await auditActions(A, 'escalation_rule')).at(-1)).toBe('escalation_rule.create');
  });

  it('refuses a trigger, level or channel that is not on the list', async () => {
    for (const bad of [
      { trigger: 'nope' },
      { level: 'L5' },
      { channel: 'sms' },
      { severityMin: 'S9' },
    ]) {
      const res = await a('POST', '/api/v1/escalation-rules', 'head', {
        trigger: 'ack_missed',
        severityMin: 'S1',
        level: 'L2',
        notifyRole: 'supervisor',
        ...bad,
      });
      expect(res.statusCode, JSON.stringify(bad)).toBe(422);
      expect(res.json().error.field).toBe(Object.keys(bad)[0]);
    }
  });

  it('writes one seed audit row when a second first read arrives while the first is still seeding', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let seeded: () => void = () => undefined;
    const reached = new Promise<void>((resolve) => {
      seeded = resolve;
    });
    const first = withTenant(db.app, C, async (client) => {
      await ensureEscalationDefaults(client, { tenantId: C, loginId: null });
      seeded();
      await gate;
    });
    await reached;
    const second = c('GET', '/api/v1/escalation-rules');
    await new Promise((resolve) => setTimeout(resolve, 300));
    release();
    await first;
    const res = await second;
    expect(res.statusCode, res.body).toBe(200);
    expect(res.json().items).toHaveLength(ESCALATION_DEFAULTS.length);
    expect(await rows(C)).toHaveLength(ESCALATION_DEFAULTS.length);
    expect(await auditActions(C, 'escalation_rule')).toEqual(['escalation_rule.seed']);
  });

  it('seeds the defaults first when the very first thing a plant does is add a rule', async () => {
    const made = await d('POST', '/api/v1/escalation-rules', 'head', {
      trigger: 'restore_missed',
      severityMin: 'S4',
      level: 'L2',
      notifyRole: 'supervisor',
    });
    expect(made.statusCode, made.body).toBe(201);
    const list = (await d('GET', '/api/v1/escalation-rules')).json().items;
    expect(list).toHaveLength(ESCALATION_DEFAULTS.length + 1);
    // one transaction, so both rows carry the same time: compare as a set
    expect((await auditActions(D, 'escalation_rule')).sort()).toEqual([
      'escalation_rule.create',
      'escalation_rule.seed',
    ]);
  });

  it('gives each plant its own ladder: plant A edits never reach plant B', async () => {
    const seeded = (await b('GET', '/api/v1/escalation-rules')).json().items;
    expect(seeded).toHaveLength(ESCALATION_DEFAULTS.length);
    expect(seeded.every((r: { active: boolean }) => r.active)).toBe(true);
    const mine = (await a('GET', '/api/v1/escalation-rules')).json().items[0];
    expect(
      (await b('PUT', `/api/v1/escalation-rules/${mine.id}`, 'head', { delayMinutes: '5' }))
        .statusCode,
    ).toBe(404);
    expect(await auditActions(B, 'escalation_rule')).toEqual(['escalation_rule.seed']);
  });
});

describe('roster.purge keeps a roster line one year', () => {
  const NOW = new Date('2027-06-15T03:00:00Z');
  const lines: Array<[string, string]> = [
    ['2026-06-14', 'a year and a day old'],
    ['2026-06-15', 'exactly a year (365 days)'],
    ['2026-07-15', 'eleven months'],
    ['2027-06-20', 'next week'],
  ];

  it('purges what is more than a year old, keeps the rest, and only for the plant named', async () => {
    await admin.query('DELETE FROM roster_entry');
    for (const [date] of lines) {
      for (const [tenant, shift, person] of [
        [A, ids.shiftA, ids.personA],
        [B, ids.shiftB, ids.personB],
      ] as const) {
        await admin.query(
          "INSERT INTO roster_entry (tenant_id, date, shift_id, person_id, level) VALUES ($1, $2, $3, $4, 'L1')",
          [tenant, date, shift, person],
        );
      }
    }
    const left = async (tenant: string) =>
      (
        await admin.query(
          'SELECT date::text AS d FROM roster_entry WHERE tenant_id = $1 ORDER BY date',
          [tenant],
        )
      ).rows.map((r) => r.d);

    const first = await runRetentionJob(db.app, 'roster.purge', {
      now: NOW,
      tenantId: A,
      allowFakeClock: true,
    });
    expect(first).toMatchObject({ tenants: 1, affected: 1 });
    expect(await left(A)).toEqual(['2026-06-15', '2026-07-15', '2027-06-20']);
    expect(await left(B)).toHaveLength(4);

    const again = await runRetentionJob(db.app, 'roster.purge', {
      now: NOW,
      tenantId: A,
      allowFakeClock: true,
    });
    expect(again.affected).toBe(0);
    const all = await runRetentionJob(db.app, 'roster.purge', { now: NOW, allowFakeClock: true });
    expect(all.affected).toBe(1);
    expect(await left(B)).toEqual(['2026-06-15', '2026-07-15', '2027-06-20']);
  });

  it('cuts off by the plant date, the same rule the form uses (a plant west of UTC keeps its 365th day)', async () => {
    // 03:00 UTC on 15 June is 23:00 on 14 June in New York: the plant's today is 14 June, so 14 June last year is
    // the oldest line the form accepts and must survive; 13 June is gone.
    await admin.query('DELETE FROM roster_entry WHERE tenant_id = $1', [C]);
    for (const date of ['2026-06-13', '2026-06-14', '2026-06-15']) {
      await admin.query(
        "INSERT INTO roster_entry (tenant_id, date, shift_id, person_id, level) VALUES ($1, $2, $3, $4, 'L1')",
        [C, date, ids.shiftC, ids.personC],
      );
    }
    const result = await runRetentionJob(db.app, 'roster.purge', {
      now: NOW,
      tenantId: C,
      allowFakeClock: true,
    });
    expect(result.affected).toBe(1);
    const left = (
      await admin.query(
        'SELECT date::text AS d FROM roster_entry WHERE tenant_id = $1 ORDER BY date',
        [C],
      )
    ).rows.map((r) => r.d);
    expect(left).toEqual(['2026-06-14', '2026-06-15']);
  });
});
