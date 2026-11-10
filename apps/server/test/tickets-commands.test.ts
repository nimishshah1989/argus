import { readFileSync } from 'node:fs';
import { hash } from '@node-rs/argon2';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';

const TENANT = '10000000-0000-0000-0000-000000000001';
const SEGMENT = '10000000-0000-0000-0000-000000000002';
const MACHINE_HP = '10000000-0000-0000-0000-000000000003'; // VC-1, happy path
const MACHINE_CONFLICT = '10000000-0000-0000-0000-000000000004'; // VC-2, state conflicts
const MACHINE_IDEM = '10000000-0000-0000-0000-000000000005'; // VC-3, command replay
const MACHINE_IDEM_RAISE = '10000000-0000-0000-0000-000000000006'; // VC-4, raise replay
const MACHINE_CONC_START = '10000000-0000-0000-0000-000000000007'; // VC-5, concurrent start
const MACHINE_CONC_RAISE = '10000000-0000-0000-0000-000000000008'; // VC-6, concurrent raise
const ASHA = '10000000-0000-0000-0000-000000000009';
const BINA = '10000000-0000-0000-0000-00000000000a';
const OPERATOR = '10000000-0000-0000-0000-00000000000b';
const ADMIN_PERSON = '10000000-0000-0000-0000-00000000000c';
const LOGIN_ASHA = '10000000-0000-0000-0000-00000000000d';
const LOGIN_BINA = '10000000-0000-0000-0000-00000000000e';
const LOGIN_OP = '10000000-0000-0000-0000-00000000000f';
const LOGIN_SHARED_OP = '10000000-0000-0000-0000-000000000010';
const LOGIN_ADMIN = '10000000-0000-0000-0000-000000000011';
const PASSWORD = 'correct-horse-battery';

type App = Awaited<ReturnType<typeof buildApp>>;
type Res = Awaited<ReturnType<App['inject']>>;

let container: StartedPostgreSqlContainer;
let pool: Pool;
let app: App;
let ashaToken = '';
let binaToken = '';

let keyCounter = 0;
function nextKey(): string {
  keyCounter += 1;
  return `req-${keyCounter}`;
}

interface PostOpts {
  idem?: string | null;
}

function post(url: string, token: string, payload: unknown, opts: PostOpts = {}): Promise<Res> {
  const headers: Record<string, string> = {
    host: 'cosmos.localhost',
    'content-type': 'application/json',
    authorization: `Bearer ${token}`,
  };
  const idem = opts.idem === undefined ? nextKey() : opts.idem;
  if (idem !== null) headers['idempotency-key'] = idem;
  return app.inject({ method: 'POST', url, headers, payload: payload as object });
}

function get(url: string, token: string): Promise<Res> {
  return app.inject({
    method: 'GET',
    url,
    headers: { host: 'cosmos.localhost', authorization: `Bearer ${token}` },
  });
}

async function login(username: string): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    headers: { host: 'cosmos.localhost', 'content-type': 'application/json' },
    payload: { username, password: PASSWORD },
  });
  expect(res.statusCode).toBe(200);
  return res.json().token as string;
}

function expectFigures(ticket: unknown): void {
  const figures = (ticket as { figures?: Record<string, unknown> }).figures;
  expect(figures, 'ticket.figures should be present').toBeTruthy();
  for (const key of [
    'activeMin',
    'waitMin',
    'vendorMin',
    'handoverWaitMin',
    'downAccMin',
    'repairMin',
  ]) {
    expect(typeof figures?.[key], `figures.${key} should be a number`).toBe('number');
  }
  expect(typeof figures?.perPerson).toBe('object');
  expect('responseMin' in (figures ?? {})).toBe(true);
  expect('downtimeMin' in (figures ?? {})).toBe(true);
  expect('followMin' in (figures ?? {})).toBe(true);
}

interface TicketBody {
  id?: string;
  [key: string]: unknown;
}

