import { hash } from '@node-rs/argon2';
import type { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { startTestDb, type TestDb } from './harness.js';

// Cosmos tenant and its people/logins/machines.
const TENANT = '10000000-0000-0000-0000-000000000001';
const SEGMENT = '10000000-0000-0000-0000-000000000002';
const MACHINE = '10000000-0000-0000-0000-000000000003'; // VC-1, raise + duplicate
const MACHINE_PERM = '10000000-0000-0000-0000-000000000004'; // VC-2, permissions
const MACHINE_GET = '10000000-0000-0000-0000-000000000005'; // VC-3, detail projection
const MACHINE_KEY = '10000000-0000-0000-0000-000000000006'; // VC-4, missing idempotency key
const ASHA = '10000000-0000-0000-0000-000000000007';
const BINA = '10000000-0000-0000-0000-000000000008';
const OPERATOR = '10000000-0000-0000-0000-000000000009';
const ADMIN_PERSON = '10000000-0000-0000-0000-00000000000a';
const LOGIN_ASHA = '10000000-0000-0000-0000-00000000000b';
const LOGIN_BINA = '10000000-0000-0000-0000-00000000000c';
const LOGIN_OP = '10000000-0000-0000-0000-00000000000d';
const LOGIN_SHARED_OP = '10000000-0000-0000-0000-00000000000e';
const LOGIN_ADMIN = '10000000-0000-0000-0000-00000000000f';
// A second tenant to prove cross-tenant isolation.
const TENANT_2 = '20000000-0000-0000-0000-000000000001';
const TICKET_2 = '20000000-0000-0000-0000-000000000002';
const PASSWORD = 'correct-horse-battery';

type App = Awaited<ReturnType<typeof buildApp>>;
type Res = Awaited<ReturnType<App['inject']>>;

let db: TestDb;
let admin: Pool;
let app: App;
let ashaToken = '';
let binaToken = '';
let opToken = '';

let keyCounter = 0;
function nextKey(): string {
  keyCounter += 1;
  return `req-${keyCounter}`;
}

interface PostOpts {
  /** Explicit Idempotency-Key. `null` omits the header; omitted generates a fresh key. */
  idem?: string | null;
  host?: string;
}

function post(url: string, token: string, payload: unknown, opts: PostOpts = {}): Promise<Res> {
  const headers: Record<string, string> = {
    host: opts.host ?? 'cosmos.localhost',
    'content-type': 'application/json',
    authorization: `Bearer ${token}`,
  };
  const idem = opts.idem === undefined ? nextKey() : opts.idem;
  if (idem !== null) headers['idempotency-key'] = idem;
  return app.inject({ method: 'POST', url, headers, payload: payload as object });
}

function get(url: string, token: string, host = 'cosmos.localhost'): Promise<Res> {
  return app.inject({
    method: 'GET',
    url,
    headers: { host, authorization: `Bearer ${token}` },
  });
}

async function login(username: string, actingPersonId?: string): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    headers: { host: 'cosmos.localhost', 'content-type': 'application/json' },
    payload: { username, password: PASSWORD, ...(actingPersonId ? { actingPersonId } : {}) },
  });
  expect(res.statusCode).toBe(200);
  return res.json().token as string;
}

/** Asserts a ticket carries a non-null figures object with its numeric fields. */
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
  ref?: string;
  kind?: string;
  status?: string;
  machineId?: string | null;
  problem?: string;
  figures?: Record<string, unknown> | null;
  [key: string]: unknown;
}

/** Returns the ticket inside a `{ticket}` response body, asserting the wrapper exists. */
function ticketOf(res: Res): TicketBody {
  const body = res.json() as { ticket?: TicketBody };
  expect(body.ticket, 'expected the response to wrap a ticket as {ticket}').toBeTruthy();
  return body.ticket as TicketBody;
}

