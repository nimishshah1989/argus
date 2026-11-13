import { hash } from '@node-rs/argon2';
import { readFileSync, writeFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../src/app.js';
import {
  seedGolden,
  GOLDEN_FILE,
  GOLDEN_HOST,
  GOLDEN_NOW,
  GOLDEN_USER,
} from './fixtures/state-golden.js';
import { startTestDb, type TestDb } from './harness.js';

const TENANT = '10000000-0000-0000-0000-000000000001';
const TENANT_2 = '20000000-0000-0000-0000-000000000001';
const SEGMENT = '10000000-0000-0000-0000-000000000002';
const M1 = '10000000-0000-0000-0000-000000000003';
const M2 = '10000000-0000-0000-0000-000000000004';
const M3 = '10000000-0000-0000-0000-000000000005';
const ASHA = '10000000-0000-0000-0000-000000000006';
const BINA = '10000000-0000-0000-0000-000000000007';
const OTHER = '20000000-0000-0000-0000-000000000002';
const LOGIN_ASHA = '10000000-0000-0000-0000-000000000008';
const LOGIN_BINA = '10000000-0000-0000-0000-000000000009';
const LOGIN_OTHER = '20000000-0000-0000-0000-000000000003';
const PASSWORD = 'correct-horse-battery';

const OLD_TICKET = '10000000-0000-0000-0000-000000000010';
const OTHER_TICKET = '20000000-0000-0000-0000-000000000004';

type App = Awaited<ReturnType<typeof buildApp>>;
type Res = Awaited<ReturnType<App['inject']>>;

let db: TestDb;
let app: App;
let ashaToken = '';
let binaToken = '';

let keyCounter = 0;
function nextKey(): string {
  keyCounter += 1;
  return `req-${keyCounter}`;
}

function post(url: string, token: string, payload: unknown): Promise<Res> {
  return app.inject({
    method: 'POST',
    url,
    headers: {
      host: 'cosmos.localhost',
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
      'idempotency-key': nextKey(),
    },
    payload: payload as object,
  });
}

function get(url: string, token: string, host = 'cosmos.localhost'): Promise<Res> {
  return app.inject({
    method: 'GET',
    url,
    headers: { host, authorization: `Bearer ${token}` },
  });
}

async function login(username: string, host: string): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    headers: { host, 'content-type': 'application/json' },
    payload: { username, password: PASSWORD },
  });
  expect(res.statusCode).toBe(200);
  return res.json().token as string;
}

function ticketId(res: Res): string {
  return (res.json() as { ticket: { id: string } }).ticket.id;
}

/** Raises and starts a ticket on a machine, returning its id. */
async function raiseAndStart(machineId: string, personId: string, token: string): Promise<string> {
  const raised = await post('/api/v1/tickets', token, { machineId, problem: 'Need report' });
  expect(raised.statusCode).toBe(201);
  const id = ticketId(raised);
  const start = await post(`/api/v1/tickets/${id}/start`, token, { personId });
  expect(start.statusCode).toBe(200);
  return id;
}

