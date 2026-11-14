import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { personMinutes } from '@uptimo/domain';
import { withTenant } from '@uptimo/db';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../src/app.js';
import { loadDayReport } from '../src/modules/reports/day-report.js';
import { importRealExport } from '../src/modules/imports/real-import.js';
import { FIXTURE_PASSWORD, seedCosmos } from '../src/seed/cosmos.js';
import { startTestDb, type TestDb } from './harness.js';

// What the breakdown PDF puts in its QR, captured where the text is made (the PDF only holds the picture).
const { qrTexts } = vi.hoisted(() => ({ qrTexts: [] as string[] }));
vi.mock('../src/modules/reports/pdf.js', async (original) => {
  const actual = await original<typeof import('../src/modules/reports/pdf.js')>();
  return {
    ...actual,
    qrText: (payload: Parameters<typeof actual.qrText>[0]) => {
      const text = actual.qrText(payload);
      qrTexts.push(text);
      return text;
    },
  };
});

// Cosmos's real plant and the 275 real tickets (names and phones invented), as in import-real.test.ts.
const doc = (name: string) =>
  fileURLToPath(new URL(`../../../docs/discovery/${name}`, import.meta.url));
const paths = {
  exportPath: doc('source/cosmos-platform-export-2026-10-28.json'),
  livePath: doc('bhavin-v3/live-config-2026-11-09.json'),
  glossaryPath: doc('bhavin-v3/glossary-2026-11-09.json'),
};
type V3Ticket = { ref: string; report?: Record<string, unknown> };
const tickets = (): V3Ticket[] =>
  JSON.parse(
    readFileSync(new URL('./fixtures/bhavin-export.pseudonymised.json', import.meta.url), 'utf8'),
  ).tickets;

/** The QR text v3 itself makes: its own `bdQR` run over the form data, with the QR drawing swapped for a recorder. */
function v3QrText(data: Record<string, unknown>): string {
  const source = readFileSync(doc('bhavin-v3/ref.js'), 'utf8');
  const bdQR = /function bdQR\(holder, data\)\{[\s\S]*?\n\}/.exec(source)?.[0];
  if (!bdQR) throw new Error('v3 bdQR not found in the reference');
  const drawn: string[] = [];
  class Recorder {
    static CorrectLevel = { M: 'M', L: 'L' };
    constructor(_holder: unknown, options: { text: string }) {
      drawn.push(options.text);
    }
  }
  new Function('QRCode', `${bdQR}; return bdQR;`)(Recorder)({ innerHTML: '' }, data);
  return drawn[0] as string;
}

/** The form data v3's `generateReport` hands to `bdQR` (same keys, same order); old stored reports lack `tk`. */
function v3FormData(ticket: V3Ticket): Record<string, unknown> {
  const stored = ticket.report as Record<string, unknown>;
  const keys = ['v', 'mid', 'd', 'sh', 'pr', 'ob', 'ca', 'db', 'sb', 'dm', 'mc', 'bc', 'sp', 'ty'];
  return {
    ...Object.fromEntries(keys.map((key) => [key, stored[key]])),
    tk: ticket.ref,
    rs: stored.rs,
    rp: stored.rp,
  };
}

let db: TestDb;
let app: Awaited<ReturnType<typeof buildApp>>;
let adminToken = '';

function get(url: string) {
  return app.inject({
    method: 'GET',
    url,
    headers: { host: 'cosmos.localhost', authorization: `Bearer ${adminToken}` },
  });
}

beforeAll(async () => {
  db = await startTestDb();
  await seedCosmos(db.admin, paths);
  const tenantId = (await db.admin.query("SELECT id FROM tenant WHERE slug = 'cosmos'")).rows[0].id;
  app = await buildApp({ pool: db.app, logger: false, rateLimitMax: 100000 });
  await importRealExport(db.app, tenantId, { tickets: tickets() });
  const username = (await db.admin.query("SELECT username FROM login WHERE role = 'admin' LIMIT 1"))
    .rows[0].username;
  const login = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    headers: { host: 'cosmos.localhost', 'content-type': 'application/json' },
    payload: { username, password: FIXTURE_PASSWORD },
  });
  adminToken = login.json().token;
}, 240_000);

afterAll(async () => {
  await app.close();
  await db.stop();
});

describe('the breakdown PDF QR on real tickets', () => {
  it('holds exactly what v3 puts in its QR, long, accented and half-empty reports included', async () => {
    const withReport = tickets().filter((t) => t.report);
    const asJson = (t: V3Ticket): string => JSON.stringify(t.report);
    const sample = [
      withReport[0],
      withReport.find((t) => t.report!.sb),
      withReport.find((t) => t.report!.rs === null),
      withReport.find((t) => asJson(t).length > 600),
      withReport.find((t) => [...asJson(t)].some((char) => char.charCodeAt(0) > 127)),
    ] as V3Ticket[];
    expect(sample.every(Boolean)).toBe(true);
    for (const ticket of sample) {
      const id = (await db.admin.query('SELECT id FROM ticket WHERE ref = $1', [ticket.ref]))
        .rows[0].id;
      const res = await get(`/api/v1/tickets/${id}/pdf`);
      expect(res.statusCode, ticket.ref).toBe(200);
      expect(qrTexts.at(-1), ticket.ref).toBe(v3QrText(v3FormData(ticket)));
    }
  });
});

