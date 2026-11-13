import { hash } from '@node-rs/argon2';
import type { Pool } from 'pg';
import { withTenant } from '@uptimo/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { loadSegments, persistSegments } from '../src/modules/tickets/repo/segments.js';
import { startTestDb, type TestDb } from './harness.js';

const TENANT = '10000000-0000-0000-0000-000000000001';
const SEGMENT = '10000000-0000-0000-0000-000000000002';
const MACHINE_HP = '10000000-0000-0000-0000-000000000003'; // VC-1, happy path
const MACHINE_CONFLICT = '10000000-0000-0000-0000-000000000004'; // VC-2, state conflicts
const MACHINE_IDEM = '10000000-0000-0000-0000-000000000005'; // VC-3, command replay
const MACHINE_IDEM_RAISE = '10000000-0000-0000-0000-000000000006'; // VC-4, raise replay
const MACHINE_CONC_START = '10000000-0000-0000-0000-000000000007'; // VC-5, concurrent start
const MACHINE_CONC_RAISE = '10000000-0000-0000-0000-000000000008'; // VC-6, concurrent raise
const MACHINE_CANCEL = '10000000-0000-0000-0000-000000000012'; // VC-7, cancel + restore
const MACHINE_CORRECT = '10000000-0000-0000-0000-000000000013'; // VC-8, correct
const MACHINE_UPGRADE = '10000000-0000-0000-0000-000000000014'; // VC-9, upgrade-kind
const MACHINE_REPORT = '10000000-0000-0000-0000-000000000015'; // VC-10, late report
const MACHINE_OP_CANCEL = '10000000-0000-0000-0000-000000000016'; // VC-11, operator cancel
const MACHINE_RACE_1 = '10000000-0000-0000-0000-000000000017'; // race rounds
const MACHINE_RACE_2 = '10000000-0000-0000-0000-000000000018';
const MACHINE_RACE_3 = '10000000-0000-0000-0000-000000000019';
const MACHINE_RACE_4 = '10000000-0000-0000-0000-00000000001a';
const MACHINE_RACE_5 = '10000000-0000-0000-0000-00000000001b';
const MACHINE_SEGMENTS = '10000000-0000-0000-0000-00000000001c'; // VC-17, history is kept
const MACHINE_REVOKED = '10000000-0000-0000-0000-00000000001d'; // VC-18, DELETE revoked
const MACHINE_WAITING = '10000000-0000-0000-0000-00000000001e'; // VC-19, switched-off list entry
const MACHINE_GUARD = '10000000-0000-0000-0000-00000000001f'; // VC-20, repo guard
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

