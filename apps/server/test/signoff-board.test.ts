import { randomUUID } from 'node:crypto';
import { hash } from '@node-rs/argon2';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../src/app.js';
import { qrSvg } from '../src/modules/reports/pdf.js';
import { startTestDb, type TestDb } from './harness.js';

const A = '35000000-0000-4000-8000-00000000000a';
const B = '35000000-0000-4000-8000-00000000000b';
const MACHINE_A = '35000000-0000-4000-8000-000000000101';
const MACHINE_A2 = '35000000-0000-4000-8000-000000000102';
const MACHINE_B = '35000000-0000-4000-8000-000000000201';
const id = (n: number) => `35000000-0000-4000-8000-0000000003${n.toString(16).padStart(2, '0')}`;
const [REPORTER, LEAD, SUPER, BOB, BSUP, TV] = [id(1), id(2), id(3), id(4), id(5), id(6)];
const MACHINE_A3 = '35000000-0000-4000-8000-000000000103';
const MACHINE_HIDDEN = '35000000-0000-4000-8000-000000000104';
const SEGMENT_A = '35000000-0000-4000-8000-000000000401';
const GROUP_HIDDEN = '35000000-0000-4000-8000-000000000402';
const PASSWORD = 'correct-horse-battery';
const HOST_A = 'sb-a.localhost';
const HOST_B = 'sb-b.localhost';
const BASE_DOMAIN = 'plants.example.test';

type App = Awaited<ReturnType<typeof buildApp>>;
let db: TestDb;
let app: App;
const tokens: Record<string, string> = {};

interface Req {
  host: string;
  method: 'GET' | 'POST';
  url: string;
  token: string;
  payload?: object;
  headers?: Record<string, string>;
}

function send({ host, method, url, token, payload, headers = {} }: Req) {
  return app.inject({
    method,
    url,
    headers: {
      host,
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      'idempotency-key': randomUUID(),
      ...headers,
    },
    ...(payload ? { payload } : {}),
  });
}

const asA = (method: Req['method'], url: string, token: string, payload?: object) =>
  send({ host: HOST_A, method, url, token, payload });
const asB = (method: Req['method'], url: string, token: string, payload?: object) =>
  send({ host: HOST_B, method, url, token, payload });

async function login(host: string, username: string): Promise<string> {
  const res = await send({
    host,
    method: 'POST',
    url: '/api/v1/auth/login',
    token: '',
    payload: { username, password: PASSWORD },
  });
  expect(res.statusCode, username).toBe(200);
  return res.json().token as string;
}

