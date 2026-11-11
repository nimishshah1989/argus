import { hash } from '@node-rs/argon2';
import type { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { startTestDb, type TestDb } from './harness.js';

const TENANT = '10000000-0000-0000-0000-000000000001';
const TENANT_2 = '20000000-0000-0000-0000-000000000001';
const SEGMENT = '10000000-0000-0000-0000-000000000002';
const M1 = '10000000-0000-0000-0000-000000000003';
const M2 = '10000000-0000-0000-0000-000000000004';
const M3 = '10000000-0000-0000-0000-000000000005';
const M4 = '10000000-0000-0000-0000-000000000006';
const M5 = '10000000-0000-0000-0000-000000000007';
const ASHA = '10000000-0000-0000-0000-000000000008';
const BINA = '10000000-0000-0000-0000-000000000009';
const OTHER = '20000000-0000-0000-0000-000000000002';
const LOGIN_ASHA = '10000000-0000-0000-0000-00000000000a';
const LOGIN_BINA = '10000000-0000-0000-0000-00000000000b';
const LOGIN_OTHER = '20000000-0000-0000-0000-000000000003';
const PASSWORD = 'correct-horse-battery';

const T_A = '30000000-0000-0000-0000-000000000001';
const T_B = '30000000-0000-0000-0000-000000000002';
const T_C = '30000000-0000-0000-0000-000000000003';
const T_D = '30000000-0000-0000-0000-000000000004';
const T_E = '30000000-0000-0000-0000-000000000005';
const T_F = '30000000-0000-0000-0000-000000000006';
const T_G = '30000000-0000-0000-0000-000000000007';
const T_H = '30000000-0000-0000-0000-000000000008';
const T_OTHER = '40000000-0000-0000-0000-000000000001';

type App = Awaited<ReturnType<typeof buildApp>>;
type Res = Awaited<ReturnType<App['inject']>>;

let db: TestDb;
let admin: Pool;
let app: App;
let ashaToken = '';
let otherToken = '';

function get(url: string, token?: string): Promise<Res> {
  return app.inject({
    method: 'GET',
    url,
    headers: { host: 'cosmos.localhost', ...(token ? { authorization: `Bearer ${token}` } : {}) },
  });
}

async function login(username: string, host = 'cosmos.localhost'): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    headers: { host, 'content-type': 'application/json' },
    payload: { username, password: PASSWORD },
  });
  expect(res.statusCode).toBe(200);
  return res.json().token as string;
}

