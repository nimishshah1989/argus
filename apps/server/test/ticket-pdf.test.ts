import { createHash, randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readdirSync, readFileSync } from 'node:fs';
import { hash } from '@node-rs/argon2';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { buildQrPayload, qrSvg, qrText } from '../src/pdf.js';
import { renderReportHtml, type ReportPdfInput } from '../src/pdf-template.js';
import { installJobSchema } from '../../../packages/db/src/install-jobs.js';

const TENANT = '10000000-0000-0000-0000-000000000001';
const SEGMENT = '10000000-0000-0000-0000-000000000002';
const M1 = '10000000-0000-0000-0000-000000000003';
const M2 = '10000000-0000-0000-0000-000000000004';
const ASHA = '10000000-0000-0000-0000-000000000005';
const BINA = '10000000-0000-0000-0000-000000000006';
const LOGIN_ASHA = '10000000-0000-0000-0000-000000000007';
const TENANT_2 = '20000000-0000-0000-0000-000000000001';
const PERSON_2 = '20000000-0000-0000-0000-000000000002';
const LOGIN_2 = '20000000-0000-0000-0000-000000000003';
const TICKET_2 = '20000000-0000-0000-0000-000000000004';
const PASSWORD = 'correct-horse-battery';

type App = Awaited<ReturnType<typeof buildApp>>;
type Res = Awaited<ReturnType<App['inject']>>;

let container: StartedPostgreSqlContainer;
let pool: Pool;
let app: App;
let filesDir = '';
let ashaToken = '';
let tenant2Token = '';

