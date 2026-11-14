import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { hash } from '@node-rs/argon2';
import { withTenant } from '@uptimo/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { loadDayReport, type DayReportData } from '../src/modules/reports/day-report.js';
import { renderDayReportHtml } from '../src/modules/reports/day-report-template.js';
import { resolveChromium } from '../src/modules/reports/pdf.js';
import { pdfShows } from './pdf-text.js';
import { startTestDb, type TestDb } from './harness.js';

const TENANT = '10000000-0000-0000-0000-000000000001';
const SEGMENT = '10000000-0000-0000-0000-000000000002';
const M1 = '10000000-0000-0000-0000-000000000003';
const M2 = '10000000-0000-0000-0000-000000000004';
const ASHA = '10000000-0000-0000-0000-000000000005';
const BINA = '10000000-0000-0000-0000-000000000006';
const LOGIN_ASHA = '10000000-0000-0000-0000-000000000007';
const OP = '10000000-0000-0000-0000-00000000000e';
const LOGIN_OP = '10000000-0000-0000-0000-00000000000f';
const SUP = '10000000-0000-0000-0000-000000000010';
const LOGIN_SUP = '10000000-0000-0000-0000-000000000011';
const T1 = '10000000-0000-0000-0000-000000000008';
const T2 = '10000000-0000-0000-0000-000000000009';
const T3 = '10000000-0000-0000-0000-00000000000a';
const T4 = '10000000-0000-0000-0000-00000000000b';
const T5 = '10000000-0000-0000-0000-00000000000c';
const T6 = '10000000-0000-0000-0000-00000000000d';
const TENANT_2 = '20000000-0000-0000-0000-000000000001';
const PERSON_2 = '20000000-0000-0000-0000-000000000002';
const GUJ = '10000000-0000-0000-0000-000000000012';
const BRD = '10000000-0000-0000-0000-000000000013';
const LOGIN_BRD = '10000000-0000-0000-0000-000000000014';
const T7 = '10000000-0000-0000-0000-000000000015';
const GUJ_NAME = 'ગીતા પટેલ';
const GUJ_PROBLEM = 'સ્પિન્ડલ બેરિંગ બદલવું પડ્યું';
const PASSWORD = 'correct-horse-battery';

// Day window for 2026-11-10 in Asia/Kolkata (08:00–18:30) is 02:30–13:00 UTC.
// Night window (18:29–05:00 next day) is 12:59–23:30 UTC.
const AT = (iso: string): Date => new Date(iso);

type App = Awaited<ReturnType<typeof buildApp>>;
type Res = Awaited<ReturnType<App['inject']>>;

/** Resolved at import time so the render test can be skipped before any hook runs. */
const chromiumPath = (() => {
  try {
    return resolveChromium();
  } catch {
    return null;
  }
})();

let db: TestDb;
let app: App;
let filesDir = '';
let ashaToken = '';
let opToken = '';
let supToken = '';
let brdToken = '';