/** Returns the ticket inside a `{ticket}` response body, asserting the wrapper exists. */
function ticketOf(res: Res): TicketBody {
  const body = res.json() as { ticket?: TicketBody };
  expect(body.ticket, 'expected the response to wrap a ticket as {ticket}').toBeTruthy();
  return body.ticket as TicketBody;
}

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:16-alpine').start();
  pool = new Pool({ connectionString: container.getConnectionUri(), max: 5 });
  await pool.query(
    readFileSync(
      new URL('../../../packages/db/migrations/0001_schema_v1.sql', import.meta.url),
      'utf8',
    ),
  );
  const passwordHash = await hash(PASSWORD, {
    algorithm: 2,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
  await pool.query("INSERT INTO tenant (id, slug, name) VALUES ($1, 'cosmos', 'Cosmos')", [TENANT]);
  await pool.query(
    "INSERT INTO segment (id, tenant_id, code, name, sort) VALUES ($1, $2, 'CNC', 'CNC', 0)",
    [SEGMENT, TENANT],
  );
  await pool.query(
    `INSERT INTO machine (id, tenant_id, code, segment_id, category, cell) VALUES
     ($1, $7, 'VC-1', $8, 'VMC', 'Cell-1'),
     ($2, $7, 'VC-2', $8, 'VMC', 'Cell-1'),
     ($3, $7, 'VC-3', $8, 'VMC', 'Cell-2'),
     ($4, $7, 'VC-4', $8, 'VMC', 'Cell-2'),
     ($5, $7, 'VC-5', $8, 'HMC', 'Cell-3'),
     ($6, $7, 'VC-6', $8, 'HMC', 'Cell-3')`,
    [
      MACHINE_HP,
      MACHINE_CONFLICT,
      MACHINE_IDEM,
      MACHINE_IDEM_RAISE,
      MACHINE_CONC_START,
      MACHINE_CONC_RAISE,
      TENANT,
      SEGMENT,
    ],
  );
  await pool.query(
    `INSERT INTO person (id, tenant_id, name, team, title) VALUES
     ($1, $5, 'Asha', 'maintenance', 'Technician'),
     ($2, $5, 'Bina', 'maintenance', 'Technician'),
     ($3, $5, 'Opera', 'production', 'Operator'),
     ($4, $5, 'Admin', 'maintenance', 'Head')`,
    [ASHA, BINA, OPERATOR, ADMIN_PERSON, TENANT],
  );
  await pool.query(
    `INSERT INTO login (id, tenant_id, person_id, username, password_hash, role, shared) VALUES
     ($1, $10, $5, 'asha', $11, 'technician', false),
     ($2, $10, $6, 'bina', $11, 'technician', false),
     ($3, $10, $7, 'op', $11, 'operator', false),
     ($4, $10, NULL, 'cell-phone', $11, 'operator', true),
     ($9, $10, $8, 'admin', $11, 'admin', false)`,
    [
      LOGIN_ASHA,
      LOGIN_BINA,
      LOGIN_OP,
      LOGIN_SHARED_OP,
      ASHA,
      BINA,
      OPERATOR,
      ADMIN_PERSON,
      LOGIN_ADMIN,
      TENANT,
      passwordHash,
    ],
  );
  await pool.query(
    "INSERT INTO ref_counter (tenant_id, prefix, next_value) VALUES ($1, 'BD', 150)",
    [TENANT],
  );

  app = await buildApp({ pool, logger: false, rateLimitMax: 100000 });
  ashaToken = await login('asha');
  binaToken = await login('bina');
}, 120_000);

afterAll(async () => {
  await app.close();
  await pool.end();
  await container.stop();
});