let keyCounter = 0;
function nextKey(): string {
  keyCounter += 1;
  return `pdf-${keyCounter}`;
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

function get(url: string, token?: string): Promise<Res> {
  const headers: Record<string, string> = { host: 'cosmos.localhost' };
  if (token) headers.authorization = `Bearer ${token}`;
  return app.inject({ method: 'GET', url, headers });
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

/** Raises + starts a stopped ticket, closes it with a report, returning the ticket id. */
async function raiseWithReport(machineId: string, problem: string): Promise<string> {
  const raised = await post('/api/v1/tickets', ashaToken, { machineId, problem: 'PDF problem' });
  expect(raised.statusCode).toBe(201);
  const id = raised.json().ticket.id as string;
  await post(`/api/v1/tickets/${id}/start`, ashaToken, { personId: ASHA });
  const close = await post(`/api/v1/tickets/${id}/close`, ashaToken, {
    personId: ASHA,
    kind: 'report',
    report: {
      problem,
      observedBy: 'Operator',
      correctiveAction: 'Replaced bearing',
      doneByPersonIds: [ASHA],
      supportedByPersonIds: [BINA],
      downtimeMin: 45,
      responseMin: 10,
      repairMin: 35,
      breakdownCategory: 'M',
      maintCode: 'SP',
      spareUsed: 'Bearing',
      rootCause: 'Wear',
      handoverName: 'Next shift',
      date: '2026-11-10',
      shiftCode: '1',
    },
  });
  expect(close.statusCode).toBe(200);
  return id;
}

function qrFixture(): ReportPdfInput {
  return {
    tenant: { name: 'Cosmos', language: 'gu', timeZone: 'Asia/Kolkata' },
    ticket: {
      id: M1,
      ref: 'BD-150',
      kind: 'stopped',
      status: 'closed',
      problem: 'સ્પિન્ડલ બેરિંગ બદલવું પડ્યું',
      reportedAt: new Date('2026-11-10T04:00:00Z'),
      closedAt: new Date('2026-11-10T05:00:00Z'),
      figures: {
        responseMin: 10,
        activeMin: 40,
        waitMin: 5,
        vendorMin: 0,
        handoverWaitMin: 0,
        downAccMin: 45,
        downtimeMin: 45,
        followMin: null,
        repairMin: 35,
        perPerson: {},
      },
      machine: { code: 'VC-1', category: 'VMC', cell: 'Cell-1' },
    },
    report: {
      id: '30000000-0000-0000-0000-000000000001',
      ticketId: '30000000-0000-0000-0000-000000000002',
      machineId: M1,
      date: '2026-11-10',
      shiftCode: '1',
      problem: 'સ્પિન્ડલ બેરિંગ બદલવું પડ્યું',
      observedBy: 'Operator',
      correctiveAction: 'Replaced bearing',
      downtimeMin: 45,
      responseMin: 10,
      repairMin: 35,
      breakdownCategory: 'M',
      maintCode: 'SP',
      spareUsed: 'Bearing',
      rootCause: 'Wear',
      handoverName: 'Next shift',
      submittedByPersonId: ASHA,
      submittedAt: new Date('2026-11-10T05:00:00Z'),
      people: [
        { personId: ASHA, role: 'done' },
        { personId: BINA, role: 'supported' },
      ],
    },
    people: { done: ['Asha'], supported: ['Bina'] },
    qr: { svg: '<svg></svg>' },
    generatedAt: new Date('2026-11-10T05:30:00Z'),
  };
}

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:16-alpine').start();
  pool = new Pool({ connectionString: container.getConnectionUri(), max: 5 });
  // Apply every migration in order (the same rule as the shared harness), so a new
  // migration never silently breaks this suite.
  const migrations = new URL('../../../packages/db/migrations/', import.meta.url);
  for (const name of readdirSync(migrations)
    .filter((file) => file.endsWith('.sql'))
    .sort()) {
    await pool.query(readFileSync(new URL(name, migrations), 'utf8'));
  }
  await installJobSchema(pool);
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
     ($1, $3, 'VC-1', $4, 'VMC', 'Cell-1'),
     ($2, $3, 'VC-2', $4, 'VMC', 'Cell-1')`,
    [M1, M2, TENANT, SEGMENT],
  );
  await pool.query(
    `INSERT INTO person (id, tenant_id, name, team, title) VALUES
     ($1, $3, 'Asha', 'maintenance', 'Technician'),
     ($2, $3, 'Bina', 'maintenance', 'Technician')`,
    [ASHA, BINA, TENANT],
  );
  await pool.query(
    `INSERT INTO login (id, tenant_id, person_id, username, password_hash, role, shared) VALUES
     ($1, $2, $3, 'asha', $4, 'technician', false)`,
    [LOGIN_ASHA, TENANT, ASHA, passwordHash],
  );
  await pool.query(
    `INSERT INTO shift (tenant_id, code, name, starts_at, ends_at, crosses_midnight) VALUES
     ($1, '1', 'Shift 1', '08:00', '18:30', false)`,
    [TENANT],
  );
  await pool.query(
    "INSERT INTO ref_counter (tenant_id, prefix, next_value) VALUES ($1, 'BD', 150)",
    [TENANT],
  );

  // A second tenant to prove the PDF route is tenant-scoped.
  await pool.query("INSERT INTO tenant (id, slug, name) VALUES ($1, 'plant-two', 'Plant Two')", [
    TENANT_2,
  ]);
  await pool.query(
    "INSERT INTO person (id, tenant_id, name, team) VALUES ($1, $2, 'Other tech', 'maintenance')",
    [PERSON_2, TENANT_2],
  );
  await pool.query(
    `INSERT INTO login (id, tenant_id, person_id, username, password_hash, role, shared) VALUES
     ($1, $2, $3, 'other', $4, 'technician', false)`,
    [LOGIN_2, TENANT_2, PERSON_2, passwordHash],
  );
  await pool.query(
    "INSERT INTO ticket (id, tenant_id, ref, kind, status, problem, reported_at, severity) VALUES ($1, $2, 'BD-9999', 'stopped', 'open', 'Other tenant', now(), 'S3')",
    [TICKET_2, TENANT_2],
  );

  filesDir = await mkdtemp(join(tmpdir(), 'uptimo-pdf-test-'));
  app = await buildApp({ pool, logger: false, rateLimitMax: 100000, filesDir });
  ashaToken = await login('asha');
  tenant2Token = await login('other', 'plant-two.localhost');
}, 120_000);

afterAll(async () => {
  await app.close();
  await pool.end();
  await container.stop();
  await rm(filesDir, { recursive: true, force: true });
});

describe('breakdown report PDF', () => {
  it('renders one stored PDF for the ticket and links it from the report', async () => {
    const id = await raiseWithReport(M1, 'સ્પિન્ડલ બેરિંગ બદલવું પડ્યું');
    const res = await get(`/api/v1/tickets/${id}/pdf`, ashaToken);
    expect(res.statusCode).toBe(200);
    const body = res.json() as { fileId: string; url: string };
    expect(body.fileId).toMatch(/^[0-9a-f-]{36}$/);
    expect(body.url).toBe(`/api/v1/files/${body.fileId}`);

    const files = await pool.query('SELECT * FROM file WHERE ticket_id = $1', [id]);
    expect(files.rows).toHaveLength(1);
    const file = files.rows[0];
    expect(file.kind).toBe('pdf');
    expect(file.mime).toBe('application/pdf');
    const bytes = await readFile(join(filesDir, file.s3_key as string));
    expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
    expect(bytes.length).toBeGreaterThan(5000);
    expect(Number(file.bytes)).toBe(bytes.length);
    expect(file.sha256).toBe(createHash('sha256').update(bytes).digest('hex'));

    const reports = await pool.query(
      'SELECT pdf_file_id, qr_payload FROM breakdown_report WHERE ticket_id = $1',
      [id],
    );
    const ticket = (await pool.query('SELECT ref FROM ticket WHERE id = $1', [id])).rows[0];
    expect(reports.rows[0].pdf_file_id).toBe(body.fileId);
    expect(reports.rows[0].qr_payload).toMatchObject({
      v: 1,
      mid: M1,
      d: '2026-11-10',
      sh: '1',
      tk: ticket.ref,
      db: 'Asha',
      sb: 'Bina',
      bc: 'M',
      dm: 45,
    });
  });

  it('builds the v1 QR payload and embeds the QR in the template', async () => {
    const payload = buildQrPayload({
      machineId: M1,
      date: '2026-11-10',
      shiftCode: '1',
      problem: 'x'.repeat(2000),
      observedBy: null,
      correctiveAction: 'y'.repeat(2000),
      doneBy: 'Asha',
      supportedBy: 'Bina',
      downtimeMin: 45,
      maintCode: 'SP',
      breakdownCategory: 'M',
      spareUsed: 'Bearing',
      kind: 'stopped',
      ref: 'BD-150',
      responseMin: 10,
      repairMin: 35,
    });
    expect(Object.keys(payload)).toEqual([
      'v',
      'mid',
      'd',
      'sh',
      'pr',
      'ob',
      'ca',
      'db',
      'sb',
      'dm',
      'mc',
      'bc',
      'sp',
      'ty',
      'tk',
      'rs',
      'rp',
    ]);
    const text = qrText(payload);
    expect(text).toMatch(/^[\x20-\x7e]+$/);
    expect(text.length).toBeLessThanOrEqual(650);
    const parsed = JSON.parse(text) as { pr: string; v: number };
    expect(parsed.v).toBe(1);
    expect(parsed.pr.length).toBeLessThan(2000);

    const svg = await qrSvg(text);
    expect(svg).toContain('<svg');
    const html = renderReportHtml({ ...qrFixture(), qr: { svg } });
    expect(html).toContain('<svg');
    expect(html).toContain('class="qr"');
    expect(html).toContain('Scan to import into the platform');
    expect(html).toContain('VC-1');
    expect(html).toContain('Replaced bearing');
  });

  it('refuses a ticket without a report', async () => {
    const raised = await post('/api/v1/tickets', ashaToken, {
      machineId: M2,
      problem: 'No report',
    });
    const id = raised.json().ticket.id as string;
    await post(`/api/v1/tickets/${id}/start`, ashaToken, { personId: ASHA });
    const close = await post(`/api/v1/tickets/${id}/close`, ashaToken, {
      personId: ASHA,
      kind: 'no_report',
    });
    expect(close.statusCode).toBe(200);

    const res = await get(`/api/v1/tickets/${id}/pdf`, ashaToken);
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('conflict');
  });

  it('returns 404 for an unknown ticket and for another tenant', async () => {
    const unknown = await get(`/api/v1/tickets/${randomUUID()}/pdf`, ashaToken);
    expect(unknown.statusCode).toBe(404);

    const id = await raiseWithReport(M2, 'Cross tenant target');
    const otherTenant = await get(`/api/v1/tickets/${id}/pdf`, tenant2Token);
    expect(otherTenant.statusCode).toBe(404);

    const ownTenant = await get(`/api/v1/tickets/${TICKET_2}/pdf`, ashaToken);
    expect(ownTenant.statusCode).toBe(404);
  });

  it('requires authentication', async () => {
    const res = await get(`/api/v1/tickets/${randomUUID()}/pdf`);
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('unauthenticated');
  });
});
