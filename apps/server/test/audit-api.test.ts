import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { A, B, startPeopleApp, TEMP, type PeopleApp } from './people-harness.js';

/**
 * The audit screen's backend (MILESTONES 20 goal 2): the page an admin and the head read, the CSV only an admin
 * exports, and the filters the screen sends. The writer already exists; this proves the reader.
 */

let t: PeopleApp;
let admin: string;
let head: string;
let bAdmin: string;
let adminLoginId: string;
let n = 0;

interface Row {
  id: string;
  at: string;
  action: string;
  entity: string;
  entityId: string | null;
  actor: { loginId: string; name: string } | null;
  before: unknown;
  after: unknown;
  ip: string | null;
}
interface Page {
  items: Row[];
  nextCursor: string | null;
}

const PAGE = '/api/v1/audit';
const CSV = '/api/v1/audit.csv';

async function page(query = '', token = admin): Promise<Page> {
  const res = await t.call('GET', `${PAGE}${query}`, token);
  expect(res.statusCode, res.body).toBe(200);
  return res.json() as Page;
}

async function person(name: string, extra: object = {}) {
  const res = await t.call('POST', '/api/v1/people', admin, {
    name,
    team: 'maintenance',
    ...extra,
  });
  expect(res.statusCode, res.body).toBe(201);
  return res.json() as { id: string; name: string };
}

async function loginFor(personId: string, username: string): Promise<string> {
  const res = await t.call('POST', '/api/v1/logins', admin, {
    username,
    role: 'technician',
    shared: false,
    personId,
    temporaryPassword: TEMP,
  });
  expect(res.statusCode, res.body).toBe(201);
  return res.json().id as string;
}

/** The body as rows of cells per RFC-4180: quotes dropped, doubled quotes kept, CRLF between rows. */
function parseCsv(body: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < body.length; i += 1) {
    const ch = body[i]!;
    if (quoted && ch === '"' && body[i + 1] === '"') {
      cell += '"';
      i += 1;
    } else if (ch === '"') quoted = !quoted;
    else if (!quoted && ch === ',') {
      row.push(cell);
      cell = '';
    } else if (!quoted && ch === '\r' && body[i + 1] === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      i += 1;
    } else cell += ch;
  }
  return rows;
}