describe('ticket commands', () => {
  it('runs the full happy path and returns non-null figures at every step', async () => {
    const raised = await post('/api/v1/tickets', ashaToken, {
      machineId: MACHINE_HP,
      problem: 'Spindle alarm',
    });
    expect(raised.statusCode).toBe(201);
    const id = ticketOf(raised).id as string;
    expect(raised.json().ticket.status).toBe('open');
    expectFigures(raised.json().ticket);

    const start = await post(`/api/v1/tickets/${id}/start`, ashaToken, { personId: ASHA });
    expect(start.statusCode).toBe(200);
    expect(start.json().ticket.status).toBe('working');
    expect(start.json().ticket.leadPersonId).toBe(ASHA);
    expect(start.json().ticket.startedAt).not.toBeNull();
    expect(typeof start.json().ticket.figures.responseMin).toBe('number');
    expectFigures(start.json().ticket);

    const pause = await post(`/api/v1/tickets/${id}/pause`, ashaToken, {
      personId: ASHA,
      reasonCode: 'spare',
    });
    expect(pause.statusCode).toBe(200);
    expect(pause.json().ticket.status).toBe('waiting');
    expect(pause.json().ticket.waitReason).toBe('spare');
    expect(pause.json().ticket.waitSince).not.toBeNull();
    expectFigures(pause.json().ticket);

    const resume = await post(`/api/v1/tickets/${id}/resume`, ashaToken, { personId: ASHA });
    expect(resume.statusCode).toBe(200);
    expect(resume.json().ticket.status).toBe('working');
    expectFigures(resume.json().ticket);

    const running = await post(`/api/v1/tickets/${id}/machine-running`, ashaToken, {
      personId: ASHA,
    });
    expect(running.statusCode).toBe(200);
    expect(running.json().ticket.machineRunningAt).not.toBeNull();
    expectFigures(running.json().ticket);

    const stopped = await post(`/api/v1/tickets/${id}/machine-stopped`, ashaToken, {
      personId: ASHA,
    });
    expect(stopped.statusCode).toBe(200);
    expect(stopped.json().ticket.machineStoppedAt).not.toBeNull();
    expectFigures(stopped.json().ticket);

    const update = await post(`/api/v1/tickets/${id}/update`, ashaToken, {
      personId: ASHA,
      text: 'Replaced belt',
    });
    expect(update.statusCode).toBe(200);
    expect(update.json().ticket.status).toBe('working');
    expectFigures(update.json().ticket);

    const transfer = await post(`/api/v1/tickets/${id}/transfer`, ashaToken, {
      personId: ASHA,
      note: 'Next shift takes over',
    });
    expect(transfer.statusCode).toBe(200);
    expect(transfer.json().ticket.status).toBe('open');
    expect(transfer.json().ticket.handedOver).toBe(true);
    expect(transfer.json().ticket.transfers).toBe(1);
    expectFigures(transfer.json().ticket);

    const pickup = await post(`/api/v1/tickets/${id}/start`, ashaToken, { personId: ASHA });
    expect(pickup.statusCode).toBe(200);
    expect(pickup.json().ticket.status).toBe('working');
    expect(pickup.json().ticket.leadPersonId).toBe(ASHA);
    expectFigures(pickup.json().ticket);

    const join = await post(`/api/v1/tickets/${id}/join`, binaToken, {
      personId: BINA,
      role: 'support',
    });
    expect(join.statusCode).toBe(200);
    expect(join.json().ticket.status).toBe('working');
    expectFigures(join.json().ticket);

    const leave = await post(`/api/v1/tickets/${id}/leave`, binaToken, {
      personId: BINA,
      reason: 'All set',
    });
    expect(leave.statusCode).toBe(200);
    expect(leave.json().ticket.status).toBe('working');
    expectFigures(leave.json().ticket);

    const close = await post(`/api/v1/tickets/${id}/close`, ashaToken, {
      personId: ASHA,
      kind: 'report',
    });
    expect(close.statusCode).toBe(200);
    expect(close.json().ticket.status).toBe('closed');
    expect(close.json().ticket.closeKind).toBe('report');
    expect(close.json().ticket.closedAt).not.toBeNull();
    expect(close.json().ticket.figures.downtimeMin).toBeGreaterThanOrEqual(1);
    expectFigures(close.json().ticket);
  });

  it('rejects invalid state transitions with 409', async () => {
    const raised = await post('/api/v1/tickets', ashaToken, {
      machineId: MACHINE_CONFLICT,
      problem: 'Gear noise',
    });
    const id = ticketOf(raised).id as string;
    const start = await post(`/api/v1/tickets/${id}/start`, ashaToken, { personId: ASHA });
    expect(start.statusCode).toBe(200);

    const again = await post(`/api/v1/tickets/${id}/start`, ashaToken, { personId: ASHA });
    expect(again.statusCode).toBe(409);
    expect(again.json().error.code).toBe('conflict');

    const resume = await post(`/api/v1/tickets/${id}/resume`, ashaToken, { personId: ASHA });
    expect(resume.statusCode).toBe(409);
    expect(resume.json().error.code).toBe('conflict');
  });

  it('replays a command idempotently and applies it once', async () => {
    const raised = await post('/api/v1/tickets', ashaToken, {
      machineId: MACHINE_IDEM,
      problem: 'Noisy pump',
    });
    const id = ticketOf(raised).id as string;
    const key = 'idem-start-1';
    const first = await post(
      `/api/v1/tickets/${id}/start`,
      ashaToken,
      { personId: ASHA },
      {
        idem: key,
      },
    );
    expect(first.statusCode).toBe(200);

    const replay = await post(
      `/api/v1/tickets/${id}/start`,
      ashaToken,
      { personId: ASHA },
      {
        idem: key,
      },
    );
    expect(replay.statusCode).toBe(200);
    expect(replay.json()).toEqual(first.json());

    const detail = await get(`/api/v1/tickets/${id}`, ashaToken);
    expect(detail.json().events).toHaveLength(2); // down + start, not duplicated
  });

  it('replays a raise idempotently and returns the same ref', async () => {
    const key = 'idem-raise-1';
    const payload = { machineId: MACHINE_IDEM_RAISE, problem: 'Fan failure' };
    const first = await post('/api/v1/tickets', ashaToken, payload, { idem: key });
    expect(first.statusCode).toBe(201);

    const replay = await post('/api/v1/tickets', ashaToken, payload, { idem: key });
    expect(replay.statusCode).toBe(201);
    expect(replay.json().ticket.ref).toBe(first.json().ticket.ref);

    const state = await get('/api/v1/state', ashaToken);
    const open = state
      .json()
      .open.filter((t: { machineId: string }) => t.machineId === MACHINE_IDEM_RAISE);
    expect(open).toHaveLength(1);
  });

  it('serialises two concurrent starts to one winner', async () => {
    const raised = await post('/api/v1/tickets', ashaToken, {
      machineId: MACHINE_CONC_START,
      problem: 'Vibration',
    });
    const id = ticketOf(raised).id as string;

    const [a, b] = await Promise.all([
      post(`/api/v1/tickets/${id}/start`, ashaToken, { personId: ASHA }, { idem: 'conc-start-a' }),
      post(`/api/v1/tickets/${id}/start`, ashaToken, { personId: ASHA }, { idem: 'conc-start-b' }),
    ]);
    const statuses = [a.statusCode, b.statusCode].sort((x, y) => x - y);
    expect(statuses).toEqual([200, 409]);
  });

  it('deduplicates two concurrent raises with one key', async () => {
    const key = 'conc-raise-same';
    const payload = { machineId: MACHINE_CONC_RAISE, problem: 'Overload' };
    const [a, b] = await Promise.all([
      post('/api/v1/tickets', ashaToken, payload, { idem: key }),
      post('/api/v1/tickets', ashaToken, payload, { idem: key }),
    ]);
    expect(a.statusCode).toBe(201);
    expect(b.statusCode).toBe(201);
    expect(a.json().ticket.ref).toBe(b.json().ticket.ref);

    const state = await get('/api/v1/state', ashaToken);
    const open = state
      .json()
      .open.filter((t: { machineId: string }) => t.machineId === MACHINE_CONC_RAISE);
    expect(open).toHaveLength(1);
  });
});
