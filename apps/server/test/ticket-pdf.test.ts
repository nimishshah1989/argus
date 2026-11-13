import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chmodSync, existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { hash } from '@node-rs/argon2';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../src/app.js';
import { buildQrPayload, qrSvg, qrText } from '../src/modules/reports/pdf.js';
import { renderReportHtml, type ReportPdfInput } from '../src/modules/reports/pdf-template.js';
import { installJobSchema } from '../../../packages/db/src/install-jobs.js';
import { tolerateShutdown } from './harness.js';

// Records every QR payload the route builds, so the test can read what the PDF's QR carries.
const { qrPayloads } = vi.hoisted(() => ({ qrPayloads: [] as unknown[] }));
vi.mock('../src/modules/reports/pdf.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/modules/reports/pdf.js')>();
  return {
    ...actual,
    qrText: (payload: Parameters<typeof actual.qrText>[0]) => {
      qrPayloads.push(payload);
      return actual.qrText(payload);
    },
  };
});

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
let beginPoolShutdown: () => void;
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
  beginPoolShutdown = tolerateShutdown(pool);
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
  beginPoolShutdown();
  await app.close();
  await pool.end();
  await container.stop();
  await rm(filesDir, { recursive: true, force: true });
});

describe('breakdown report PDF', () => {
  it('answers with the PDF itself and stores nothing, however often it is asked', async () => {
    const id = await raiseWithReport(M1, 'સ્પિન્ડલ બેરિંગ બદલવું પડ્યું');
    const res = await get(`/api/v1/tickets/${id}/pdf`, ashaToken);
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
    const ticket = (await pool.query('SELECT ref FROM ticket WHERE id = $1', [id])).rows[0];
    expect(res.headers['content-disposition']).toContain(`${ticket.ref}.pdf`);
    expect(res.rawPayload.subarray(0, 5).toString()).toBe('%PDF-');
    expect(res.rawPayload.length).toBeGreaterThan(5000);

    // A second tap makes no row and no file: nothing to lose on a deploy, nothing growing.
    expect((await get(`/api/v1/tickets/${id}/pdf`, ashaToken)).statusCode).toBe(200);
    const files = await pool.query('SELECT 1 FROM file WHERE ticket_id = $1', [id]);
    expect(files.rows).toHaveLength(0);
    expect(readdirSync(filesDir)).toEqual([]);

    // The QR the platform imports carries this report's own numbers and names.
    expect(qrPayloads.at(-1)).toMatchObject({
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

  it('answers 503 with Retry-After when more reports are asked for than the queue holds', async () => {
    const id = await raiseWithReport(M1, 'Busy day');
    // A stand-in Chromium that holds its render until the test says go, so the queue fills for certain.
    const release = join(filesDir, 'release');
    const fake = join(filesDir, 'slow-chromium.sh');
    writeFileSync(
      fake,
      `#!/bin/bash
for arg in "$@"; do case "$arg" in --print-to-pdf=*) out="\${arg#--print-to-pdf=}";; esac; done
while [ ! -e "${release}" ]; do sleep 0.05; done
printf '%%PDF-1.4 stand-in' > "$out"
`,
    );
    chmodSync(fake, 0o755);
    const slowApp = await buildApp({
      pool,
      logger: false,
      rateLimitMax: 100000,
      chromiumPath: fake,
    });
    try {
      const replies: Res[] = [];
      const calls = Array.from({ length: 6 }, () =>
        slowApp
          .inject({
            method: 'GET',
            url: `/api/v1/tickets/${id}/pdf`,
            headers: { host: 'cosmos.localhost', authorization: `Bearer ${ashaToken}` },
          })
          .then((res) => replies.push(res)),
      );
      // One render runs, three wait: the other two callers are told to come back, at once.
      for (let i = 0; i < 200 && replies.length < 2; i += 1) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      expect(replies.map((res) => res.statusCode)).toEqual([503, 503]);
      expect(replies[0]?.headers['retry-after']).toBe('5');
      expect(replies[0]?.json().error.code).toBe('rate_limited');
      writeFileSync(release, '');
      await Promise.all(calls);
      expect(replies.slice(2).map((res) => res.statusCode)).toEqual([200, 200, 200, 200]);
      expect(existsSync(release)).toBe(true);
    } finally {
      writeFileSync(release, '');
      await slowApp.close();
    }
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