/** An audit line with a known time or address, written straight in: the filter needs rows the clock cannot place. */
async function insertRow(row: {
  action: string;
  entity: string;
  entityId?: string | null;
  loginId?: string | null;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
  at?: string;
  tenant?: string;
}): Promise<void> {
  await t.db.admin.query(
    `INSERT INTO audit_log (tenant_id, login_id, action, entity, entity_id, before, after, ip, at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      row.tenant ?? A,
      row.loginId ?? null,
      row.action,
      row.entity,
      row.entityId ?? null,
      row.before === undefined ? null : JSON.stringify(row.before),
      JSON.stringify(row.after ?? null),
      row.ip ?? null,
      row.at ?? new Date().toISOString(),
    ],
  );
}

const csvBody = async (query = '', token = admin): Promise<string> => {
  const res = await t.call('GET', `${CSV}${query}`, token);
  expect(res.statusCode, res.body).toBe(200);
  return res.body;
};

beforeAll(async () => {
  t = await startPeopleApp();
  admin = await t.signIn('admin');
  head = await t.signIn('head');
  bAdmin = await t.signIn('b-admin', 'plant-two.localhost');
  adminLoginId = (await t.call('GET', '/api/v1/auth/me', admin)).json().user.id as string;
}, 120_000);

afterAll(() => t.stop());

describe('who may read the trail', () => {
  it('lets the admin and the head read the page, and only the admin export it', async () => {
    expect((await t.call('GET', PAGE, head)).statusCode).toBe(200);
    expect((await t.call('GET', PAGE, admin)).statusCode).toBe(200);
    const exported = await t.call('GET', CSV, admin);
    expect(exported.statusCode).toBe(200);
    expect(String(exported.headers['content-type'])).toContain('text/csv');
  });

  it('keeps the head out of the export', async () => {
    const res = await t.call('GET', CSV, head);
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('forbidden');
  });

  it.each(['operator', 'technician', 'supervisor', 'plant_head', 'board'])(
    'keeps %s out of the page and the export',
    async (role) => {
      const token = await t.signIn(role);
      expect((await t.call('GET', PAGE, token)).statusCode, 'page').toBe(403);
      expect((await t.call('GET', CSV, token)).statusCode, 'export').toBe(403);
    },
  );

  it('answers 401 without a sign-in', async () => {
    expect((await t.call('GET', PAGE)).statusCode).toBe(401);
    expect((await t.call('GET', CSV)).statusCode).toBe(401);
  });
});

describe('one row of the trail', () => {
  it('carries the actor, the action, the old and new values, and the address', async () => {
    const made = await person('Audit Shape');
    const { items } = await page('?area=person&limit=1');
    const row = items[0]!;
    expect(Object.keys(row).sort()).toEqual([
      'action',
      'actor',
      'after',
      'at',
      'before',
      'entity',
      'entityId',
      'id',
      'ip',
    ]);
    expect(row.action).toBe('person.create');
    expect(row.entity).toBe('person');
    expect(row.entityId).toBe(made.id);
    expect(row.actor).toEqual({ loginId: adminLoginId, name: 'Asha Admin' });
    expect(row.before).toBeNull();
    expect(row.after).toMatchObject({ name: 'Audit Shape', active: true });
    // The writer records the address on support lines only today; this line has none.
    expect(row.ip === null || typeof row.ip === 'string').toBe(true);
    expect(new Date(row.at).toISOString()).toBe(row.at);
  });

  it('names no actor on a support-grant line, which has no login', async () => {
    await insertRow({
      action: 'support.request',
      entity: 'route',
      after: { method: 'GET', route: '/api/v1/people' },
      ip: '127.0.0.1',
    });
    const { items } = await page('?area=route&limit=1');
    expect(items[0]?.action).toBe('support.request');
    expect(items[0]?.actor).toBeNull();
  });
});

describe('the filters the screen sends', () => {
  it('shows one area only', async () => {
    const { items } = await page('?area=person&limit=200');
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((row) => row.entity === 'person')).toBe(true);
  });

  it('names the field for an unknown filter value', async () => {
    const cases: [string, string][] = [
      ['?area=people', 'area'],
      ['?from=2026-02-31', 'from'],
      ['?to=17-11-2026', 'to'],
      ['?from=2026-11-19&to=2026-11-17', 'from'],
      ['?personId=nope', 'personId'],
      ['?limit=0', 'limit'],
      ['?limit=201', 'limit'],
      ['?area=person&foo=1', 'foo'],
      ['?cursor=nope', 'cursor'],
    ];
    for (const [query, field] of cases) {
      const res = await t.call('GET', `${PAGE}${query}`, admin);
      expect(res.statusCode, query).toBe(422);
      expect(res.json().error.field, query).toBe(field);
    }
  });

  it('narrows to one person: what is about them and what they did', async () => {
    const made = await person('Filter Person');
    const about = await page(`?personId=${made.id}&limit=200`);
    expect(
      about.items.some((row) => row.action === 'person.create' && row.entityId === made.id),
    ).toBe(true);
    expect(
      about.items.every(
        (row) =>
          (row.entity === 'person' && row.entityId === made.id) ||
          row.actor?.loginId === adminLoginId,
      ),
    ).toBe(true);
    const allPeople = (await t.call('GET', '/api/v1/people', admin)).json().items as {
      id: string;
      name: string;
    }[];
    const mePerson = allPeople.find((p) => p.name === 'Asha Admin');
    expect(mePerson).toBeDefined();
    const mine = await page(`?personId=${mePerson!.id}&limit=200`);
    expect(mine.items.some((row) => row.action === 'person.create')).toBe(true);
  });

  it('reads from and to as plant days, not UTC days', async () => {
    await insertRow({
      action: 'setting.update',
      entity: 'setting',
      after: { key: 'day-17' },
      at: '2026-11-17T09:00:00Z',
    });
    await insertRow({
      action: 'setting.update',
      entity: 'setting',
      after: { key: 'day-18' },
      at: '2026-11-17T20:00:00Z',
    });
    const on17 = await page('?area=setting&from=2026-11-17&to=2026-11-17&limit=200');
    const on18 = await page('?area=setting&from=2026-11-18&to=2026-11-18&limit=200');
    expect(on17.items.map((row) => (row.after as { key: string }).key)).toEqual(['day-17']);
    expect(on18.items.map((row) => (row.after as { key: string }).key)).toEqual(['day-18']);
  });

  it('pages newest first without repeating a row', async () => {
    for (let i = 0; i < 3; i++)
      await insertRow({
        action: 'segment.update',
        entity: 'segment',
        after: { i },
        at: `2026-10-0${i + 1}T10:00:00Z`,
      });
    const first = await page('?area=segment&limit=2');
    expect(first.items).toHaveLength(2);
    expect(first.items[0]!.id).not.toBe(first.items[1]!.id);
    expect(new Date(first.items[0]!.at) > new Date(first.items[1]!.at)).toBe(true);
    expect(first.nextCursor).toBeTruthy();
    const second = await page(
      `?area=segment&limit=2&cursor=${encodeURIComponent(first.nextCursor!)}`,
    );
    expect(second.items).toHaveLength(1);
    expect(second.nextCursor).toBeNull();
    const ids = new Set([...first.items, ...second.items].map((row) => row.id));
    expect(ids.size).toBe(3);
  });
});

describe('the export', () => {
  it('starts with the locked header and keeps RFC-4180 quoting', async () => {
    const made = await person('Csv Person');
    const body = await csvBody(`?personId=${made.id}`);
    expect(body.split('\r\n')[0]).toBe('at,action,entity,entityId,actor,ip,before,after');
    expect(body).toContain('person.create');
    expect(body).toContain('Csv Person');
    await insertRow({
      action: 'machine_group.update',
      entity: 'machine_group',
      before: { note: 'a,b' },
      after: { note: 'He said "hi"' },
      at: '2026-11-10T10:00:00Z',
    });
    const quoted = await csvBody('?area=machine_group');
    const cell = (value: unknown) => `"${JSON.stringify(value).replace(/"/g, '""')}"`;
    expect(quoted).toContain(cell({ note: 'a,b' }));
    expect(quoted).toContain(cell({ note: 'He said "hi"' }));
  });

  it('neutralises a formula in every cell and keeps RFC-4180 quoting', async () => {
    const evil = await person("=cmd|' /C calc'!A0");
    const evilLogin = await loginFor(evil.id, `formula-${++n}`);
    await insertRow({
      action: 'person.create',
      entity: 'person',
      entityId: evil.id,
      loginId: evilLogin,
      after: { reason: '@SUM(1+1)' },
      ip: '10.0.0.1',
      at: '2026-11-12T09:30:00Z',
    });
    await insertRow({
      action: '@SUM(1+1)',
      entity: 'person',
      after: { note: 'plus' },
      ip: '-1+1',
      at: '2026-11-12T09:31:00Z',
    });
    await insertRow({
      action: '\t=1+1',
      entity: 'person',
      after: { note: 'tab' },
      ip: '\r=1+1',
      at: '2026-11-12T09:32:00Z',
    });
    await insertRow({
      action: 'person.create',
      entity: 'person',
      loginId: adminLoginId,
      after: { note: 'plain' },
      ip: '10.0.0.2 "quoted"',
      at: '2026-11-12T09:33:00Z',
    });
    const body = await csvBody('?area=person');
    const rows = parseCsv(body);
    expect(rows[0]).toEqual([
      'at',
      'action',
      'entity',
      'entityId',
      'actor',
      'ip',
      'before',
      'after',
    ]);
    const cells = rows.slice(1);
    // No cell a spreadsheet would run on open: every one starts with ordinary text.
    for (const row of cells)
      for (const cell of row) expect(cell, JSON.stringify(cell)).not.toMatch(/^[=+\-@\t\r]/);
    const byActor = (actor: string) => cells.find((row) => row[4] === actor)!;
    expect(byActor("'=cmd|' /C calc'!A0")).toEqual([
      '2026-11-12T09:30:00.000Z',
      'person.create',
      'person',
      evil.id,
      "'=cmd|' /C calc'!A0",
      '10.0.0.1',
      'null',
      '{"reason":"@SUM(1+1)"}',
    ]);
    const byIp = (ip: string) => cells.find((row) => row[5] === ip)!;
    expect(byIp("'-1+1")[1]).toBe("'@SUM(1+1)");
    expect(byIp('10.0.0.2 "quoted"')[5]).toBe('10.0.0.2 "quoted"');
    expect(body).toContain('"10.0.0.2 ""quoted"""');
    const tabbed = cells.find((row) => row[1] === "'\t=1+1")!;
    expect(tabbed[5]).toBe("'\r=1+1");
    expect(body).toContain(`"'\r=1+1"`);
    // Normal cells stay as they were, and the plain admin line reads unchanged.
    const plain = byIp('10.0.0.2 "quoted"');
    expect(plain[1]).toBe('person.create');
    expect(plain[4]).toBe('Asha Admin');
    expect(plain[7]).toBe('{"note":"plain"}');
  });

  it('keeps to the filters it is given', async () => {
    const body = await csvBody('?area=route');
    expect(body).toContain('support.request');
    expect(body).not.toContain('person.create');
    const bad = await t.call('GET', `${CSV}?cursor=x`, admin);
    expect(bad.statusCode).toBe(422);
    expect(bad.json().error.field).toBe('cursor');
  });

  it('caps the export and says so in the body', async () => {
    await t.db.admin.query(
      `INSERT INTO audit_log (tenant_id, action, entity, before, after, at)
       SELECT $1, 'shift.update', 'shift', '{}', '{"bulk":true}', now() - (g || ' seconds')::interval
       FROM generate_series(1, 50001) g`,
      [A],
    );
    const body = await csvBody('?area=shift');
    expect(body.match(/shift\.update/g)?.length).toBe(50000);
    expect(body).toContain('Export capped at the newest 50000 rows');
  }, 60_000);
});

