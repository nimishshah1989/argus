import { hash } from '@node-rs/argon2';
import type { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { startTestDb, type TestDb } from './harness.js';

const TENANT = '10000000-0000-0000-0000-000000000001';
const SEGMENT = '10000000-0000-0000-0000-000000000002';
const M1 = '10000000-0000-0000-0000-000000000003';
const M2 = '10000000-0000-0000-0000-000000000004';
const M3 = '10000000-0000-0000-0000-000000000005';
const M4 = '10000000-0000-0000-0000-000000000006';
const M5 = '10000000-0000-0000-0000-000000000007';
const ASHA = '10000000-0000-0000-0000-000000000008';
const BINA = '10000000-0000-0000-0000-000000000009';
const LOGIN_ASHA = '10000000-0000-0000-0000-00000000000a';
const LOGIN_BINA = '10000000-0000-0000-0000-00000000000b';
const PASSWORD = 'correct-horse-battery';

type App = Awaited<ReturnType<typeof buildApp>>;
type Res = Awaited<ReturnType<App['inject']>>;

let db: TestDb;
let admin: Pool;
let app: App;
let ashaToken = '';

let keyCounter = 0;
function nextKey(): string {
  keyCounter += 1;
  return `req-${keyCounter}`;
}

function post(url: string, token: string, payload: unknown, idem?: string): Promise<Res> {
  return app.inject({
    method: 'POST',
    url,
    headers: {
      host: 'cosmos.localhost',
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
      'idempotency-key': idem ?? nextKey(),
    },
    payload: payload as object,
  });
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

interface TicketBody {
  id?: string;
  [key: string]: unknown;
}

function ticketOf(res: Res): TicketBody {
  const body = res.json() as { ticket?: TicketBody };
  expect(body.ticket, 'expected the response to wrap a ticket as {ticket}').toBeTruthy();
  return body.ticket as TicketBody;
}

/** Raises + starts a stopped ticket, returning its id. */
async function raiseAndStart(machineId: string): Promise<string> {
  const raised = await post('/api/v1/tickets', ashaToken, { machineId, problem: 'Report problem' });
  expect(raised.statusCode).toBe(201);
  const id = ticketOf(raised).id as string;
  const start = await post(`/api/v1/tickets/${id}/start`, ashaToken, { personId: ASHA });
  expect(start.statusCode).toBe(200);
  return id;
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
     ($1, $6, 'VC-1', $7, 'VMC', 'Cell-1'),
     ($2, $6, 'VC-2', $7, 'VMC', 'Cell-1'),
     ($3, $6, 'VC-3', $7, 'HMC', 'Cell-2'),
     ($4, $6, 'VC-4', $7, 'VMC', 'Cell-2'),
     ($5, $6, 'VC-5', $7, 'HMC', 'Cell-3')`,
    [M1, M2, M3, M4, M5, TENANT, SEGMENT],
  );
  await admin.query(
    `INSERT INTO person (id, tenant_id, name, team, title) VALUES
     ($1, $3, 'Asha', 'maintenance', 'Technician'),
     ($2, $3, 'Bina', 'maintenance', 'Technician')`,
    [ASHA, BINA, TENANT],
  );
  await admin.query(
    `INSERT INTO login (id, tenant_id, person_id, username, password_hash, role, shared) VALUES
     ($1, $3, $4, 'asha', $6, 'technician', false),
     ($2, $3, $5, 'bina', $6, 'technician', false)`,
    [LOGIN_ASHA, LOGIN_BINA, TENANT, ASHA, BINA, passwordHash],
  );
  await admin.query(
    `INSERT INTO shift (tenant_id, code, name, starts_at, ends_at, crosses_midnight) VALUES
     ($1, '1', 'Shift 1', '08:00', '18:30', false),
     ($1, '2', 'Shift 2', '18:29', '05:00', true)`,
    [TENANT],
  );
  await admin.query(
    "INSERT INTO ref_counter (tenant_id, prefix, next_value) VALUES ($1, 'BD', 150)",
    [TENANT],
  );

  app = await buildApp({ pool: db.app, logger: false, rateLimitMax: 100000 });
  ashaToken = await login('asha');
}, 120_000);

afterAll(async () => {
  await app.close();
  await db.stop();
});

describe('breakdown report', () => {
  it('stores one report with people and returns it from detail', async () => {
    const id = await raiseAndStart(M1);
    const close = await post(`/api/v1/tickets/${id}/close`, ashaToken, {
      personId: ASHA,
      kind: 'report',
      report: {
        problem: 'Fixed spindle',
        observedBy: 'Operator',
        correctiveAction: 'Replaced bearing',
        doneByPersonIds: [ASHA],
        supportedByPersonIds: [BINA],
        downtimeMin: 45,
        responseMin: 10,
        repairMin: 35,
        breakdownCategory: 'M',
        failureComponent: 'SP',
        spareUsed: 'Bearing',
        rootCause: 'Wear',
        handoverName: 'Next shift',
        date: '2026-11-10',
        shiftCode: '1',
      },
    });
    expect(close.statusCode).toBe(200);

    const reports = await admin.query('SELECT * FROM breakdown_report WHERE ticket_id = $1', [id]);
    expect(reports.rows).toHaveLength(1);
    const people = await admin.query('SELECT * FROM breakdown_report_person WHERE report_id = $1', [
      reports.rows[0].id,
    ]);
    expect(people.rows).toHaveLength(2);

    const detail = await get(`/api/v1/tickets/${id}`, ashaToken);
    const stored = detail.json().report;
    expect(stored).toBeTruthy();
    expect(stored.problem).toBe('Fixed spindle');
    expect(stored.downtimeMin).toBe(45);
    expect(stored.breakdownCategory).toBe('M');
    const roles = stored.people
      .map((p: { personId: string; role: string }) => `${p.personId}:${p.role}`)
      .sort();
    expect(roles).toEqual([`${ASHA}:done`, `${BINA}:supported`].sort());
  });

  it('applies defaults when report fields are omitted', async () => {
    const id = await raiseAndStart(M2);
    const close = await post(`/api/v1/tickets/${id}/close`, ashaToken, {
      personId: ASHA,
      kind: 'report',
      report: { failureComponent: 'E' },
    });
    expect(close.statusCode).toBe(200);

    const detail = await get(`/api/v1/tickets/${id}`, ashaToken);
    const stored = detail.json().report;
    const figures = detail.json().ticket.figures;
    expect(stored.problem).toBe('Report problem');
    expect(stored.people).toEqual([{ personId: ASHA, role: 'done' }]);
    expect(stored.downtimeMin).toBe(figures.downtimeMin);
    expect(typeof stored.shiftCode).toBe('string');
  });

  it('stores a late report and flips closeKind to report', async () => {
    const id = await raiseAndStart(M3);
    const closed = await post(`/api/v1/tickets/${id}/close`, ashaToken, {
      personId: ASHA,
      kind: 'no_report',
    });
    expect(closed.statusCode).toBe(200);

    const late = await post(`/api/v1/tickets/${id}/report`, ashaToken, {
      personId: ASHA,
      report: { problem: 'Late report', downtimeMin: 30, failureComponent: 'E' },
    });
    expect(late.statusCode).toBe(200);
    expect(late.json().ticket.closeKind).toBe('report');

    const detail = await get(`/api/v1/tickets/${id}`, ashaToken);
    expect(detail.json().report.problem).toBe('Late report');
    expect(detail.json().report.downtimeMin).toBe(30);
  });

  it('rejects a bad category, negative minutes and unknown person with 422', async () => {
    const id = await raiseAndStart(M4);

    const badCategory = await post(`/api/v1/tickets/${id}/close`, ashaToken, {
      personId: ASHA,
      kind: 'report',
      report: { breakdownCategory: 'X', failureComponent: 'E' },
    });
    expect(badCategory.statusCode).toBe(422);

    const negative = await post(`/api/v1/tickets/${id}/close`, ashaToken, {
      personId: ASHA,
      kind: 'report',
      report: { downtimeMin: -5, failureComponent: 'E' },
    });
    expect(negative.statusCode).toBe(422);

    const unknown = await post(`/api/v1/tickets/${id}/close`, ashaToken, {
      personId: ASHA,
      kind: 'report',
      report: {
        doneByPersonIds: ['ffffffff-ffff-ffff-ffff-ffffffffffff'],
        failureComponent: 'E',
      },
    });
    expect(unknown.statusCode).toBe(422);
    expect(unknown.json().error.field).toBe('doneByPersonIds');

    // The unknown-person close rolled back, so the ticket is still working.
    const detail = await get(`/api/v1/tickets/${id}`, ashaToken);
    expect(detail.json().ticket.status).toBe('working');
  });

  it('refuses a kind:report close with no report body, leaving the breakdown uncoded and unclosed', async () => {
    const id = await raiseAndStart(M5);
    const close = await post(`/api/v1/tickets/${id}/close`, ashaToken, {
      personId: ASHA,
      kind: 'report',
    });
    expect(close.statusCode).toBe(422);
    expect(close.json().error).toMatchObject({
      code: 'validation',
      message: 'A report is required to close a breakdown',
      field: 'report',
    });

    const detail = await get(`/api/v1/tickets/${id}`, ashaToken);
    expect(detail.json().ticket.status).toBe('working');
    expect(detail.json().report).toBeNull();
    // A no-report close records no report and is exempt, so the machine is free for the next case.
    expect(
      (
        await post(`/api/v1/tickets/${id}/close`, ashaToken, {
          personId: ASHA,
          kind: 'no_report',
        })
      ).statusCode,
    ).toBe(200);
  });

  it('records the handover as a person link, and replies show that person’s name as the handover', async () => {
    const id = await raiseAndStart(M1);
    const close = await post(`/api/v1/tickets/${id}/close`, ashaToken, {
      personId: ASHA,
      kind: 'report',
      report: { handoverPersonId: BINA, failureComponent: 'E' },
    });
    expect(close.statusCode).toBe(200);
    const stored = (await get(`/api/v1/tickets/${id}`, ashaToken)).json().report;
    expect(stored.handoverPersonId).toBe(BINA);
    expect(stored.handoverName).toBe('Bina');
    const typed = await admin.query(
      'SELECT handover_name FROM breakdown_report WHERE ticket_id = $1',
      [id],
    );
    expect(typed.rows[0].handover_name).toBeNull();
    // The name follows the person row: after an erasure it reads "Former staff".
    await admin.query("UPDATE person SET name = 'Former staff' WHERE id = $1", [BINA]);
    const erased = (await get(`/api/v1/tickets/${id}`, ashaToken)).json().report;
    expect(erased.handoverName).toBe('Former staff');
    expect(erased.handoverPersonId).toBe(BINA);
    await admin.query("UPDATE person SET name = 'Bina' WHERE id = $1", [BINA]);
  });

  it('refuses a handover given both as a person and as typed text', async () => {
    const id = await raiseAndStart(M5);
    const both = await post(`/api/v1/tickets/${id}/close`, ashaToken, {
      personId: ASHA,
      kind: 'report',
      report: { handoverPersonId: BINA, handoverName: 'typed as well', failureComponent: 'E' },
    });
    expect(both.statusCode).toBe(422);
    expect(both.json().error.field).toBe('handoverName');
  });

  it('keeps a typed handover as text when no person is given, as imported history has it', async () => {
    const id = await raiseAndStart(M2);
    const close = await post(`/api/v1/tickets/${id}/close`, ashaToken, {
      personId: ASHA,
      kind: 'report',
      report: { handoverName: 'Night crew', failureComponent: 'E' },
    });
    expect(close.statusCode).toBe(200);
    const stored = (await get(`/api/v1/tickets/${id}`, ashaToken)).json().report;
    expect(stored.handoverPersonId).toBeNull();
    expect(stored.handoverName).toBe('Night crew');
  });

  it('refuses a handover to someone who is not in this plant', async () => {
    const id = await raiseAndStart(M3);
    const refused = await post(`/api/v1/tickets/${id}/close`, ashaToken, {
      personId: ASHA,
      kind: 'report',
      report: {
        handoverPersonId: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
        failureComponent: 'E',
      },
    });
    expect(refused.statusCode).toBe(422);
    expect(refused.json().error.field).toBe('handoverPersonId');
  });
});