beforeAll(async () => {
  db = await startTestDb();
  admin = db.admin;
  const passwordHash = await hash(PASSWORD, {
    algorithm: 2, // Argon2id
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
  await admin.query("INSERT INTO tenant (id, slug, name) VALUES ($1, 'cosmos', 'Cosmos')", [
    TENANT,
  ]);
  await admin.query(
    "INSERT INTO segment (id, tenant_id, code, name, sort) VALUES ($1, $2, 'CNC', 'CNC', 0)",
    [SEGMENT, TENANT],
  );
  await admin.query(
    `INSERT INTO machine (id, tenant_id, code, segment_id, category, cell) VALUES
     ($1, $5, 'VC-1', $6, 'VMC', 'Cell-1'),
     ($2, $5, 'VC-2', $6, 'VMC', 'Cell-1'),
     ($3, $5, 'VC-3', $6, 'HMC', 'Cell-2'),
     ($4, $5, 'VC-4', $6, 'VMC', 'Cell-2')`,
    [MACHINE, MACHINE_PERM, MACHINE_GET, MACHINE_KEY, TENANT, SEGMENT],
  );
  await admin.query(
    `INSERT INTO person (id, tenant_id, name, team, title) VALUES
     ($1, $5, 'Asha', 'maintenance', 'Technician'),
     ($2, $5, 'Bina', 'maintenance', 'Technician'),
     ($3, $5, 'Opera', 'production', 'Operator'),
     ($4, $5, 'Admin', 'maintenance', 'Head')`,
    [ASHA, BINA, OPERATOR, ADMIN_PERSON, TENANT],
  );
  await admin.query(
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
  await admin.query(
    "INSERT INTO ref_counter (tenant_id, prefix, next_value) VALUES ($1, 'BD', 150)",
    [TENANT],
  );
  // Second tenant with one ticket, used only to assert cross-tenant 404.
  await admin.query("INSERT INTO tenant (id, slug, name) VALUES ($1, 'plant-two', 'Plant Two')", [
    TENANT_2,
  ]);
  await admin.query(
    "INSERT INTO ticket (id, tenant_id, ref, kind, status, problem, reported_at, severity) VALUES ($1, $2, 'BD-9999', 'stopped', 'open', 'Other tenant', now(), 'S3')",
    [TICKET_2, TENANT_2],
  );

  app = await buildApp({ pool: db.app, logger: false, rateLimitMax: 100000 });
  ashaToken = await login('asha');
  binaToken = await login('bina');
  opToken = await login('op');
}, 120_000);

afterAll(async () => {
  await app.close();
  await db.stop();
});

describe('tickets', () => {
  it('raises a stopped ticket with a BD ref and lists it in /state', async () => {
    const raised = await post('/api/v1/tickets', ashaToken, {
      machineId: MACHINE,
      problem: 'Spindle alarm',
    });
    expect(raised.statusCode).toBe(201);
    const ticket = ticketOf(raised);
    expect(ticket.ref).toBe('BD-0150');
    expect(ticket.kind).toBe('stopped');
    expect(ticket.status).toBe('open');
    expect(ticket.machineId).toBe(MACHINE);
    expect(ticket.problem).toBe('Spindle alarm');
    expectFigures(ticket);

    const state = await get('/api/v1/state', ashaToken);
    expect(state.statusCode).toBe(200);
    const open = state.json().open;
    expect(open).toHaveLength(1);
    expect(open[0].ref).toBe('BD-0150');
    expect(open[0].problem).toBe('Spindle alarm');
    expectFigures(open[0]);
  });

  it('raises a general task without a machine and requires location and workType', async () => {
    const ok = await post('/api/v1/tickets', ashaToken, {
      kind: 'general',
      location: 'Cell A',
      workType: 'Clean',
      problem: 'Sweep the aisle',
    });
    expect(ok.statusCode).toBe(201);
    expect(ok.json().ticket.kind).toBe('general');
    expect(ok.json().ticket.machineId).toBeNull();

    const missing = await post('/api/v1/tickets', ashaToken, {
      kind: 'general',
      problem: 'No location or work type',
    });
    expect(missing.statusCode).toBe(422);
    expect(missing.json().error.code).toBe('validation');
  });

  it('rejects a duplicate open ticket on the same machine', async () => {
    const duplicate = await post('/api/v1/tickets', ashaToken, {
      machineId: MACHINE,
      problem: 'Again',
    });
    expect(duplicate.statusCode).toBe(409);
    expect(duplicate.json().error.code).toBe('conflict');
  });

  it('enforces command permissions by role and crew', async () => {
    const raised = await post('/api/v1/tickets', ashaToken, {
      machineId: MACHINE_PERM,
      problem: 'Belt slip',
    });
    const id = ticketOf(raised).id as string;

    const opStart = await post(`/api/v1/tickets/${id}/start`, opToken, { personId: OPERATOR });
    expect(opStart.statusCode).toBe(403);
    expect(opStart.json().error.code).toBe('forbidden');

    const start = await post(`/api/v1/tickets/${id}/start`, ashaToken, { personId: ASHA });
    expect(start.statusCode).toBe(200);
    expect(start.json().ticket.status).toBe('working');

    const opPause = await post(`/api/v1/tickets/${id}/pause`, opToken, {
      personId: OPERATOR,
      reasonCode: 'spare',
    });
    expect(opPause.statusCode).toBe(403);
    expect(opPause.json().error.code).toBe('forbidden');

    const opClose = await post(`/api/v1/tickets/${id}/close`, opToken, {
      personId: OPERATOR,
      kind: 'report',
    });
    expect(opClose.statusCode).toBe(403);

    const binaClose = await post(`/api/v1/tickets/${id}/close`, binaToken, {
      personId: BINA,
      kind: 'report',
    });
    expect(binaClose.statusCode).toBe(403);

    const close = await post(`/api/v1/tickets/${id}/close`, ashaToken, {
      personId: ASHA,
      kind: 'report',
    });
    expect(close.statusCode).toBe(200);
    expect(close.json().ticket.status).toBe('closed');
  });

  it('returns the full detail projection for a ticket', async () => {
    const raised = await post('/api/v1/tickets', ashaToken, {
      machineId: MACHINE_GET,
      problem: 'Oil leak',
    });
    const id = ticketOf(raised).id as string;
    await post(`/api/v1/tickets/${id}/start`, ashaToken, { personId: ASHA });
    await post(`/api/v1/tickets/${id}/join`, binaToken, { personId: BINA, role: 'support' });

    const detail = await get(`/api/v1/tickets/${id}`, ashaToken);
    expect(detail.statusCode).toBe(200);
    const body = detail.json();
    expect(body.ticket.id).toBe(id);
    expect(body.ticket.status).toBe('working');
    expect(Array.isArray(body.events)).toBe(true);
    expect(body.events.map((e: { type: string }) => e.type)).toEqual(
      expect.arrayContaining(['down', 'start', 'join']),
    );
    expect(Array.isArray(body.people)).toBe(true);
    expect(body.people.some((p: { personId: string }) => p.personId === BINA)).toBe(true);
    expect(body.tasks).toEqual([]);
    expect(Array.isArray(body.intervals)).toBe(true);
    expect(body.intervals.length).toBeGreaterThanOrEqual(1);
  });

  it('hides a ticket that belongs to another tenant', async () => {
    const detail = await get(`/api/v1/tickets/${TICKET_2}`, ashaToken);
    expect(detail.statusCode).toBe(404);
    expect(detail.json().error.code).toBe('not_found');
  });

  it('requires the Idempotency-Key header on commands', async () => {
    const raised = await post('/api/v1/tickets', ashaToken, {
      machineId: MACHINE_KEY,
      problem: 'No key',
    });
    const id = ticketOf(raised).id as string;
    const missing = await post(
      `/api/v1/tickets/${id}/start`,
      ashaToken,
      { personId: ASHA },
      {
        idem: null,
      },
    );
    expect(missing.statusCode).toBe(422);
    expect(missing.json().error.code).toBe('validation');
    expect(missing.json().error.field).toBe('idempotencyKey');
  });

  it('requires authentication', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/tickets',
      headers: { host: 'cosmos.localhost', 'content-type': 'application/json' },
      payload: { machineId: MACHINE, problem: 'X' },
    });
    expect(res.statusCode).toBe(401);
  });
});