beforeAll(async () => {
  db = await startTestDb();
  const admin = db.admin;
  const passwordHash = await hash(PASSWORD, {
    algorithm: 2,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
  await admin.query(
    "INSERT INTO tenant (id, slug, name) VALUES ($1, 'sb-a', 'Signoff A'), ($2, 'sb-b', 'Signoff B')",
    [A, B],
  );
  await admin.query(
    `INSERT INTO machine (id, tenant_id, code, criticality, cell) VALUES
      ($1, $5, 'VC-SB', 'A', 'C1'), ($2, $5, 'VC-SB2', 'A', 'C2'), ($3, $6, 'VC-B', 'A', 'C1'),
      ($4, $5, 'VC-SB3', 'A', 'C1')`,
    [MACHINE_A, MACHINE_A2, MACHINE_B, MACHINE_A3, A, B],
  );
  await admin.query(
    `INSERT INTO person (id, tenant_id, name, team, kind) VALUES
      ($2, $1, 'Rina', 'production', 'production'), ($3, $1, 'Lal', 'maintenance', 'staff'),
      ($4, $1, 'Sana', 'maintenance', 'staff'), ($6, $5, 'Bob', 'production', 'production'),
      ($7, $5, 'Bea', 'maintenance', 'staff'), ($8, $1, 'Board', 'maintenance', 'staff')`,
    [A, REPORTER, LEAD, SUPER, B, BOB, BSUP, TV],
  );
  await admin.query(
    `INSERT INTO login (tenant_id, person_id, username, password_hash, role, shared, cell) VALUES
      ($1, $2, 'rina', $5, 'operator', false, 'C1'), ($1, $3, 'lal', $5, 'technician', false, NULL),
      ($1, $4, 'sana', $5, 'supervisor', false, NULL), ($1, $9, 'tv', $5, 'board', false, NULL),
      ($6, $7, 'bob', $5, 'operator', false, 'C1'), ($6, $8, 'bea', $5, 'supervisor', false, NULL)`,
    [A, REPORTER, LEAD, SUPER, passwordHash, B, BOB, BSUP, TV],
  );
  await admin.query(
    "INSERT INTO ref_counter (tenant_id, prefix, next_value) VALUES ($1, 'BD', 1), ($2, 'BD', 1)",
    [A, B],
  );
  await admin.query(
    `INSERT INTO sla_policy (tenant_id, severity, ack_minutes, restore_minutes, handback_minutes) VALUES
      ($1, 'S1', 60, 240, 60), ($1, 'S2', 90, 360, 60), ($1, 'S3', 120, 480, 60), ($1, 'S4', 180, 720, 60),
      ($2, 'S1', 60, 240, 60), ($2, 'S2', 90, 360, 60), ($2, 'S3', 120, 480, 60), ($2, 'S4', 180, 720, 60)`,
    [A, B],
  );
  await admin.query(
    "INSERT INTO segment (id, tenant_id, code, name, sort) VALUES ($1, $2, 'HID', 'Hidden', 0)",
    [SEGMENT_A, A],
  );
  await admin.query(
    "INSERT INTO machine_group (id, tenant_id, segment_id, code, name, sort, hidden) VALUES ($1, $2, $3, 'UTIL', 'Utilities', 0, true)",
    [GROUP_HIDDEN, A, SEGMENT_A],
  );
  await admin.query(
    "INSERT INTO machine (id, tenant_id, code, criticality, cell, segment_id, group_id) VALUES ($1, $2, 'VC-HID', 'A', 'C1', $3, $4)",
    [MACHINE_HIDDEN, A, SEGMENT_A, GROUP_HIDDEN],
  );
  app = await buildApp({
    pool: db.app,
    logger: false,
    rateLimitMax: 100000,
    publicBaseDomain: BASE_DOMAIN,
  });
  for (const name of ['rina', 'lal', 'sana', 'tv']) tokens[name] = await login(HOST_A, name);
  tokens.bob = await login(HOST_B, 'bob');
  tokens.bea = await login(HOST_B, 'bea');
}, 120_000);

afterAll(async () => {
  await app.close();
  await db.stop();
});

const ticketUrl = (ticketId: string) => `/api/v1/tickets/${ticketId}`;

/** Rina reports a stop; Lal starts it and closes it with a report (which asks Rina to sign off), or as `kind` says. */
async function raisedBy(machineId: string, who = 'rina'): Promise<string> {
  const raised = await asA('POST', '/api/v1/tickets', tokens[who]!, {
    machineId,
    problem: 'Spindle stops',
  });
  expect(raised.statusCode).toBe(201);
  return raised.json().ticket.id as string;
}

async function closed(
  machineId = MACHINE_A,
  kind: 'report' | 'no_report' = 'report',
): Promise<{ id: string; ref: string }> {
  const ticketId = await raisedBy(machineId);
  const work = (action: string, extra: object = {}) =>
    asA('POST', `${ticketUrl(ticketId)}/${action}`, tokens.lal!, {
      personId: LEAD,
      ...extra,
    });
  expect((await work('start')).statusCode).toBe(200);
  const close = await work('close', {
    kind,
    ...(kind === 'report' ? { report: { correctiveAction: 'Fixed' } } : {}),
  });
  expect(close.statusCode).toBe(200);
  const detail = await asA('GET', ticketUrl(ticketId), tokens.sana!);
  return { id: ticketId, ref: detail.json().ticket.ref as string };
}

const answer = (ticketId: string, body: object) =>
  asA('POST', `${ticketUrl(ticketId)}/handback`, tokens.rina!, {
    personId: REPORTER,
    ...body,
  });
const setFloorLive = (on: boolean) =>
  db.admin.query(
    `INSERT INTO setting (tenant_id, key, value) VALUES ($1, 'features', $2)
     ON CONFLICT (tenant_id, key) DO UPDATE SET value = EXCLUDED.value`,
    [A, JSON.stringify({ floorLive: on })],
  );

describe('the sign-off QR', () => {
  const qrUrl = (ticketId: string) => `${ticketUrl(ticketId)}/signoff-qr`;
  const linkOf = (slug: string, ticketId: string) =>
    `https://${slug}.${BASE_DOMAIN}/floor/signoff/${ticketId}`;

  it('encodes this ticket’s sign-off page under the company’s own address, as an SVG image', async () => {
    const { id: ticketId } = await closed();
    const res = await asA('GET', qrUrl(ticketId), tokens.sana!);
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('image/svg+xml');
    expect(res.body).toBe(await qrSvg(linkOf('sb-a', ticketId)));
    const other = await closed(MACHINE_A2);
    const another = await asA('GET', qrUrl(other.id), tokens.sana!);
    expect(another.body).toBe(await qrSvg(linkOf('sb-a', other.id)));
    expect(another.body).not.toBe(res.body);
  });

  it('takes the domain from the setting, whatever the request says about its own address', async () => {
    const { id: ticketId } = await closed();
    const honest = await asA('GET', qrUrl(ticketId), tokens.sana!);
    const hostile = await send({
      host: 'sb-a.attacker.test',
      method: 'GET',
      url: qrUrl(ticketId),
      token: tokens.sana!,
      headers: { 'x-forwarded-host': 'attacker.test', 'x-forwarded-proto': 'http' },
    });
    expect(hostile.statusCode).toBe(200);
    expect(hostile.body).toBe(honest.body);
    expect(hostile.body).toBe(await qrSvg(linkOf('sb-a', ticketId)));
    const foreign = await asB('GET', qrUrl(ticketId), tokens.sana!);
    expect(foreign.statusCode).toBe(401);
  });

  it('answers 503 until the company address is set up, and never guesses one', async () => {
    const { id: ticketId } = await closed();
    const bare = await buildApp({ pool: db.app, logger: false, rateLimitMax: 100000 });
    try {
      const res = await bare.inject({
        method: 'GET',
        url: qrUrl(ticketId),
        headers: { host: HOST_A, authorization: `Bearer ${tokens.sana}` },
      });
      expect(res.statusCode).toBe(503);
      expect(res.json().error.code).toBe('not_configured');
    } finally {
      await bare.close();
    }
  });

  it('is for whoever may see the board: the board and a supervisor, an operator only when the floor is live', async () => {
    const { id: ticketId } = await closed();
    const url = `${ticketUrl(ticketId)}/signoff-qr`;
    expect((await asA('GET', url, tokens.tv!)).statusCode).toBe(200);
    expect((await asA('GET', url, tokens.sana!)).statusCode).toBe(200);
    await setFloorLive(false);
    expect((await asA('GET', url, tokens.rina!)).statusCode).toBe(403);
    await setFloorLive(true);
    expect((await asA('GET', url, tokens.rina!)).statusCode).toBe(200);
    await setFloorLive(false);
    expect((await asA('GET', url, '')).statusCode).toBe(401);
  });

  it('answers 404 for an unknown ticket, a bad id and another plant’s ticket', async () => {
    const theirs = await asB('POST', '/api/v1/tickets', tokens.bob!, {
      machineId: MACHINE_B,
      problem: 'Their stop',
    });
    expect(theirs.statusCode).toBe(201);
    for (const target of [theirs.json().ticket.id, randomUUID(), 'not-an-id']) {
      const res = await asA('GET', `${ticketUrl(target)}/signoff-qr`, tokens.sana!);
      expect(res.statusCode, target).toBe(404);
      expect(res.json().error.code).toBe('not_found');
    }
  });
});

describe('the board feed of sign-offs waiting for production', () => {
  const feed = (token = tokens.tv!, host = HOST_A) =>
    send({ host, method: 'GET', url: '/api/v1/board/signoff', token });

  it('lists only closed tickets still waiting for an answer, newest close first, with where to go', async () => {
    const first = await closed(MACHINE_A);
    const second = await closed(MACHINE_A2);
    const answered = await closed(MACHINE_A);
    expect((await answer(answered.id, { response: 'confirmed' })).statusCode).toBe(200);
    const sentBack = await closed(MACHINE_A3);
    expect(
      (await answer(sentBack.id, { response: 'disputed', reason: 'Still stops' })).statusCode,
    ).toBe(200);
    const nobodyAsked = await closed(MACHINE_A, 'no_report');
    const stillOpen = await raisedBy(MACHINE_A2);

    const res = await feed();
    expect(res.statusCode).toBe(200);
    const ids = res.json().items.map((item: { ticketId: string }) => item.ticketId);
    expect(ids.slice(0, 2)).toEqual([second.id, first.id]);
    const closedAts = res
      .json()
      .items.map((item: { closedAt: string }) => Date.parse(item.closedAt));
    expect(closedAts).toEqual([...closedAts].sort((a, b) => b - a));
    for (const left of [answered.id, sentBack.id, nobodyAsked.id, stillOpen]) {
      expect(ids).not.toContain(left);
    }
    expect(res.json().items[0]).toMatchObject({
      ticketId: second.id,
      ref: second.ref,
      machine: { id: MACHINE_A2, code: 'VC-SB2' },
      cell: 'C2',
    });
    const item = res.json().items[1];
    expect(item.machine).toEqual({ id: MACHINE_A, code: 'VC-SB' });
    expect(item.cell).toBe('C1');
    for (const field of ['closedAt', 'requestedAt', 'dueAt']) {
      expect(Number.isNaN(Date.parse(item[field])), field).toBe(false);
    }
    expect(Date.parse(res.json().items[0].closedAt)).toBeGreaterThanOrEqual(
      Date.parse(item.closedAt),
    );
    await asA('POST', `${ticketUrl(stillOpen)}/cancel`, tokens.sana!, {
      personId: SUPER,
      reason: 'x',
    });
  });

  it('drops a ticket once the time production had to answer has run out', async () => {
    await db.admin.query('UPDATE sla_policy SET handback_minutes = 60 WHERE tenant_id = $1', [A]);
    const waiting = await closed();
    const idsNow = async () =>
      (await feed()).json().items.map((i: { ticketId: string }) => i.ticketId);
    expect(await idsNow()).toContain(waiting.id);
    vi.useFakeTimers({ toFake: ['Date'], now: Date.now() + 2 * 60 * 60_000 });
    try {
      expect(await idsNow()).not.toContain(waiting.id);
    } finally {
      vi.useRealTimers();
    }
    expect(await idsNow()).toContain(waiting.id);
  });

  it('drops a ticket the moment production answers it', async () => {
    const waiting = await closed();
    const before = (await feed()).json().items.map((i: { ticketId: string }) => i.ticketId);
    expect(before).toContain(waiting.id);
    expect((await answer(waiting.id, { response: 'confirmed' })).statusCode).toBe(200);
    const after = (await feed()).json().items.map((i: { ticketId: string }) => i.ticketId);
    expect(after).not.toContain(waiting.id);
  });

  it('leaves out a machine kept off the board, whose sign-off stays reachable by its QR', async () => {
    const hidden = await closed(MACHINE_HIDDEN);
    const shown = await closed(MACHINE_A);
    const ids = (await feed()).json().items.map((i: { ticketId: string }) => i.ticketId);
    expect(ids).toContain(shown.id);
    expect(ids).not.toContain(hidden.id);
    expect((await asA('GET', `${ticketUrl(hidden.id)}/signoff-qr`, tokens.sana!)).statusCode).toBe(
      200,
    );
  });

  it('is for whoever may see the board, and shows a plant only its own tickets', async () => {
    await closed();
    expect((await feed(tokens.sana!)).statusCode).toBe(200);
    await setFloorLive(false);
    expect((await feed(tokens.rina!)).statusCode).toBe(403);
    await setFloorLive(true);
    expect((await feed(tokens.rina!)).statusCode).toBe(200);
    await setFloorLive(false);
    expect((await feed('')).statusCode).toBe(401);
    const theirs = await feed(tokens.bea!, HOST_B);
    expect(theirs.statusCode).toBe(200);
    expect(theirs.json().items).toEqual([]);
    expect((await feed(tokens.sana!)).json().items.length).toBeGreaterThan(0);
  });
});

interface Seed {
  tag: string;
  count: number;
  severity: 'S1' | 'S3' | 'S4';
  closedAgoMin: number;
  /** How many of them also have a sign-off clock that has already fired. */
  fired?: number;
}

/** Closed tickets in plant B whose sign-off was asked and not answered, written straight in: `count` of them, newest first. */
async function seedWaiting(seed: Seed): Promise<void> {
  await db.admin.query(
    `WITH t AS (
       INSERT INTO ticket (id, tenant_id, ref, kind, status, problem, reported_at, closed_at, close_kind,
           closed_by_person_id, reported_by_person_id, severity, machine_id, machine_snapshot)
       SELECT gen_random_uuid(), $1, $2 || '-' || g, 'stopped', 'closed', 'Seeded',
           now() - ($4::int * interval '1 minute') - g * interval '1 second' - interval '1 hour',
           now() - ($4::int * interval '1 minute') - g * interval '1 second', 'report', $5, $6, $7, $8,
           jsonb_build_object('code', 'VC-B', 'cell', 'C1')
       FROM generate_series(1, $3::int) g
       RETURNING id, ref, closed_at),
     e AS (
       INSERT INTO ticket_event (tenant_id, ticket_id, seq, type, at, acting_person_id, payload)
       SELECT $1, id, 1, 'close', closed_at, $5, '{"handbackRequested": true}' FROM t)
     INSERT INTO sla_timer (tenant_id, ticket_id, kind, due_at, fired_at, state)
     SELECT $1, id, 'handback', closed_at + interval '10 minutes', closed_at + interval '10 minutes', 'running'
     FROM t WHERE regexp_replace(ref, '^.*-', '')::int <= $9::int`,
    [
      B,
      seed.tag,
      seed.count,
      seed.closedAgoMin,
      BSUP,
      BOB,
      seed.severity,
      MACHINE_B,
      seed.fired ?? 0,
    ],
  );
}

/** Production answers them all, so they stop waiting (the log is never deleted from). */
const forgetSeeded = (tag: string) =>
  db.admin.query(
    `INSERT INTO ticket_event (tenant_id, ticket_id, seq, type, at, acting_person_id)
     SELECT $1, id, 2, 'handback_confirm', now(), $3 FROM ticket WHERE tenant_id = $1 AND ref LIKE $2 || '-%'`,
    [B, tag, BOB],
  );

describe('the board feed with many tickets', () => {
  const refsOfB = async () =>
    (await send({ host: HOST_B, method: 'GET', url: '/api/v1/board/signoff', token: tokens.bea! }))
      .json()
      .items.map((i: { ref: string }) => i.ref) as string[];

  it('shows at most 50, newest close first', async () => {
    await seedWaiting({ tag: 'CAP', count: 51, severity: 'S3', closedAgoMin: 10 });
    try {
      const refs = await refsOfB();
      expect(refs).toHaveLength(50);
      expect(refs[0]).toBe('CAP-1');
      expect(refs).toContain('CAP-50');
      expect(refs).not.toContain('CAP-51');
    } finally {
      await forgetSeeded('CAP');
    }
  });

  it('does not let a run of timed-out sign-offs hide an older one that is still waiting', async () => {
    await db.admin.query(
      "UPDATE sla_policy SET handback_minutes = 10 WHERE tenant_id = $1 AND severity = 'S1'",
      [B],
    );
    await db.admin.query(
      "UPDATE sla_policy SET handback_minutes = 1440 WHERE tenant_id = $1 AND severity = 'S4'",
      [B],
    );
    // 60 newer sign-offs whose short time has run out (half with the clock's alarm already raised), one older with a long time.
    await seedWaiting({ tag: 'OUT', count: 60, severity: 'S1', closedAgoMin: 120, fired: 30 });
    await seedWaiting({ tag: 'LONG', count: 1, severity: 'S4', closedAgoMin: 240 });
    try {
      const refs = await refsOfB();
      expect(refs).toEqual(['LONG-1']);
    } finally {
      await forgetSeeded('OUT');
      await forgetSeeded('LONG');
      await db.admin.query(
        "UPDATE sla_policy SET handback_minutes = 60 WHERE tenant_id = $1 AND severity IN ('S1', 'S4')",
        [B],
      );
    }
  });
});
