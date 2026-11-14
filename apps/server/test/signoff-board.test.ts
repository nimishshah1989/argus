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
const PASSWORD = 'correct-horse-battery';
const HOST_A = 'sb-a.localhost';
const HOST_B = 'sb-b.localhost';

type App = Awaited<ReturnType<typeof buildApp>>;
let db: TestDb;
let app: App;
const tokens: Record<string, string> = {};

function call(
  host: string,
  method: 'GET' | 'POST',
  url: string,
  token: string,
  payload?: object,
  headers: Record<string, string> = {},
) {
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

async function login(host: string, username: string): Promise<string> {
  const res = await call(host, 'POST', '/api/v1/auth/login', '', { username, password: PASSWORD });
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
      ($1, 'S1', 60, 240, 60), ($1, 'S2', 90, 360, 60), ($1, 'S3', 120, 480, 60), ($1, 'S4', 180, 720, 60)`,
    [A],
  );
  app = await buildApp({ pool: db.app, logger: false, rateLimitMax: 100000 });
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
  const raised = await call(HOST_A, 'POST', '/api/v1/tickets', tokens[who]!, {
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
    call(HOST_A, 'POST', `${ticketUrl(ticketId)}/${action}`, tokens.lal!, {
      personId: LEAD,
      ...extra,
    });
  expect((await work('start')).statusCode).toBe(200);
  const close = await work('close', {
    kind,
    ...(kind === 'report' ? { report: { correctiveAction: 'Fixed' } } : {}),
  });
  expect(close.statusCode).toBe(200);
  const detail = await call(HOST_A, 'GET', ticketUrl(ticketId), tokens.sana!);
  return { id: ticketId, ref: detail.json().ticket.ref as string };
}

const answer = (ticketId: string, body: object) =>
  call(HOST_A, 'POST', `${ticketUrl(ticketId)}/handback`, tokens.rina!, {
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
  it('encodes this ticket’s sign-off page on the address the request came to, as an SVG image', async () => {
    const { id: ticketId } = await closed();
    const res = await call(HOST_A, 'GET', `${ticketUrl(ticketId)}/signoff-qr`, tokens.sana!);
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('image/svg+xml');
    expect(res.body).toBe(await qrSvg(`http://${HOST_A}/floor/signoff/${ticketId}`));
    const secure = await call(
      HOST_A,
      'GET',
      `${ticketUrl(ticketId)}/signoff-qr`,
      tokens.sana!,
      undefined,
      {
        'x-forwarded-proto': 'https',
      },
    );
    expect(secure.body).toBe(await qrSvg(`https://${HOST_A}/floor/signoff/${ticketId}`));
    expect(secure.body).not.toBe(res.body);
    const other = await closed(MACHINE_A2);
    const another = await call(HOST_A, 'GET', `${ticketUrl(other.id)}/signoff-qr`, tokens.sana!);
    expect(another.body).not.toBe(res.body);
  });

  it('is for whoever may see the board: the board and a supervisor, an operator only when the floor is live', async () => {
    const { id: ticketId } = await closed();
    const url = `${ticketUrl(ticketId)}/signoff-qr`;
    expect((await call(HOST_A, 'GET', url, tokens.tv!)).statusCode).toBe(200);
    expect((await call(HOST_A, 'GET', url, tokens.sana!)).statusCode).toBe(200);
    await setFloorLive(false);
    expect((await call(HOST_A, 'GET', url, tokens.rina!)).statusCode).toBe(403);
    await setFloorLive(true);
    expect((await call(HOST_A, 'GET', url, tokens.rina!)).statusCode).toBe(200);
    await setFloorLive(false);
    expect((await call(HOST_A, 'GET', url, '')).statusCode).toBe(401);
  });

  it('answers 404 for an unknown ticket, a bad id and another plant’s ticket', async () => {
    const theirs = await call(HOST_B, 'POST', '/api/v1/tickets', tokens.bob!, {
      machineId: MACHINE_B,
      problem: 'Their stop',
    });
    expect(theirs.statusCode).toBe(201);
    for (const target of [theirs.json().ticket.id, randomUUID(), 'not-an-id']) {
      const res = await call(HOST_A, 'GET', `${ticketUrl(target)}/signoff-qr`, tokens.sana!);
      expect(res.statusCode, target).toBe(404);
      expect(res.json().error.code).toBe('not_found');
    }
  });
});

describe('the board feed of sign-offs waiting for production', () => {
  const feed = (token = tokens.tv!, host = HOST_A) =>
    call(host, 'GET', '/api/v1/board/signoff', token);

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
    await call(HOST_A, 'POST', `${ticketUrl(stillOpen)}/cancel`, tokens.sana!, {
      personId: SUPER,
      reason: 'x',
    });
  });

  it('drops a ticket once the time production had to answer has run out', async () => {
    const waiting = await closed();
    const idsNow = async () =>
      (await feed()).json().items.map((i: { ticketId: string }) => i.ticketId);
    expect(await idsNow()).toContain(waiting.id);
    vi.useFakeTimers({ toFake: ['Date'], now: Date.now() + 3 * 60 * 60_000 });
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