describe('one customer never sees another', () => {
  it('shows a plant only its own trail, on the page and in the export', async () => {
    const mine = await person('Tenant A Person');
    const other = await t.callB('GET', PAGE, bAdmin);
    expect(other.statusCode).toBe(200);
    expect((other.json() as Page).items.some((row) => row.entityId === mine.id)).toBe(false);
    const exported = await t.callB('GET', CSV, bAdmin);
    expect(exported.statusCode, exported.body).toBe(200);
    expect(exported.body).not.toContain('Tenant A Person');
    const theirs = await t.callB('POST', '/api/v1/people', bAdmin, {
      name: `Tenant B ${++n}`,
      team: 'maintenance',
    });
    expect(theirs.statusCode, theirs.body).toBe(201);
    const theirPage = (await t.callB('GET', PAGE, bAdmin)).json() as Page;
    expect(theirPage.items.some((row) => row.entityId === theirs.json().id)).toBe(true);
    expect(
      (await page('?area=person&limit=200')).items.some((row) => row.entityId === theirs.json().id),
    ).toBe(false);
  });

  it('keeps a plant day inside the customer that wrote it', async () => {
    await insertRow({
      action: 'tenant.update',
      entity: 'tenant',
      tenant: B,
      at: '2026-11-17T20:00:00Z',
    });
    const other = (
      await t.callB('GET', `${PAGE}?area=tenant&from=2026-11-18&to=2026-11-18`, bAdmin)
    ).json() as Page;
    expect(other.items).toHaveLength(1);
    const minePage = await page('?area=tenant&from=2026-11-18&to=2026-11-18');
    expect(minePage.items).toHaveLength(0);
  });
});