describe('the day report on the real shifts', () => {
  let tenantId = '';
  let busy: { personId: string; date: string };
  const IST = (local: string): string => new Date(`${local}+05:30`).toISOString();

  const report = (personId: string, date: string, shift: string | null) =>
    withTenant(db.app, tenantId, (client) =>
      loadDayReport(client, { tenantId, personId, date, shift }),
    );
  const pdf = (personId: string, date: string, shift?: string) =>
    get(
      `/api/v1/reports/day.pdf?date=${date}&personId=${personId}${shift ? `&shift=${shift}` : ''}`,
    );

  beforeAll(async () => {
    tenantId = (await db.admin.query("SELECT id FROM tenant WHERE slug = 'cosmos'")).rows[0].id;
    // The real person-day with the most work in shift 1 (08:00–18:30, Asia/Kolkata).
    busy = (
      await db.admin.query(
        `SELECT person_id AS "personId",
                to_char(started_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') AS date
           FROM work_segment
          WHERE (started_at AT TIME ZONE 'Asia/Kolkata')::time BETWEEN '08:00' AND '18:00'
          GROUP BY 1, 2 ORDER BY count(*) DESC, 2 LIMIT 1`,
      )
    ).rows[0];
  });

  it('uses the windows in the plant’s shift table: shift 1, shift 2, and the whole day without a shift', async () => {
    const { personId, date } = busy;
    const next = new Date(Date.parse(`${date}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
    const windowOf = async (shift: string | null) => {
      const data = (await report(personId, date, shift)) as Exclude<
        Awaited<ReturnType<typeof report>>,
        'no-shift' | null
      >;
      return [data.window.start.toISOString(), data.window.end.toISOString()];
    };
    expect(await windowOf('1')).toEqual([IST(`${date}T08:00:00`), IST(`${date}T18:30:00`)]);
    expect(await windowOf('2')).toEqual([IST(`${date}T18:29:00`), IST(`${next}T05:00:00`)]);
    expect(await windowOf(null)).toEqual([IST(`${date}T00:00:00`), IST(`${next}T00:00:00`)]);
  });

  it('follows a change to a shift in the settings', async () => {
    const shifts = (await get('/api/v1/shifts')).json() as Array<{ id: string; code: string }>;
    const patched = await app.inject({
      method: 'PATCH',
      url: `/api/v1/shifts/${shifts.find((s) => s.code === '1')!.id}`,
      headers: {
        host: 'cosmos.localhost',
        'content-type': 'application/json',
        authorization: `Bearer ${adminToken}`,
      },
      payload: { endsAt: '17:00' },
    });
    expect(patched.statusCode).toBe(200);
    const data = (await report(busy.personId, busy.date, '1')) as { window: { end: Date } };
    expect(data.window.end.toISOString()).toBe(IST(`${busy.date}T17:00:00`));
    expect((await pdf(busy.personId, busy.date, '1')).statusCode).toBe(200);
  });

  it('refuses a shift the plant does not have', async () => {
    const res = await pdf(busy.personId, busy.date, 'day');
    expect(res.statusCode).toBe(422);
    expect(res.json().error.field).toBe('shift');
  });

  it('shows each person’s own minutes, the same sum the ticket uses', async () => {
    const { personId, date } = busy;
    const data = (await report(personId, date, null)) as {
      jobs: Array<{ ticketId: string; minutes: number }>;
      totalMinutes: number;
    };
    expect(data.jobs.length).toBeGreaterThan(0);
    const segments = (
      await db.admin.query(
        `SELECT ticket_id, person_id, role, started_at, ended_at FROM work_segment
          WHERE person_id = $1`,
        [personId],
      )
    ).rows;
    const dayStart = new Date(IST(`${date}T00:00:00`));
    const dayEnd = new Date(dayStart.getTime() + 86_400_000);
    for (const job of data.jobs) {
      const own = segments
        .filter((s) => s.ticket_id === job.ticketId)
        .map((s) => ({
          personId: s.person_id as string,
          role: s.role,
          startedAt: new Date(s.started_at),
          ...(s.ended_at ? { endedAt: new Date(s.ended_at) } : {}),
        }));
      const expected = personMinutes(own, new Date(), { start: dayStart, end: dayEnd })[personId];
      expect(job.minutes).toBe(expected ?? 0);
    }
    expect(data.totalMinutes).toBe(data.jobs.reduce((sum, job) => sum + job.minutes, 0));
    expect(data.totalMinutes).toBeGreaterThan(0);
  });

  it('lists a ticket still open when the shift ended even though it was closed later', async () => {
    const found = (
      await db.admin.query(
        `SELECT ref, to_char(reported_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') AS date
           FROM ticket
          WHERE status = 'closed'
            AND (reported_at AT TIME ZONE 'Asia/Kolkata')::time BETWEEN '09:00' AND '17:00'
            AND closed_at > (reported_at AT TIME ZONE 'Asia/Kolkata')::date + time '19:00'
                              - interval '5 hours 30 minutes'
          ORDER BY reported_at LIMIT 1`,
      )
    ).rows[0];
    expect(found, 'the real tickets hold one closed after its shift').toBeDefined();
    const data = (await report(busy.personId, found.date, '1')) as {
      pending: Array<{ ref: string }>;
    };
    expect(data.pending.map((row) => row.ref)).toContain(found.ref);
  });
});