beforeAll(async () => {
  db = await startTestDb();
  const passwordHash = await hash(PASSWORD, {
    algorithm: 2,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
  await db.admin.query(
    "INSERT INTO tenant (id, slug, name) VALUES ($1, 'cosmos', 'Cosmos'), ($2, 'plant-two', 'Plant Two')",
    [TENANT, TENANT_2],
  );
  await db.admin.query(
    "INSERT INTO segment (id, tenant_id, code, name, sort) VALUES ($1, $2, 'CNC', 'CNC', 0)",
    [SEGMENT, TENANT],
  );
  await db.admin.query(
    `INSERT INTO machine (id, tenant_id, code, segment_id, category, cell) VALUES
     ($1, $4, 'VC-1', $5, 'VMC', 'Cell-1'),
     ($2, $4, 'VC-2', $5, 'VMC', 'Cell-1'),
     ($3, $4, 'VC-3', $5, 'HMC', 'Cell-2')`,
    [M1, M2, M3, TENANT, SEGMENT],
  );
  await db.admin.query(
    `INSERT INTO person (id, tenant_id, name, team) VALUES
     ($1, $3, 'Asha', 'maintenance'), ($2, $3, 'Bina', 'maintenance')`,
    [ASHA, BINA, TENANT],
  );
  await db.admin.query(
    "INSERT INTO person (id, tenant_id, name, team) VALUES ($1, $2, 'Other', 'maintenance')",
    [OTHER, TENANT_2],
  );
  await db.admin.query(
    `INSERT INTO login (id, tenant_id, person_id, username, password_hash, role, shared) VALUES
     ($1, $3, $4, 'asha', $6, 'technician', false),
     ($2, $3, $5, 'bina', $6, 'technician', false)`,
    [LOGIN_ASHA, LOGIN_BINA, TENANT, ASHA, BINA, passwordHash],
  );
  await db.admin.query(
    "INSERT INTO login (id, tenant_id, person_id, username, password_hash, role, shared) VALUES ($1, $2, $3, 'other-user', $4, 'technician', false)",
    [LOGIN_OTHER, TENANT_2, OTHER, passwordHash],
  );
  await db.admin.query(
    "INSERT INTO ref_counter (tenant_id, prefix, next_value) VALUES ($1, 'BD', 150)",
    [TENANT],
  );

  await seedGolden(db.admin, passwordHash);

  app = await buildApp({ pool: db.app, logger: false, rateLimitMax: 100000 });
  ashaToken = await login('asha', 'cosmos.localhost');
  binaToken = await login('bina', 'cosmos.localhost');
}, 120_000);

afterAll(async () => {
  await app.close();
  await db.stop();
});

describe('state needReport', () => {
  it('keeps open tickets in open and excludes a reported close', async () => {
    const openId = await raiseAndStart(M3, ASHA, ashaToken);
    const closedId = await raiseAndStart(M2, ASHA, ashaToken);
    await post(`/api/v1/tickets/${closedId}/close`, ashaToken, {
      personId: ASHA,
      kind: 'report',
      report: {},
    });

    const state = await get('/api/v1/state', ashaToken);
    const body = state.json();
    expect(body.open.map((t: { id: string }) => t.id)).toContain(openId);
    expect(body.needReport.map((t: { id: string }) => t.id)).not.toContain(closedId);
  });

  it('includes a fresh no-report close in needReport', async () => {
    const id = await raiseAndStart(M1, ASHA, ashaToken);
    await post(`/api/v1/tickets/${id}/close`, ashaToken, { personId: ASHA, kind: 'no_report' });

    const state = await get('/api/v1/state', ashaToken);
    const refs = state.json().needReport.map((t: { id: string }) => t.id);
    expect(refs).toContain(id);
  });

  it('excludes a no-report close older than 7 days', async () => {
    await db.admin.query(
      `INSERT INTO ticket (id, tenant_id, ref, kind, status, problem, reported_at, closed_at, close_kind, closed_by_person_id, severity)
       VALUES ($1, $2, 'NEED-OLD', 'stopped', 'closed', 'Old', now() - interval '8 days', now() - interval '8 days', 'no_report', $3, 'S3')`,
      [OLD_TICKET, TENANT, ASHA],
    );
    const state = await get('/api/v1/state', ashaToken);
    const refs = state.json().needReport.map((t: { id: string }) => t.id);
    expect(refs).not.toContain(OLD_TICKET);
  });

  it('excludes another tenant no-report close and scopes to the acting person', async () => {
    await db.admin.query(
      `INSERT INTO ticket (id, tenant_id, ref, kind, status, problem, reported_at, closed_at, close_kind, closed_by_person_id, severity)
       VALUES ($1, $2, 'NEED-OTHER', 'stopped', 'closed', 'Other', now() - interval '1 day', now() - interval '1 day', 'no_report', $3, 'S3')`,
      [OTHER_TICKET, TENANT_2, OTHER],
    );
    const state = await get('/api/v1/state', ashaToken);
    const refs = state.json().needReport.map((t: { id: string }) => t.id);
    expect(refs).not.toContain(OTHER_TICKET);
  });

  it('scopes needs-report to the acting person', async () => {
    const asha = await get('/api/v1/state', ashaToken);
    const ashaIds = asha.json().needReport.map((t: { id: string }) => t.id);

    const bina = await get('/api/v1/state', binaToken);
    const binaIds = bina.json().needReport.map((t: { id: string }) => t.id);

    // Asha closed the fresh no-report ticket in the second test, so she sees it; Bina was not
    // on the ticket and does not.
    expect(ashaIds.length).toBeGreaterThan(0);
    expect(binaIds).toEqual([]);
  });

  it('shows a no-report ticket to its lead even when another person closed it', async () => {
    const leadTicket = '10000000-0000-0000-0000-000000000011';
    await db.admin.query(
      `INSERT INTO ticket (id, tenant_id, ref, kind, status, problem, reported_at, closed_at, close_kind, lead_person_id, closed_by_person_id, severity)
       VALUES ($1, $2, 'NEED-LEAD', 'stopped', 'closed', 'Lead', now() - interval '1 day', now() - interval '1 day', 'no_report', $3, $4, 'S3')`,
      [leadTicket, TENANT, ASHA, BINA],
    );
    const state = await get('/api/v1/state', ashaToken);
    const refs = state.json().needReport.map((t: { id: string }) => t.id);
    expect(refs).toContain(leadTicket);
  });
});

describe('state golden', () => {
  it('answers /state byte for byte as before', async () => {
    const token = await login(GOLDEN_USER, GOLDEN_HOST);
    vi.useFakeTimers({ toFake: ['Date'], now: new Date(GOLDEN_NOW) });
    let res: Res;
    try {
      res = await get('/api/v1/state', token, GOLDEN_HOST);
    } finally {
      vi.useRealTimers();
    }
    expect(res.statusCode).toBe(200);
    if (process.env.WRITE_GOLDEN === '1') {
      writeFileSync(GOLDEN_FILE, JSON.stringify(JSON.parse(res.body), null, 2) + '\n');
    }
    expect(res.body).toBe(JSON.stringify(JSON.parse(readFileSync(GOLDEN_FILE, 'utf8'))));
  });
});