let db: TestDb;
let admin: Pool;
let app: App;
let ashaToken = '';
let binaToken = '';
let adminToken = '';
let opToken = '';
let cancelledTicketId = '';
let historyTicketId = '';

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
  db = await startTestDb();
  admin = db.admin;
  const passwordHash = await hash(PASSWORD, {
    algorithm: 2,
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
     ($1, $17, 'VC-1', $18, 'VMC', 'Cell-1'),
     ($2, $17, 'VC-2', $18, 'VMC', 'Cell-1'),
     ($3, $17, 'VC-3', $18, 'VMC', 'Cell-2'),
     ($4, $17, 'VC-4', $18, 'VMC', 'Cell-2'),
     ($5, $17, 'VC-5', $18, 'HMC', 'Cell-3'),
     ($6, $17, 'VC-6', $18, 'HMC', 'Cell-3'),
     ($7, $17, 'VC-7', $18, 'VMC', 'Cell-1'),
     ($8, $17, 'VC-8', $18, 'VMC', 'Cell-1'),
     ($9, $17, 'VC-9', $18, 'VMC', 'Cell-2'),
     ($10, $17, 'VC-10', $18, 'HMC', 'Cell-2'),
     ($11, $17, 'VC-11', $18, 'HMC', 'Cell-3'),
     ($12, $17, 'VC-12', $18, 'VMC', 'Cell-1'),
     ($13, $17, 'VC-13', $18, 'VMC', 'Cell-1'),
     ($14, $17, 'VC-14', $18, 'HMC', 'Cell-2'),
     ($15, $17, 'VC-15', $18, 'VMC', 'Cell-2'),
     ($16, $17, 'VC-16', $18, 'HMC', 'Cell-3')`,
    [
      MACHINE_HP,
      MACHINE_CONFLICT,
      MACHINE_IDEM,
      MACHINE_IDEM_RAISE,
      MACHINE_CONC_START,
      MACHINE_CONC_RAISE,
      MACHINE_CANCEL,
      MACHINE_CORRECT,
      MACHINE_UPGRADE,
      MACHINE_REPORT,
      MACHINE_OP_CANCEL,
      MACHINE_RACE_1,
      MACHINE_RACE_2,
      MACHINE_RACE_3,
      MACHINE_RACE_4,
      MACHINE_RACE_5,
      TENANT,
      SEGMENT,
    ],
  );
  await admin.query(
    `INSERT INTO machine (id, tenant_id, code, segment_id, category, cell) VALUES
     ($1, $5, 'VC-17', $6, 'VMC', 'Cell-1'),
     ($2, $5, 'VC-18', $6, 'VMC', 'Cell-1'),
     ($3, $5, 'VC-19', $6, 'HMC', 'Cell-2'),
     ($4, $5, 'VC-20', $6, 'HMC', 'Cell-2')`,
    [MACHINE_SEGMENTS, MACHINE_REVOKED, MACHINE_WAITING, MACHINE_GUARD, TENANT, SEGMENT],
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
  await admin.query(
    "INSERT INTO list_item (tenant_id, list, code, label, pauses_sla) VALUES ($1, 'wait_reason', 'spare', 'Spare part', false)",
    [TENANT],
  );

  app = await buildApp({ pool: db.app, logger: false, rateLimitMax: 100000 });
  ashaToken = await login('asha');
  binaToken = await login('bina');
  adminToken = await login('admin');
  opToken = await login('op');
}, 120_000);

afterAll(async () => {
  await app.close();
  await db.stop();
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

  it('deduplicates concurrent raises with one key across rounds', async () => {
    const raceMachines = [
      MACHINE_RACE_1,
      MACHINE_RACE_2,
      MACHINE_RACE_3,
      MACHINE_RACE_4,
      MACHINE_RACE_5,
    ];
    for (const machineId of raceMachines) {
      const key = `conc-raise-${machineId.slice(-4)}`;
      const payload = { machineId, problem: 'Overload race' };
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
        .open.filter((t: { machineId: string }) => t.machineId === machineId);
      expect(open).toHaveLength(1);
    }
  });

  it('cancels a working ticket and removes it from /state', async () => {
    const raised = await post('/api/v1/tickets', ashaToken, {
      machineId: MACHINE_CANCEL,
      problem: 'Unsafe to run',
    });
    expect(raised.statusCode).toBe(201);
    const id = ticketOf(raised).id as string;
    cancelledTicketId = id;
    const start = await post(`/api/v1/tickets/${id}/start`, ashaToken, { personId: ASHA });
    expect(start.statusCode).toBe(200);

    const cancel = await post(`/api/v1/tickets/${id}/cancel`, ashaToken, {
      personId: ASHA,
      reason: 'Duplicate job',
    });
    expect(cancel.statusCode).toBe(200);
    expect(cancel.json().ticket.status).toBe('cancelled');
    expect(cancel.json().ticket.cancelledAt).toBeTruthy();
    expectFigures(cancel.json().ticket);

    const detail = await get(`/api/v1/tickets/${id}`, ashaToken);
    expect(detail.json().ticket.cancelledAt).toBeTruthy();

    const state = await get('/api/v1/state', ashaToken);
    expect(state.json().open.some((t: { id: string }) => t.id === id)).toBe(false);
  });

  it('restores a cancelled ticket to its previous status', async () => {
    expect(cancelledTicketId).toBeTruthy();
    const restore = await post(`/api/v1/tickets/${cancelledTicketId}/restore`, adminToken, {
      personId: ADMIN_PERSON,
      reason: 'Wrong cancel',
    });
    expect(restore.statusCode).toBe(200);
    expect(restore.json().ticket.status).toBe('working');
    expect(restore.json().ticket.cancelledAt).toBeUndefined();
    expectFigures(restore.json().ticket);

    const detail = await get(`/api/v1/tickets/${cancelledTicketId}`, ashaToken);
    expect(detail.json().ticket.cancelledAt).toBeUndefined();
  });

  it('corrects a ticket as admin', async () => {
    const raised = await post('/api/v1/tickets', ashaToken, {
      machineId: MACHINE_CORRECT,
      problem: 'Wrong problem text',
    });
    expect(raised.statusCode).toBe(201);
    const id = ticketOf(raised).id as string;

    const correct = await post(`/api/v1/tickets/${id}/correct`, adminToken, {
      reason: 'Typo',
      changes: { problem: 'Corrected problem text' },
    });
    expect(correct.statusCode).toBe(200);
    expect(correct.json().ticket.problem).toBe('Corrected problem text');
    expectFigures(correct.json().ticket);
  });

  it('upgrades a support ticket to stopped', async () => {
    const raised = await post('/api/v1/tickets', ashaToken, {
      kind: 'support',
      machineId: MACHINE_UPGRADE,
      problem: 'Noisy bearing',
    });
    expect(raised.statusCode).toBe(201);
    expect(raised.json().ticket.kind).toBe('support');
    const id = ticketOf(raised).id as string;

    const upgrade = await post(`/api/v1/tickets/${id}/upgrade-kind`, ashaToken, {
      personId: ASHA,
    });
    expect(upgrade.statusCode).toBe(200);
    expect(upgrade.json().ticket.kind).toBe('stopped');
    expectFigures(upgrade.json().ticket);
  });

  it('files a late report on a no-report close', async () => {
    const raised = await post('/api/v1/tickets', ashaToken, {
      machineId: MACHINE_REPORT,
      problem: 'Fan noise',
    });
    expect(raised.statusCode).toBe(201);
    const id = ticketOf(raised).id as string;
    const start = await post(`/api/v1/tickets/${id}/start`, ashaToken, { personId: ASHA });
    expect(start.statusCode).toBe(200);
    const closed = await post(`/api/v1/tickets/${id}/close`, ashaToken, {
      personId: ASHA,
      kind: 'no_report',
    });
    expect(closed.statusCode).toBe(200);
    expect(closed.json().ticket.closeKind).toBe('no_report');

    const report = await post(`/api/v1/tickets/${id}/report`, ashaToken, {
      personId: ASHA,
      report: {},
    });
    expect(report.statusCode).toBe(200);
    expect(report.json().ticket.closeKind).toBe('report');
    expectFigures(report.json().ticket);
  });

  it('lets an operator cancel their own not-yet-started ticket', async () => {
    const raised = await post('/api/v1/tickets', opToken, {
      machineId: MACHINE_OP_CANCEL,
      problem: 'Raised by mistake',
    });
    expect(raised.statusCode).toBe(201);
    const id = ticketOf(raised).id as string;

    const cancel = await post(`/api/v1/tickets/${id}/cancel`, opToken, {
      personId: OPERATOR,
      reason: 'Wrong machine',
    });
    expect(cancel.statusCode).toBe(200);
    expect(cancel.json().ticket.status).toBe('cancelled');
  });
});

interface SegmentRow {
  id: string;
  person_id: string;
  role: string;
  started_at: Date;
  ended_at: Date | null;
  end_reason: string | null;
}

async function segmentRows(ticketId: string): Promise<SegmentRow[]> {
  const res = await admin.query(
    `SELECT id, person_id, role, started_at, ended_at, end_reason FROM work_segment
       WHERE ticket_id = $1 ORDER BY started_at, id`,
    [ticketId],
  );
  return res.rows as SegmentRow[];
}

async function raiseOn(machineId: string, problem: string): Promise<string> {
  const raised = await post('/api/v1/tickets', ashaToken, { machineId, problem });
  expect(raised.statusCode).toBe(201);
  return ticketOf(raised).id as string;
}

async function command(id: string, token: string, action: string, body: object): Promise<Res> {
  const res = await post(`/api/v1/tickets/${id}/${action}`, token, body);
  expect(res.statusCode, action).toBe(200);
  return res;
}

describe('history is kept', () => {
  it('keeps every work_segment id through pause and resume', async () => {
    const id = await raiseOn(MACHINE_SEGMENTS, 'Coolant leak');
    historyTicketId = id;
    await command(id, ashaToken, 'start', { personId: ASHA });
    const [first] = await segmentRows(id);
    await command(id, ashaToken, 'pause', { personId: ASHA, reasonCode: 'spare' });
    const resume = await command(id, ashaToken, 'resume', { personId: ASHA });

    const rows = await segmentRows(id);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.id).toBe(first?.id);
    expect(rows[0]?.started_at.getTime()).toBe(first?.started_at.getTime());
    expect(rows[0]?.ended_at).not.toBeNull();
    expect(rows[0]?.end_reason).toBe('pause');
    expect(rows[1]).toMatchObject({
      person_id: ASHA,
      role: 'lead',
      ended_at: null,
      end_reason: null,
    });
    expect(Object.keys(resume.json().ticket.figures.perPerson)).toEqual([ASHA]);
  });

  it('stamps the end reason of transfer, leave and close in place', async () => {
    const id = historyTicketId;
    await command(id, binaToken, 'join', { personId: BINA, role: 'support' });
    const before = await segmentRows(id);
    const ids = before.map((r) => r.id);
    await command(id, binaToken, 'leave', { personId: BINA, reason: 'All set' });
    await command(id, ashaToken, 'transfer', { personId: ASHA, note: 'Next shift' });
    await command(id, ashaToken, 'start', { personId: ASHA });
    await command(id, ashaToken, 'close', { personId: ASHA, kind: 'report' });

    const rows = await segmentRows(id);
    expect(rows.length).toBeGreaterThanOrEqual(before.length);
    for (const old of ids) expect(rows.some((r) => r.id === old)).toBe(true);
    expect(rows.map((r) => r.end_reason)).toEqual(['pause', 'transfer', 'leave', 'close']);
    expect(rows.every((r) => r.ended_at !== null)).toBe(true);
    expect(rows[2]?.person_id).toBe(BINA);
  });

  it('runs the lifecycle with DELETE on work_segment revoked', async () => {
    await admin.query('REVOKE DELETE ON work_segment FROM app_user');
    try {
      const id = await raiseOn(MACHINE_REVOKED, 'Door interlock');
      await command(id, ashaToken, 'start', { personId: ASHA });
      await command(id, binaToken, 'join', { personId: BINA, role: 'support' });
      await command(id, binaToken, 'leave', { personId: BINA, reason: 'Called away' });
      await command(id, ashaToken, 'pause', { personId: ASHA, reasonCode: 'spare' });
      await command(id, ashaToken, 'resume', { personId: ASHA });
      await command(id, ashaToken, 'transfer', { personId: ASHA, note: 'Next shift' });
      await command(id, ashaToken, 'start', { personId: ASHA });
      await command(id, ashaToken, 'cancel', { personId: ASHA, reason: 'Duplicate job' });
      await command(id, adminToken, 'restore', { personId: ADMIN_PERSON, reason: 'Wrong cancel' });
      await command(id, ashaToken, 'close', { personId: ASHA, kind: 'report' });
      const rows = await segmentRows(id);
      expect([...new Set(rows.map((r) => r.end_reason))].sort()).toEqual([
        'cancel',
        'close',
        'leave',
        'pause',
        'transfer',
      ]);
      expect(rows.every((r) => r.ended_at !== null)).toBe(true);
    } finally {
      await admin.query('GRANT DELETE ON work_segment TO app_user');
    }
  });

  it('refuses to persist fewer stretches than the ticket has, or a close without a reason', async () => {
    const run = (ticketId: string, endReason: 'close' | null, mutate: 'drop' | 'close') =>
      withTenant(db.app, TENANT, async (c) => {
        const segments = await loadSegments(c, ticketId);
        const next =
          mutate === 'drop'
            ? segments.slice(0, 1)
            : segments.map((s) => ({ ...s, endedAt: s.endedAt ?? new Date() }));
        await persistSegments(c, TENANT, ticketId, { segments: next, endReason });
      });
    const rows = await segmentRows(historyTicketId);
    expect(rows.length).toBeGreaterThan(1);
    await expect(run(historyTicketId, null, 'drop')).rejects.toThrow(
      /work_segment rows would be lost/,
    );
    expect(await segmentRows(historyTicketId)).toHaveLength(rows.length);

    const id = await raiseOn(MACHINE_GUARD, 'Chuck wear');
    await command(id, ashaToken, 'start', { personId: ASHA });
    await expect(run(id, null, 'close')).rejects.toThrow(/without an end reason/);
    expect((await segmentRows(id))[0]?.ended_at).toBeNull();
  });

  it('switches a list entry off instead of deleting it, and old tickets still resolve its label', async () => {
    const id = await raiseOn(MACHINE_WAITING, 'Pump hum');
    await command(id, ashaToken, 'start', { personId: ASHA });
    await command(id, ashaToken, 'pause', { personId: ASHA, reasonCode: 'spare' });
    const item = await admin.query(
      "SELECT id, label FROM list_item WHERE list = 'wait_reason' AND code = 'spare'",
    );
    const itemId = item.rows[0].id as string;

    const del = await app.inject({
      method: 'DELETE',
      url: `/api/v1/lists/wait_reason/${itemId}`,
      headers: { host: 'cosmos.localhost', authorization: `Bearer ${adminToken}` },
    });
    expect(del.statusCode).toBe(200);
    expect(del.json()).toEqual({ ok: true });

    const row = await admin.query('SELECT active, label FROM list_item WHERE id = $1', [itemId]);
    expect(row.rows).toEqual([{ active: false, label: item.rows[0].label }]);
    const config = await get('/api/v1/config', ashaToken);
    const entry = config.json().lists.wait_reason.find((r: { code: string }) => r.code === 'spare');
    expect(entry).toMatchObject({ active: false });
    const detail = await get(`/api/v1/tickets/${id}`, ashaToken);
    expect(detail.json().ticket.waitReason).toBe('spare');
  });
});