async function seedTicket(opts: {
  id: string;
  ref: string;
  kind: string;
  status: string;
  machineId?: string | null;
  reportedBy?: string | null;
  lead?: string | null;
  reportedAt: string;
  updatedAt: string;
}): Promise<void> {
  await admin.query(
    `INSERT INTO ticket (id, tenant_id, ref, kind, status, machine_id, problem, reported_at, reported_by_person_id, lead_person_id, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      opts.id,
      TENANT,
      opts.ref,
      opts.kind,
      opts.status,
      opts.machineId ?? null,
      `Problem ${opts.ref}`,
      opts.reportedAt,
      opts.reportedBy ?? null,
      opts.lead ?? null,
      opts.updatedAt,
    ],
  );
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
  await admin.query("INSERT INTO tenant (id, slug, name) VALUES ($1, 'plant-two', 'Plant Two')", [
    TENANT_2,
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
    "INSERT INTO person (id, tenant_id, name, team, title) VALUES ($1, $2, 'Other', 'maintenance', 'Technician')",
    [OTHER, TENANT_2],
  );
  await admin.query(
    `INSERT INTO login (id, tenant_id, person_id, username, password_hash, role, shared) VALUES
     ($1, $3, $4, 'asha', $6, 'technician', false),
     ($2, $3, $5, 'bina', $6, 'technician', false)`,
    [LOGIN_ASHA, LOGIN_BINA, TENANT, ASHA, BINA, passwordHash],
  );
  await admin.query(
    "INSERT INTO login (id, tenant_id, person_id, username, password_hash, role, shared) VALUES ($1, $2, $3, 'other-user', $4, 'technician', false)",
    [LOGIN_OTHER, TENANT_2, OTHER, passwordHash],
  );

  await seedTicket({
    id: T_A,
    ref: 'LIST-A',
    kind: 'stopped',
    status: 'open',
    machineId: M1,
    reportedBy: ASHA,
    reportedAt: '2026-11-01T00:00:00Z',
    updatedAt: '2026-11-01T00:00:00Z',
  });
  await seedTicket({
    id: T_B,
    ref: 'LIST-B',
    kind: 'stopped',
    status: 'working',
    machineId: M2,
    reportedBy: BINA,
    lead: ASHA,
    reportedAt: '2026-11-02T00:00:00Z',
    updatedAt: '2026-11-02T00:00:00Z',
  });
  await seedTicket({
    id: T_C,
    ref: 'LIST-C',
    kind: 'support',
    status: 'closed',
    machineId: M3,
    reportedBy: ASHA,
    lead: BINA,
    reportedAt: '2026-11-03T00:00:00Z',
    updatedAt: '2026-11-03T00:00:00Z',
  });
  await seedTicket({
    id: T_D,
    ref: 'LIST-D',
    kind: 'general',
    status: 'open',
    machineId: null,
    reportedBy: ASHA,
    reportedAt: '2026-11-04T00:00:00Z',
    updatedAt: '2026-11-04T00:00:00Z',
  });
  await seedTicket({
    id: T_E,
    ref: 'LIST-E',
    kind: 'stopped',
    status: 'waiting',
    machineId: M4,
    reportedBy: BINA,
    lead: ASHA,
    reportedAt: '2026-11-05T00:00:00Z',
    updatedAt: '2026-11-05T00:00:00Z',
  });
  await seedTicket({
    id: T_F,
    ref: 'LIST-F',
    kind: 'stopped',
    status: 'working',
    machineId: M5,
    reportedBy: ASHA,
    lead: ASHA,
    reportedAt: '2026-11-06T00:00:00Z',
    updatedAt: '2026-11-06T00:00:00Z',
  });
  await seedTicket({
    id: T_G,
    ref: 'LIST-G',
    kind: 'general',
    status: 'closed',
    machineId: null,
    reportedAt: '2026-11-08T00:00:00Z',
    updatedAt: '2026-11-08T00:00:00.000400Z',
  });
  await seedTicket({
    id: T_H,
    ref: 'LIST-H',
    kind: 'general',
    status: 'closed',
    machineId: null,
    reportedAt: '2026-11-08T00:00:00Z',
    updatedAt: '2026-11-08T00:00:00.000900Z',
  });
  await admin.query(
    `INSERT INTO crew_member (id, tenant_id, ticket_id, person_id, role, joined_at)
     VALUES ($1, $2, $3, $4, 'support', now())`,
    ['30000000-0000-0000-0000-00000000000a', TENANT, T_F, BINA],
  );
  await admin.query(
    `INSERT INTO ticket (id, tenant_id, ref, kind, status, problem, reported_at, updated_at)
     VALUES ($1, $2, 'OTHER', 'stopped', 'open', 'Other tenant', '2026-11-07T00:00:00Z', '2026-11-07T00:00:00Z')`,
    [T_OTHER, TENANT_2],
  );

  app = await buildApp({ pool: db.app, logger: false, rateLimitMax: 100000 });
  ashaToken = await login('asha');
  otherToken = await login('other-user', 'plant-two.localhost');
}, 120_000);

afterAll(async () => {
  await app.close();
  await db.stop();
});

describe('ticket list', () => {
  it('returns only the tenant tickets', async () => {
    const list1 = await get('/api/v1/tickets?limit=200', ashaToken);
    expect(list1.statusCode).toBe(200);
    const ids1 = list1.json().items.map((t: { id: string }) => t.id);
    expect(ids1).toHaveLength(8);
    expect(ids1).not.toContain(T_OTHER);

    const list2 = await get('/api/v1/tickets?limit=200', otherToken);
    expect(list2.json().items.map((t: { id: string }) => t.id)).toEqual([T_OTHER]);
  });

  it('walks pages with limit + cursor without duplicates or gaps', async () => {
    const seen: string[] = [];
    let cursor: string | undefined;
    let pages = 0;
    for (;;) {
      const url = `/api/v1/tickets?limit=2${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`;
      const res = await get(url, ashaToken);
      expect(res.statusCode).toBe(200);
      const body = res.json();
      seen.push(...body.items.map((t: { ref: string }) => t.ref));
      pages += 1;
      if (!body.nextCursor) break;
      cursor = body.nextCursor as string;
    }
    expect(seen).toEqual([
      'LIST-H',
      'LIST-G',
      'LIST-F',
      'LIST-E',
      'LIST-D',
      'LIST-C',
      'LIST-B',
      'LIST-A',
    ]);
    expect(new Set(seen).size).toBe(8);
    expect(pages).toBe(4);
  });

  it('keeps sub-millisecond precision across a cursor boundary', async () => {
    const seen: string[] = [];
    let cursor: string | undefined;
    for (;;) {
      const url = `/api/v1/tickets?status=closed&kind=general&limit=1${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`;
      const res = await get(url, ashaToken);
      expect(res.statusCode).toBe(200);
      const body = res.json();
      seen.push(...body.items.map((t: { ref: string }) => t.ref));
      if (!body.nextCursor) break;
      cursor = body.nextCursor as string;
    }
    expect(seen).toEqual(['LIST-H', 'LIST-G']);
  });

  it('rejects a tampered cursor with a non-UUID id', async () => {
    const bad = Buffer.from('2026-11-06T00:00:00Z|not-a-uuid', 'utf8').toString('base64url');
    const res = await get(`/api/v1/tickets?cursor=${encodeURIComponent(bad)}`, ashaToken);
    expect(res.statusCode).toBe(422);
    expect(res.json().error.code).toBe('validation');
    expect(res.json().error.field).toBe('cursor');
  });

  it('filters by status (including comma-separated) and kind', async () => {
    const open = await get('/api/v1/tickets?status=open&limit=200', ashaToken);
    expect(open.json().items.map((t: { ref: string }) => t.ref)).toEqual(['LIST-D', 'LIST-A']);

    const multi = await get('/api/v1/tickets?status=open,working&limit=200', ashaToken);
    expect(multi.json().items.map((t: { ref: string }) => t.ref)).toEqual([
      'LIST-F',
      'LIST-D',
      'LIST-B',
      'LIST-A',
    ]);

    const stopped = await get('/api/v1/tickets?kind=stopped&limit=200', ashaToken);
    expect(stopped.json().items.map((t: { ref: string }) => t.ref)).toEqual([
      'LIST-F',
      'LIST-E',
      'LIST-B',
      'LIST-A',
    ]);
  });

  it('filters by personId as lead and as crew', async () => {
    const lead = await get(`/api/v1/tickets?personId=${ASHA}&limit=200`, ashaToken);
    expect(lead.json().items.map((t: { ref: string }) => t.ref)).toEqual([
      'LIST-F',
      'LIST-E',
      'LIST-B',
    ]);

    const crew = await get(`/api/v1/tickets?personId=${BINA}&limit=200`, ashaToken);
    expect(crew.json().items.map((t: { ref: string }) => t.ref)).toEqual(['LIST-F', 'LIST-C']);
  });

  it('filters by raisedBy, machineId and reported_at range', async () => {
    const raised = await get(`/api/v1/tickets?raisedBy=${ASHA}&limit=200`, ashaToken);
    expect(raised.json().items.map((t: { ref: string }) => t.ref)).toEqual([
      'LIST-F',
      'LIST-D',
      'LIST-C',
      'LIST-A',
    ]);

    const machine = await get(`/api/v1/tickets?machineId=${M1}&limit=200`, ashaToken);
    expect(machine.json().items.map((t: { ref: string }) => t.ref)).toEqual(['LIST-A']);

    const range = await get(
      '/api/v1/tickets?from=2026-11-03T00:00:00Z&to=2026-11-06T00:00:00Z&limit=200',
      ashaToken,
    );
    expect(range.json().items.map((t: { ref: string }) => t.ref)).toEqual([
      'LIST-E',
      'LIST-D',
      'LIST-C',
    ]);
  });

  it('populates figures.perPerson on the list, matching the detail', async () => {
    await admin.query(
      `INSERT INTO work_segment (tenant_id, ticket_id, person_id, role, started_at, ended_at) VALUES
       ($1, $2, $3, 'lead', '2026-11-06T10:00:00Z', '2026-11-06T11:00:00Z'),
       ($1, $2, $4, 'support', '2026-11-06T10:30:00Z', '2026-11-06T11:00:00Z')`,
      [TENANT, T_F, ASHA, BINA],
    );

    const list = await get('/api/v1/tickets?limit=200', ashaToken);
    const ticket = list.json().items.find((t: { id: string }) => t.id === T_F);
    expect(ticket.figures.perPerson).toEqual({ [ASHA]: 60, [BINA]: 30 });

    const detail = await get(`/api/v1/tickets/${T_F}`, ashaToken);
    expect(detail.json().ticket.figures.perPerson).toEqual({ [ASHA]: 60, [BINA]: 30 });
  });

  it('leaves figures.perPerson empty for a ticket without segments', async () => {
    const list = await get('/api/v1/tickets?limit=200', ashaToken);
    const ticket = list.json().items.find((t: { id: string }) => t.id === T_A);
    expect(ticket.figures.perPerson).toEqual({});
  });

  it('requires authentication', async () => {
    const res = await get('/api/v1/tickets');
    expect(res.statusCode).toBe(401);
  });
});