function get(url: string, token?: string): Promise<Res> {
  return app.inject({
    method: 'GET',
    url,
    headers: { host: 'cosmos.localhost', ...(token ? { authorization: `Bearer ${token}` } : {}) },
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

/** The day report data for a shift code (the plant's own shifts), or the whole calendar day for null. */
async function dayReport(
  personId: string,
  date = '2026-11-10',
  shift: string | null = '1',
): Promise<DayReportData | null> {
  const data = await withTenant(db.app, TENANT, (client) =>
    loadDayReport(client, { tenantId: TENANT, personId, date, shift }),
  );
  if (data === 'no-shift') throw new Error('no such shift');
  return data;
}

async function seed(): Promise<void> {
  const passwordHash = await hash(PASSWORD, {
    algorithm: 2,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
  await db.admin.query(
    `INSERT INTO tenant (id, slug, name) VALUES
       ($1, 'cosmos', 'Cosmos'), ($2, 'plant-two', 'Plant Two')`,
    [TENANT, TENANT_2],
  );
  // The plant's real shifts (Cosmos): shift 2 runs past midnight.
  await db.admin.query(
    `INSERT INTO shift (tenant_id, code, name, starts_at, ends_at, crosses_midnight) VALUES
       ($1, '1', 'Shift 1', '08:00', '18:30', false), ($1, '2', 'Shift 2', '18:29', '05:00', true)`,
    [TENANT],
  );
  await db.admin.query(
    "INSERT INTO segment (id, tenant_id, code, name, sort) VALUES ($1, $2, 'CNC', 'CNC', 0)",
    [SEGMENT, TENANT],
  );
  await db.admin.query(
    `INSERT INTO machine (id, tenant_id, code, segment_id, category, cell) VALUES
       ($1, $3, 'VC-1', $4, 'VMC', 'Cell-1'), ($2, $3, 'VC-2', $4, 'HMC', 'Cell-2')`,
    [M1, M2, TENANT, SEGMENT],
  );
  await db.admin.query(
    `INSERT INTO person (id, tenant_id, name, team) VALUES
       ($1, $3, 'Asha', 'maintenance'), ($2, $3, 'Bina', 'maintenance'),
       ($4, $5, 'Other tech', 'maintenance'), ($6, $3, 'Omi', 'production'),
       ($7, $3, 'Sami', 'maintenance'), ($8, $3, $9, 'maintenance'),
       ($10, $3, 'Bo', 'production')`,
    [ASHA, BINA, TENANT, PERSON_2, TENANT_2, OP, SUP, GUJ, GUJ_NAME, BRD],
  );
  await db.admin.query(
    `INSERT INTO login (id, tenant_id, person_id, username, password_hash, role, shared)
     VALUES ($1, $2, $3, 'asha', $4, 'technician', false),
            ($5, $2, $6, 'op', $4, 'operator', false),
            ($7, $2, $8, 'sup', $4, 'supervisor', false),
            ($9, $2, $10, 'brd', $4, 'board', false)`,
    [LOGIN_ASHA, TENANT, ASHA, passwordHash, LOGIN_OP, OP, LOGIN_SUP, SUP, LOGIN_BRD, BRD],
  );
  await db.admin.query(
    `INSERT INTO ticket (id, tenant_id, ref, kind, status, machine_id, problem, reported_at, raised_login_id, closed_at, severity) VALUES
       ($1, $7, 'BD-1', 'stopped', 'closed', $8, 'Spindle noise', $11, $10, $12, 'S3'),
       ($2, $7, 'BD-2', 'stopped', 'closed', $9, 'Coolant leak',  $13, $10, $14, 'S3'),
       ($3, $7, 'BD-3', 'stopped', 'open',   $8, 'Axis alarm',    $15, $10, null, 'S3'),
       ($4, $7, 'BD-4', 'support', 'open',   $9, 'Program check', $16, $10, null, 'S4'),
       ($5, $7, 'BD-5', 'stopped', 'closed', $9, 'Tool change',   $17, $10, $18, 'S3'),
       ($6, $7, 'BD-6', 'stopped', 'closed', $8, 'Reported only', $19, $10, $20, 'S3')`,
    [
      T1,
      T2,
      T3,
      T4,
      T5,
      T6,
      TENANT,
      M1,
      M2,
      LOGIN_ASHA,
      AT('2026-11-10T02:20:00Z'),
      AT('2026-11-10T03:10:00Z'),
      AT('2026-11-10T03:50:00Z'),
      AT('2026-11-10T04:40:00Z'),
      AT('2026-11-10T03:00:00Z'),
      AT('2026-11-10T14:00:00Z'),
      AT('2026-11-10T04:00:00Z'),
      AT('2026-11-10T05:00:00Z'),
      AT('2026-11-10T04:30:00Z'),
      AT('2026-11-10T05:30:00Z'),
    ],
  );
  await db.admin.query(
    `INSERT INTO work_segment (tenant_id, ticket_id, person_id, role, started_at, ended_at) VALUES
       ($1, $2, $7, 'primary', $9,  $10),
       ($1, $3, $7, 'primary', $11, $12),
       ($1, $4, $7, 'primary', $13, $14),
       ($1, $4, $8, 'support', $16, $15),
       ($1, $5, $7, 'primary', $17, $18),
       ($1, $6, $8, 'primary', $19, $20)`,
    [
      TENANT,
      T1,
      T2,
      T3,
      T4,
      T5,
      ASHA,
      BINA,
      AT('2026-11-10T02:00:00Z'),
      AT('2026-11-10T03:00:00Z'),
      AT('2026-11-10T04:00:00Z'),
      AT('2026-11-10T04:30:00Z'),
      AT('2026-11-10T03:00:00Z'),
      AT('2026-11-10T03:10:00Z'),
      AT('2026-11-10T03:40:00Z'),
      AT('2026-11-10T03:10:00Z'),
      AT('2026-11-10T14:00:00Z'),
      AT('2026-11-10T14:30:00Z'),
      AT('2026-11-10T04:00:00Z'),
      AT('2026-11-10T05:00:00Z'),
    ],
  );
  // A job written in Gujarati, by a person with a Gujarati name: both must come out in the PDF.
  await db.admin.query(
    `INSERT INTO ticket (id, tenant_id, ref, kind, status, machine_id, problem, reported_at, raised_login_id, closed_at, severity)
     VALUES ($1, $2, 'BD-7', 'stopped', 'closed', $3, $4, $5, $6, $7, 'S3')`,
    [
      T7,
      TENANT,
      M1,
      GUJ_PROBLEM,
      AT('2026-11-10T06:00:00Z'),
      LOGIN_ASHA,
      AT('2026-11-10T07:00:00Z'),
    ],
  );
  await db.admin.query(
    `INSERT INTO work_segment (tenant_id, ticket_id, person_id, role, started_at, ended_at)
     VALUES ($1, $2, $3, 'primary', $4, $5)`,
    [TENANT, T7, GUJ, AT('2026-11-10T06:00:00Z'), AT('2026-11-10T07:00:00Z')],
  );
  // BD-6 has no work segment: the person only touched it through an event.
  await db.admin.query(
    `INSERT INTO ticket_event (tenant_id, ticket_id, seq, type, at, acting_person_id)
     VALUES ($1, $2, 1, 'update', $3, $4)`,
    [TENANT, T6, AT('2026-11-10T05:00:00Z'), ASHA],
  );
}

beforeAll(async () => {
  db = await startTestDb();
  await seed();
  filesDir = await mkdtemp(join(tmpdir(), 'uptimo-day-report-'));
  app = await buildApp({
    pool: db.app,
    logger: false,
    rateLimitMax: 100000,
    filesDir,
    chromiumPath: chromiumPath ?? undefined,
  });
  ashaToken = await login('asha');
  opToken = await login('op');
  supToken = await login('sup');
  brdToken = await login('brd');
}, 120_000);

afterAll(async () => {
  if (app) await app.close();
  if (db) await db.stop();
  if (filesDir) await rm(filesDir, { recursive: true, force: true });
});

describe('day report data', () => {
  it('lists every ticket the person touched with their own clipped minutes', async () => {
    const data = await dayReport(ASHA);
    expect(data).not.toBeNull();
    const report = data!;
    expect(report.person.name).toBe('Asha');
    expect(report.date).toBe('2026-11-10');
    expect(report.window.start.toISOString()).toBe('2026-11-10T02:30:00.000Z');
    expect(report.window.end.toISOString()).toBe('2026-11-10T13:00:00.000Z');
    expect(report.jobs.map((job) => job.ref)).toEqual(['BD-1', 'BD-3', 'BD-2', 'BD-6']);
    // BD-1 starts before the window (clipped to 30), BD-3 is 10 of Asha's, BD-6 is event-only.
    expect(report.jobs.map((job) => job.minutes)).toEqual([30, 10, 30, 0]);
    expect(report.totalMinutes).toBe(70);
    const bd3 = report.jobs.find((job) => job.ref === 'BD-3')!;
    expect(bd3.machine.code).toBe('VC-1');
    expect(bd3.status).toBe('open');
  });

  it('excludes another person’s time from the minutes', async () => {
    const bins = await dayReport(BINA);
    expect(bins!.jobs.map((job) => job.ref)).toEqual(['BD-3', 'BD-5']);
    expect(bins!.jobs.map((job) => job.minutes)).toEqual([30, 60]);
    expect(bins!.totalMinutes).toBe(90);
    expect(bins!.jobs.some((job) => job.ref === 'BD-1' || job.ref === 'BD-2')).toBe(false);
  });

  it('puts tickets still open at the window end in pending-at-end', async () => {
    const data = (await dayReport(ASHA))!;
    expect(data.pending.map((row) => row.ref)).toEqual(['BD-3']);
    expect(data.pending[0]!.status).toBe('open');
  });

  it('uses shift 2’s window from the shift table (18:29–05:00 next day)', async () => {
    const data = (await dayReport(ASHA, '2026-11-10', '2'))!;
    expect(data.window.start.toISOString()).toBe('2026-11-10T12:59:00.000Z');
    expect(data.window.end.toISOString()).toBe('2026-11-10T23:30:00.000Z');
    expect(data.jobs.map((job) => job.ref)).toEqual(['BD-4']);
    expect(data.jobs[0]!.minutes).toBe(30);
    expect(data.pending.map((row) => row.ref)).toEqual(['BD-3', 'BD-4']);
  });

  it('returns null for an unknown or another-tenant person', async () => {
    expect(await dayReport(randomUUID())).toBeNull();
    expect(await dayReport(PERSON_2)).toBeNull();
  });
});

describe('day report PDF endpoint', () => {
  it('renders the day report HTML with the ticket rows', async () => {
    const html = renderDayReportHtml((await dayReport(ASHA))!);
    expect(html).toContain('Day report');
    expect(html).toContain('Asha');
    expect(html).toContain('BD-1');
    expect(html).toContain('Pending at the end of the period');
    expect(html).toContain('Work time');
  });

  it.skipIf(!chromiumPath)('returns the caller’s day as a PDF and stores nothing', async () => {
    const before = await db.admin.query('SELECT count(*)::int AS n FROM file');
    const res = await get(`/api/v1/reports/day.pdf?date=2026-11-10&personId=me&shift=1`, ashaToken);
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
    expect(res.headers['content-disposition']).toContain('Day_report_Asha_2026-11-10_shift1.pdf');
    expect(res.rawPayload.subarray(0, 5).toString()).toBe('%PDF-');
    expect(res.rawPayload.length).toBeGreaterThan(5000);

    const after = await db.admin.query('SELECT count(*)::int AS n FROM file');
    expect(after.rows[0].n).toBe(before.rows[0].n);
    expect(readdirSync(filesDir)).toEqual([]);
  });

  it('defaults personId to the caller and the period to the whole calendar day', async () => {
    const whole = (await dayReport(ASHA, '2026-11-10', null))!;
    expect(whole.window.start.toISOString()).toBe('2026-11-09T18:30:00.000Z');
    expect(whole.window.end.toISOString()).toBe('2026-11-10T18:30:00.000Z');
    // Asha's BD-4 work (14:00Z, shift 2) and her 02:00Z start both fall in the day: more than shift 1 alone.
    expect(whole.totalMinutes).toBeGreaterThan((await dayReport(ASHA))!.totalMinutes);
    const res = await get('/api/v1/reports/day.pdf?date=2026-11-10', ashaToken);
    // No Chromium in the sandbox would turn this into a 500, so skip the render-only assertion.
    if (!chromiumPath) {
      expect([200, 500]).toContain(res.statusCode);
      return;
    }
    expect(res.statusCode).toBe(200);
  });

  it.skipIf(!chromiumPath)('prints a Gujarati name and problem in the PDF', async () => {
    const data = (await dayReport(GUJ))!;
    const html = renderDayReportHtml(data);
    expect(html).toContain(GUJ_NAME);
    expect(html).toContain(GUJ_PROBLEM);
    const res = await get(
      `/api/v1/reports/day.pdf?date=2026-11-10&personId=${GUJ}&shift=1`,
      supToken,
    );
    expect(res.statusCode).toBe(200);
    expect(pdfShows(res.rawPayload, `${GUJ_NAME} ${GUJ_PROBLEM}`)).toBe(true);
  });

  it('shows one plant only: another tenant’s day lists none of this plant’s pending tickets', async () => {
    const other = await withTenant(db.app, TENANT_2, (client) =>
      loadDayReport(client, {
        tenantId: TENANT_2,
        personId: PERSON_2,
        date: '2026-11-10',
        shift: null,
      }),
    );
    expect(other).not.toBeNull();
    expect((other as DayReportData).pending).toEqual([]);
    expect((other as DayReportData).jobs).toEqual([]);
  });

  it('rejects an unknown person, a foreign tenant person and a bad query', async () => {
    // A supervisor may pick a person, so the 404 path is reachable (a technician gets 403 above).
    const unknown = await get(
      `/api/v1/reports/day.pdf?date=2026-11-10&personId=${randomUUID()}`,
      supToken,
    );
    expect(unknown.statusCode).toBe(404);

    const otherTenant = await get(
      `/api/v1/reports/day.pdf?date=2026-11-10&personId=${PERSON_2}`,
      supToken,
    );
    expect(otherTenant.statusCode).toBe(404);

    const badShift = await get('/api/v1/reports/day.pdf?date=2026-11-10&shift=evening', ashaToken);
    expect(badShift.statusCode).toBe(422);
    expect(badShift.json().error.code).toBe('validation');

    const badDate = await get('/api/v1/reports/day.pdf?date=10-11-2026', ashaToken);
    expect(badDate.statusCode).toBe(422);

    const impossibleDate = await get('/api/v1/reports/day.pdf?date=2026-02-31', ashaToken);
    expect(impossibleDate.statusCode).toBe(422);
  });

  it('requires authentication', async () => {
    const res = await get('/api/v1/reports/day.pdf?date=2026-11-10');
    expect(res.statusCode).toBe(401);
  });

  it('forbids an operator from receiving a day report', async () => {
    const res = await get('/api/v1/reports/day.pdf?date=2026-11-10', opToken);
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('forbidden');
  });

  it('forbids the board from receiving a day report', async () => {
    const res = await get('/api/v1/reports/day.pdf?date=2026-11-10', brdToken);
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('forbidden');
  });

  it('lets a technician see only their own day', async () => {
    const own = await get('/api/v1/reports/day.pdf?date=2026-11-10', ashaToken);
    expect(own.statusCode).toBe(200);
    const other = await get(`/api/v1/reports/day.pdf?date=2026-11-10&personId=${BINA}`, ashaToken);
    expect(other.statusCode).toBe(403);
    expect(other.json().error.field).toBe('personId');
  });
});
