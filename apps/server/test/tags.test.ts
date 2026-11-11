import { hash } from '@node-rs/argon2';
import type { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { startTestDb, type TestDb } from './harness.js';

const A = '10000000-0000-0000-0000-000000000001';
const B = '20000000-0000-0000-0000-000000000001';
const A_PERSON = '10000000-0000-0000-0000-000000000021';
const B_PERSON = '20000000-0000-0000-0000-000000000021';
const A_LOGIN = '10000000-0000-0000-0000-000000000023';
const B_LOGIN = '20000000-0000-0000-0000-000000000023';
const A_TICKET = '10000000-0000-0000-0000-000000000041';
const B_TICKET = '20000000-0000-0000-0000-000000000041';
const A_MAINT = '10000000-0000-0000-0000-000000000051';
const A_WORK = '10000000-0000-0000-0000-000000000052';
const A_CATEGORY = '10000000-0000-0000-0000-000000000053';
const A_INACTIVE = '10000000-0000-0000-0000-000000000054';
const A_WAIT_REASON = '10000000-0000-0000-0000-000000000055';
const A_MAINT_SECOND = '10000000-0000-0000-0000-000000000056';
const A_WORK_SECOND = '10000000-0000-0000-0000-000000000057';
const B_MAINT = '20000000-0000-0000-0000-000000000051';
const PASSWORD = 'correct-horse-battery';
const ROLE_LOGINS = [
  { role: 'operator', id: '10000000-0000-0000-0000-000000000061' },
  { role: 'supervisor', id: '10000000-0000-0000-0000-000000000062' },
  { role: 'head', id: '10000000-0000-0000-0000-000000000063' },
  { role: 'plant_head', id: '10000000-0000-0000-0000-000000000064' },
  { role: 'admin', id: '10000000-0000-0000-0000-000000000065' },
  { role: 'board', id: '10000000-0000-0000-0000-000000000066' },
] as const;

type App = Awaited<ReturnType<typeof buildApp>>;
type Res = Awaited<ReturnType<App['inject']>>;

let db: TestDb;
let admin: Pool;
let app: App;

function req(
  ...args: ['GET' | 'POST' | 'DELETE', string, string?, object?, string?, string?]
): Promise<Res> {
  const [method, url, token, payload, key, host = 'cosmos.localhost'] = args;
  return app.inject({
    method,
    url,
    headers: {
      host,
      ...(payload ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(key ? { 'idempotency-key': key } : {}),
    },
    ...(payload ? { payload } : {}),
  });
}

beforeAll(async () => {
  db = await startTestDb();
  admin = db.admin;
  const passwordHash = await hash(PASSWORD, {
    algorithm: 2,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
  await admin.query(
    "INSERT INTO tenant (id, slug, name) VALUES ($1, 'cosmos', 'Cosmos'), ($2, 'plant-two', 'Plant Two')",
    [A, B],
  );
  await admin.query(
    `INSERT INTO person (id, tenant_id, name, team, title) VALUES
     ($1, $3, 'Tech A', 'maintenance', 'Technician'),
     ($2, $4, 'Tech B', 'maintenance', 'Technician')`,
    [A_PERSON, B_PERSON, A, B],
  );
  await admin.query(
    `INSERT INTO login (id, tenant_id, person_id, username, password_hash, role, shared) VALUES
     ($1, $3, $5, 'tech', $7, 'technician', false),
     ($2, $4, $6, 'tech', $7, 'technician', false)`,
    [A_LOGIN, B_LOGIN, A, B, A_PERSON, B_PERSON, passwordHash],
  );
  for (const login of ROLE_LOGINS) {
    await admin.query(
      `INSERT INTO login (id, tenant_id, person_id, username, password_hash, role, shared)
       VALUES ($1, $2, $3, $4, $5, $6, false)`,
      [login.id, A, A_PERSON, login.role, passwordHash, login.role],
    );
  }
  await admin.query(
    `INSERT INTO ticket (id, tenant_id, ref, kind, status, problem, reported_at) VALUES
     ($1, $3, 'BD-0001', 'stopped', 'open', 'Spindle alarm', now()),
     ($2, $4, 'BD-0001', 'stopped', 'open', 'Coolant leak', now())`,
    [A_TICKET, B_TICKET, A, B],
  );
  await admin.query(
    `INSERT INTO list_item (id, tenant_id, list, code, label, sort, active) VALUES
     ($1, $6, 'maint_code', 'M', 'Mechanical', 2, true),
     ($2, $6, 'work_type', 'preventive', 'Preventive', 1, true),
     ($3, $6, 'breakdown_category', 'E', 'Electrical', 1, true),
     ($4, $6, 'maint_code', 'OLD', 'Retired', 0, false),
     ($5, $6, 'wait_reason', 'spare', 'Spare part', 1, true),
     ($7, $8, 'maint_code', 'B-ONLY', 'Plant two only', 1, true),
     ($9, $6, 'maint_code', 'A', 'A code', 2, true),
     ($10, $6, 'work_type', 'corrective', 'Corrective', 1, true)`,
    [
      A_MAINT,
      A_WORK,
      A_CATEGORY,
      A_INACTIVE,
      A_WAIT_REASON,
      A,
      B_MAINT,
      B,
      A_MAINT_SECOND,
      A_WORK_SECOND,
    ],
  );
  app = await buildApp({ pool: db.app, logger: false, rateLimitMax: 100000 });
}, 120_000);

afterAll(async () => {
  await app.close();
  await db.stop();
});

beforeEach(async () => {
  await admin.query('DELETE FROM ticket_tag');
  await admin.query("DELETE FROM ticket_event WHERE type IN ('tag_add', 'tag_remove')");
  await admin.query('DELETE FROM command_idempotency WHERE command IN ($1, $2)', [
    'tag:add',
    'tag:remove',
  ]);
  await admin.query('UPDATE ticket SET last_event_seq = 0 WHERE id = ANY($1::uuid[])', [
    [A_TICKET, B_TICKET],
  ]);
});

async function login(host = 'cosmos.localhost', username = 'tech'): Promise<string> {
  const res = await req(
    'POST',
    '/api/v1/auth/login',
    undefined,
    { username, password: PASSWORD },
    undefined,
    host,
  );
  expect(res.statusCode).toBe(200);
  return res.json().token as string;
}

describe('tag catalogue', () => {
  it('isolates tenant values, filters inactive items and orders categories', async () => {
    const tokenA = await login();
    const all = await req('GET', '/api/v1/tags', tokenA);
    expect(all.statusCode).toBe(200);
    expect(all.json().tags.map((tag: { id: string }) => tag.id)).toEqual([
      A_CATEGORY,
      A_MAINT_SECOND,
      A_MAINT,
      A_WORK_SECOND,
      A_WORK,
    ]);
    expect(all.json().tags.map((tag: { id: string }) => tag.id)).not.toContain(B_MAINT);

    const category = await req('GET', '/api/v1/tags/maint_code', tokenA);
    expect(category.json().tags.map((tag: { id: string }) => tag.id)).toEqual([
      A_MAINT_SECOND,
      A_MAINT,
    ]);
    expect((await req('GET', '/api/v1/tags/nope', tokenA)).statusCode).toBe(404);

    const tokenB = await login('plant-two.localhost');
    const other = await req(
      'GET',
      '/api/v1/tags',
      tokenB,
      undefined,
      undefined,
      'plant-two.localhost',
    );
    expect(other.json().tags.map((tag: { id: string }) => tag.id)).toEqual([B_MAINT]);
  });

  it('requires authentication', async () => {
    expect((await req('GET', '/api/v1/tags')).statusCode).toBe(401);
  });
});

describe('ticket tag CRUD', () => {
  it('persists an applied tag with actor and time, then removes it', async () => {
    const token = await login();
    expect((await req('GET', `/api/v1/tickets/${A_TICKET}/tags`, token)).json()).toEqual({
      applied: [],
      tags: [],
    });

    const added = await req(
      'POST',
      `/api/v1/tickets/${A_TICKET}/tags`,
      token,
      { tagId: A_MAINT },
      'crud-add',
    );
    expect(added.statusCode).toBe(200);
    expect(added.json().tags.map((tag: { id: string }) => tag.id)).toEqual([A_MAINT]);
    expect(added.json().applied[0]).toMatchObject({
      tagId: A_MAINT,
      appliedBy: A_PERSON,
      appliedByLogin: A_LOGIN,
    });
    expect(Number.isNaN(Date.parse(added.json().applied[0].appliedAt))).toBe(false);

    const reread = await req('GET', `/api/v1/tickets/${A_TICKET}/tags`, token);
    expect(reread.json()).toEqual(added.json());

    const removed = await req(
      'DELETE',
      `/api/v1/tickets/${A_TICKET}/tags/${A_MAINT}`,
      token,
      undefined,
      'crud-remove',
    );
    expect(removed.statusCode).toBe(200);
    expect(removed.json()).toEqual({ applied: [], tags: [] });
  });
});

describe('ticket tag validation', () => {
  it('rejects bad input and missing keys without writes', async () => {
    const token = await login();
    const url = `/api/v1/tickets/${A_TICKET}/tags`;
    const unknown = '30000000-0000-0000-0000-000000000099';
    const cases = [
      await req('POST', url, token, { tagId: A_MAINT }),
      await req('DELETE', `${url}/${A_MAINT}`, token),
      await req('POST', url, token, {}, 'validation-missing'),
      await req('POST', url, token, { tagId: 'not-a-uuid' }, 'validation-uuid'),
      await req('POST', url, token, { tagId: unknown }, 'validation-unknown'),
      await req('POST', url, token, { tagId: A_INACTIVE }, 'validation-inactive'),
      await req('POST', url, token, { tagId: A_WAIT_REASON }, 'validation-list'),
      await req('DELETE', `${url}/not-a-uuid`, token, undefined, 'validation-delete'),
    ];
    for (const response of cases) expect(response.statusCode).toBe(422);
    expect((await admin.query('SELECT count(*)::int AS n FROM ticket_tag')).rows[0].n).toBe(0);
    expect(
      (await admin.query("SELECT count(*)::int AS n FROM ticket_event WHERE type LIKE 'tag_%'"))
        .rows[0].n,
    ).toBe(0);
    expect(
      (
        await admin.query(
          "SELECT count(*)::int AS n FROM command_idempotency WHERE command IN ('tag:add', 'tag:remove')",
        )
      ).rows[0].n,
    ).toBe(0);
  });

  it('returns 404 rather than a database error for malformed ticket ids', async () => {
    const token = await login();
    const url = '/api/v1/tickets/not-a-uuid/tags';
    expect((await req('GET', url, token)).statusCode).toBe(404);
    expect((await req('POST', url, token, { tagId: A_MAINT }, 'malformed-add')).statusCode).toBe(
      404,
    );
    expect(
      (await req('DELETE', `${url}/${A_MAINT}`, token, undefined, 'malformed-delete')).statusCode,
    ).toBe(404);
  });
});

describe('ticket tag permissions', () => {
  it('allows every canWork role and rejects other roles without mutation', async () => {
    for (const role of ['technician', 'supervisor', 'head', 'admin']) {
      const token = await login('cosmos.localhost', role === 'technician' ? 'tech' : role);
      const added = await req(
        'POST',
        `/api/v1/tickets/${A_TICKET}/tags`,
        token,
        { tagId: A_WORK },
        `${role}-add`,
      );
      expect(added.statusCode, role).toBe(200);
      const removed = await req(
        'DELETE',
        `/api/v1/tickets/${A_TICKET}/tags/${A_WORK}`,
        token,
        undefined,
        `${role}-remove`,
      );
      expect(removed.statusCode, role).toBe(200);
    }

    for (const role of ['operator', 'plant_head', 'board']) {
      await admin.query(
        `INSERT INTO ticket_tag (tenant_id, ticket_id, item_id, applied_by_login_id, applied_by_person_id)
         VALUES ($1, $2, $3, $4, $5)`,
        [A, A_TICKET, A_MAINT, A_LOGIN, A_PERSON],
      );
      const token = await login('cosmos.localhost', role);
      const before = (
        await admin.query(
          `SELECT
             (SELECT count(*) FROM ticket_event WHERE type LIKE 'tag_%')::int AS events,
             (SELECT count(*) FROM command_idempotency WHERE command IN ('tag:add', 'tag:remove'))::int AS idem`,
        )
      ).rows[0];
      const added = await req(
        'POST',
        `/api/v1/tickets/${A_TICKET}/tags`,
        token,
        { tagId: A_WORK },
        `${role}-add`,
      );
      expect(added.statusCode, role).toBe(403);
      const removed = await req(
        'DELETE',
        `/api/v1/tickets/${A_TICKET}/tags/${A_MAINT}`,
        token,
        undefined,
        `${role}-remove`,
      );
      expect(removed.statusCode, role).toBe(403);
      expect((await admin.query('SELECT count(*)::int AS n FROM ticket_tag')).rows[0].n).toBe(1);
      const after = (
        await admin.query(
          `SELECT
             (SELECT count(*) FROM ticket_event WHERE type LIKE 'tag_%')::int AS events,
             (SELECT count(*) FROM command_idempotency WHERE command IN ('tag:add', 'tag:remove'))::int AS idem`,
        )
      ).rows[0];
      expect(after).toEqual(before);
      await admin.query('DELETE FROM ticket_tag');
    }
  });
});

describe('ticket tag replay', () => {
  it('returns the first stored response and rejects key misuse', async () => {
    const token = await login();
    const url = `/api/v1/tickets/${A_TICKET}/tags`;
    const first = await req('POST', url, token, { tagId: A_MAINT }, 'replay-add');
    expect(first.statusCode).toBe(200);
    expect(first.json().applied).toHaveLength(1);

    const second = await req('POST', url, token, { tagId: A_WORK }, 'other-add');
    expect(second.json().applied).toHaveLength(2);
    const replay = await req('POST', url, token, { tagId: A_MAINT }, 'replay-add');
    expect(replay.statusCode).toBe(200);
    expect(replay.json()).toEqual(first.json());

    const misuse = await req('POST', url, token, { tagId: A_CATEGORY }, 'replay-add');
    expect(misuse.statusCode).toBe(422);
    const noOp = await req('POST', url, token, { tagId: A_MAINT }, 'new-key-same-item');
    expect(noOp.statusCode).toBe(200);
    expect(noOp.json().applied).toHaveLength(2);
    expect((await admin.query('SELECT count(*)::int AS n FROM ticket_tag')).rows[0].n).toBe(2);
    expect(
      (await admin.query("SELECT count(*)::int AS n FROM ticket_event WHERE type = 'tag_add'"))
        .rows[0].n,
    ).toBe(2);
    expect(
      (
        await admin.query(
          "SELECT count(*)::int AS n FROM command_idempotency WHERE command = 'tag:add'",
        )
      ).rows[0].n,
    ).toBe(3);
  });
});

describe('ticket tag audit', () => {
  it('records effective add/remove events with actor and label, but no no-op events', async () => {
    const token = await login();
    const url = `/api/v1/tickets/${A_TICKET}/tags`;
    await req('POST', url, token, { tagId: A_MAINT }, 'audit-add');
    await req('POST', url, token, { tagId: A_MAINT }, 'audit-noop-add');
    await req('DELETE', `${url}/${A_MAINT}`, token, undefined, 'audit-remove');
    await req('DELETE', `${url}/${A_MAINT}`, token, undefined, 'audit-noop-remove');

    const detail = await req('GET', `/api/v1/tickets/${A_TICKET}`, token);
    const events = detail
      .json()
      .events.filter((event: { type: string }) => event.type.startsWith('tag_'));
    expect(events.map((event: { type: string }) => event.type)).toEqual(['tag_add', 'tag_remove']);
    expect(events.map((event: { seq: number }) => event.seq)).toEqual([1, 2]);
    expect(events.map((event: { text: string }) => event.text)).toEqual([
      'Tag added: Mechanical',
      'Tag removed: Mechanical',
    ]);
    for (const event of events) {
      expect(event.actingPersonId).toBe(A_PERSON);
      expect(event.loginId).toBe(A_LOGIN);
      expect(Number.isNaN(Date.parse(event.at))).toBe(false);
    }
    const stored = await admin.query(
      "SELECT payload FROM ticket_event WHERE ticket_id = $1 AND type LIKE 'tag_%' ORDER BY seq",
      [A_TICKET],
    );
    for (const row of stored.rows) {
      expect(row.payload).toMatchObject({ tagId: A_MAINT, code: 'M', category: 'maint_code' });
    }
  });
});

describe('concurrent ticket tag writers', () => {
  it('keeps concurrent different adds and consecutive event sequences', async () => {
    const token = await login();
    const url = `/api/v1/tickets/${A_TICKET}/tags`;
    const responses = await Promise.all([
      req('POST', url, token, { tagId: A_MAINT }, 'concurrent-maint'),
      req('POST', url, token, { tagId: A_WORK }, 'concurrent-work'),
    ]);
    for (const response of responses) expect(response.statusCode).toBe(200);
    const current = await req('GET', url, token);
    expect(
      current
        .json()
        .applied.map((tag: { tagId: string }) => tag.tagId)
        .sort(),
    ).toEqual([A_MAINT, A_WORK].sort());
    const events = await admin.query(
      "SELECT seq FROM ticket_event WHERE ticket_id = $1 AND type = 'tag_add' ORDER BY seq",
      [A_TICKET],
    );
    expect(events.rows.map((row) => row.seq)).toEqual([1, 2]);
  });

  it('does not lose an add racing a different delete', async () => {
    const token = await login();
    const url = `/api/v1/tickets/${A_TICKET}/tags`;
    await req('POST', url, token, { tagId: A_CATEGORY }, 'concurrent-initial');
    const responses = await Promise.all([
      req('DELETE', `${url}/${A_CATEGORY}`, token, undefined, 'concurrent-delete'),
      req('POST', url, token, { tagId: A_MAINT }, 'concurrent-add'),
    ]);
    for (const response of responses) expect(response.statusCode).toBe(200);
    const current = await req('GET', url, token);
    expect(current.json().applied.map((tag: { tagId: string }) => tag.tagId)).toEqual([A_MAINT]);
    const events = await admin.query(
      "SELECT seq, type FROM ticket_event WHERE ticket_id = $1 AND type LIKE 'tag_%' ORDER BY seq",
      [A_TICKET],
    );
    expect(events.rows.map((row) => row.seq)).toEqual([1, 2, 3]);
    expect(events.rows.map((row) => row.type).sort()).toEqual(['tag_add', 'tag_add', 'tag_remove']);
  });

  it('leaves one row and one event for concurrent same-item adds', async () => {
    const token = await login();
    const url = `/api/v1/tickets/${A_TICKET}/tags`;
    const responses = await Promise.all([
      req('POST', url, token, { tagId: A_WORK }, 'concurrent-same-a'),
      req('POST', url, token, { tagId: A_WORK }, 'concurrent-same-b'),
    ]);
    for (const response of responses) expect(response.statusCode).toBe(200);
    expect((await admin.query('SELECT count(*)::int AS n FROM ticket_tag')).rows[0].n).toBe(1);
    expect(
      (await admin.query("SELECT count(*)::int AS n FROM ticket_event WHERE type = 'tag_add'"))
        .rows[0].n,
    ).toBe(1);
  });
});

describe('cross-tenant ticket tags', () => {
  it('returns 404 for every other-ticket mutation and leaves tenant B unchanged', async () => {
    const tokenB = await login('plant-two.localhost');
    const urlB = `/api/v1/tickets/${B_TICKET}/tags`;
    const added = await req(
      'POST',
      urlB,
      tokenB,
      { tagId: B_MAINT },
      'tenant-b-add',
      'plant-two.localhost',
    );
    expect(added.statusCode).toBe(200);

    const tokenA = await login();
    expect((await req('GET', urlB, tokenA)).statusCode).toBe(404);
    expect((await req('POST', urlB, tokenA, { tagId: B_MAINT }, 'tenant-a-add')).statusCode).toBe(
      404,
    );
    expect(
      (await req('DELETE', `${urlB}/${B_MAINT}`, tokenA, undefined, 'tenant-a-delete')).statusCode,
    ).toBe(404);
    expect(
      (
        await req(
          'POST',
          `/api/v1/tickets/${A_TICKET}/tags`,
          tokenA,
          { tagId: B_MAINT },
          'tenant-a-item',
        )
      ).statusCode,
    ).toBe(422);

    const currentB = await req('GET', urlB, tokenB, undefined, undefined, 'plant-two.localhost');
    expect(currentB.json().applied.map((tag: { tagId: string }) => tag.tagId)).toEqual([B_MAINT]);
  });
});

describe('ticket tag cascade', () => {
  it('removes assignments when their ticket is deleted', async () => {
    const token = await login();
    const temporary = '10000000-0000-0000-0000-000000000099';
    await admin.query(
      "INSERT INTO ticket (id, tenant_id, ref, kind, status, problem, reported_at) VALUES ($1, $2, 'BD-0099', 'stopped', 'open', 'Temporary', now())",
      [temporary, A],
    );
    const added = await req(
      'POST',
      `/api/v1/tickets/${temporary}/tags`,
      token,
      { tagId: A_MAINT },
      'cascade-add',
    );
    expect(added.statusCode).toBe(200);
    await admin.query('DELETE FROM ticket WHERE id = $1', [temporary]);
    expect(
      (
        await admin.query('SELECT count(*)::int AS n FROM ticket_tag WHERE ticket_id = $1', [
          temporary,
        ])
      ).rows[0].n,
    ).toBe(0);
  });
});
