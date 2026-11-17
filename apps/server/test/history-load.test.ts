/**
 * Ticket 37 goal 1, packet 37c-2: the 2026 breakdown log loads through the past-breakdown path once, shows on the
 * desk list, resolves the legacy codes through the alias config and loses a leaver's name on the 07 erasure path.
 *
 * Harness: the Cosmos seed (the real machine master, the two seeded shifts and the code lists the history uses) with
 * the people the history names added to that tenant only. No live ticket is imported, so the counts are the log's own.
 * The export is the generator's own output; nothing is shrunk to make it fit.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { withTenant } from '@uptimo/db';
import { buildApp } from '../src/app.js';
import { erasePerson } from '../src/modules/identity/index.js';
import { importBhavin } from '../src/modules/imports/bhavin.js';
import { breakdownLogExport } from '../src/seed/breakdown-log-export.js';
import { FIXTURE_PASSWORD, seedCosmos } from '../src/seed/cosmos.js';
import { startTestDb, type TestDb } from './harness.js';

interface FixtureRow {
  id: string;
  date: string;
  maintCode: string;
  doneBy: string;
  supportedBy: string;
}

interface Fixture {
  breakdowns: FixtureRow[];
}

interface ExportTicket {
  legacyId: string;
  ref: string;
  reports: Array<Record<string, unknown>>;
}

const readJson = <T>(path: string): T =>
  JSON.parse(readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8')) as T;
const doc = (path: string): string =>
  fileURLToPath(new URL(`../../../docs/discovery/${path}`, import.meta.url));

const fixture = readJson<Fixture>('../../../fixtures/answer-key/input.json');
const exportInput = breakdownLogExport(fixture);
const exportTickets = exportInput.tickets as ExportTicket[];
const PLANT_ZONE = 'Asia/Kolkata';
const LIVE_PREFIX = 'bd_live_';
const UNKNOWN_CODES = ['NI', 'FS', 'PP', 'UTI'];
/** The history's people the Cosmos seed does not hold: every exported doneBy name must exist for the alias to resolve. */
const HISTORY_PEOPLE = [
  'Maint. Team',
  'Person 39',
  'Person 40',
  'Person 41',
  'Person 46',
  'Person 49',
  'Person 50',
  'Person 51',
  'Person 53',
  'Person 55',
  'Person 68',
  'Person 79',
  'Person 88',
];
/** Named only in one row's problem and corrective action, never in doneBy: the 07 scrub's free text. */
const FREE_TEXT_PERSON = 'Person 89';
const FREE_TEXT_ROW = 'bd_muxluadbgu3q0';
const KEY = ['erasure', 'test', 'history'].join('-').padEnd(40, 'x');

let db: TestDb;
let app: Awaited<ReturnType<typeof buildApp>>;
let tenantId: string;
let token: string;
let batchId: string;
let freeTextTicketId: string;
let freeTextPersonId: string;
let historyDay: string;

const q = (text: string, params: unknown[] = []) => db.admin.query(text, params);
const get = (url: string) =>
  app.inject({
    method: 'GET',
    url,
    headers: { host: 'cosmos.localhost', authorization: `Bearer ${token}` },
  });

async function counts(): Promise<{ tickets: number; reports: number; backfill: number }> {
  const result = await q(
    `SELECT (SELECT count(*)::int FROM ticket WHERE tenant_id = $1) AS tickets,
            (SELECT count(*)::int FROM breakdown_report WHERE tenant_id = $1) AS reports,
            (SELECT count(*)::int FROM ticket WHERE tenant_id = $1 AND raised_channel = 'backfill'
              AND status = 'closed') AS backfill`,
    [tenantId],
  );
  return result.rows[0] as { tickets: number; reports: number; backfill: number };
}

function historyRow(id: string): FixtureRow {
  const row = fixture.breakdowns.find((candidate) => candidate.id === id);
  if (!row) throw new Error(`fixture has no row ${id}`);
  return row;
}

/** The fixture's DD-MM-YYYY date as the plant's calendar day. */
function plantDay(value: string): string {
  const [day = '', month = '', year = ''] = value.split('-');
  return `${year}-${month}-${day}`;
}

function nextDay(value: string): string {
  const next = new Date(`${value}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString().slice(0, 10);
}

/** One exported ticket with a fresh identity and the code under test, for the blank and unknown-code cases. */
function crafted(
  ticket: ExportTicket,
  input: { legacyId: string; ref: string; maintCode: string | null },
): { aliases: typeof exportInput.aliases; source: typeof exportInput.source; tickets: unknown[] } {
  const copy = structuredClone(ticket);
  copy.legacyId = input.legacyId;
  copy.ref = input.ref;
  const report = copy.reports[0];
  if (!report) throw new Error('crafted ticket has no report');
  report.maintCode = input.maintCode;
  if (input.maintCode === null) report.breakdownCategory = null;
  return { ...exportInput, tickets: [copy] };
}

beforeAll(async () => {
  process.env.ERASURE_HASH_KEY = KEY;
  db = await startTestDb();
  await seedCosmos(db.admin, {
    exportPath: doc('source/cosmos-platform-export-2026-10-28.json'),
    livePath: doc('bhavin-v3/live-config-2026-11-09.json'),
    glossaryPath: doc('bhavin-v3/glossary-2026-11-09.json'),
  });
  tenantId = (await q("SELECT id FROM tenant WHERE slug = 'cosmos'")).rows[0].id as string;
  await q(
    `INSERT INTO person (tenant_id, name, team)
     SELECT $1, name, 'maintenance' FROM unnest($2::text[]) AS t(name)`,
    [tenantId, HISTORY_PEOPLE],
  );
  freeTextPersonId = (
    await q(
      "INSERT INTO person (tenant_id, name, team) VALUES ($1, $2, 'maintenance') RETURNING id",
      [tenantId, FREE_TEXT_PERSON],
    )
  ).rows[0].id as string;
  app = await buildApp({ pool: db.app, logger: false, rateLimitMax: 100000 });
  const login = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    headers: { host: 'cosmos.localhost', 'content-type': 'application/json' },
    payload: { username: 'person01', password: FIXTURE_PASSWORD },
  });
  expect(login.statusCode, login.body).toBe(200);
  token = login.json().token as string;
}, 120_000);

afterAll(async () => {
  delete process.env.ERASURE_HASH_KEY;
  await app.close();
  await db.stop();
});

describe('the 2026 breakdown log through the past-breakdown path', () => {
  it('loads the 1,283 history rows once, as closed backfill tickets with their source references', async () => {
    expect(exportTickets).toHaveLength(1283);
    expect(exportTickets.some((ticket) => ticket.legacyId.startsWith(LIVE_PREFIX))).toBe(false);

    const first = await importBhavin(db.app, tenantId, exportInput, { timeZone: PLANT_ZONE });
    batchId = first.batchId;
    expect(first.stats).toMatchObject({ imported: 1283, skipped: 0, errored: 0, status: 'done' });
    expect(first.stats.reports).toBe(1283);
    expect(await counts()).toEqual({ tickets: 1283, reports: 1283, backfill: 1283 });

    const rows = await q(
      `SELECT ir.source_ref, t.status, t.raised_channel, t.close_kind, count(br.id)::int AS reports
       FROM import_row ir
       JOIN ticket t ON t.id = ir.ticket_id
       LEFT JOIN breakdown_report br ON br.ticket_id = t.id
       WHERE ir.tenant_id = $1 AND ir.batch_id = $2 AND ir.status = 'imported'
       GROUP BY ir.source_ref, t.status, t.raised_channel, t.close_kind`,
      [tenantId, batchId],
    );
    expect(rows.rowCount).toBe(1283);
    const refs = rows.rows.map((row) => row.source_ref as string);
    expect(new Set(refs)).toEqual(new Set(exportTickets.map((ticket) => ticket.legacyId)));
    expect(refs.some((ref) => ref.startsWith(LIVE_PREFIX))).toBe(false);
    expect(
      rows.rows.every(
        (row) =>
          row.status === 'closed' &&
          row.raised_channel === 'backfill' &&
          row.close_kind === 'report' &&
          row.reports === 1,
      ),
    ).toBe(true);

    freeTextTicketId = (
      await q(
        `SELECT t.id FROM import_row ir JOIN ticket t ON t.id = ir.ticket_id
         WHERE ir.batch_id = $1 AND ir.source_ref = $2`,
        [batchId, FREE_TEXT_ROW],
      )
    ).rows[0].id as string;
    historyDay = plantDay(historyRow(FREE_TEXT_ROW).date);
  }, 600_000);

  it('adds nothing on a re-import: each row counts once beside the live tickets', async () => {
    const before = await counts();
    const again = await importBhavin(db.app, tenantId, exportInput, { timeZone: PLANT_ZONE });
    expect(again.stats).toMatchObject({ imported: 0, skipped: 1283, errored: 0, status: 'done' });
    expect(await counts()).toEqual(before);
  }, 600_000);

  it('resolves the five legacy codes through the alias config and keeps the aliased code', async () => {
    const ids = fixture.breakdowns
      .filter((row) => !row.id.startsWith(LIVE_PREFIX) && UNKNOWN_CODES.includes(row.maintCode))
      .map((row) => row.id);
    expect(ids).toHaveLength(5);
    const rows = await q(
      `SELECT ir.source_ref, br.maint_code
       FROM import_row ir
       JOIN ticket t ON t.id = ir.ticket_id
       JOIN breakdown_report br ON br.ticket_id = t.id
       WHERE ir.batch_id = $1 AND ir.source_ref = ANY($2::text[])`,
      [batchId, ids],
    );
    expect(rows.rowCount).toBe(5);
    expect(rows.rows.map((row) => row.maint_code)).toEqual(Array(5).fill('MIS'));
  });

  it('keeps a blank code null and makes an unseeded, un-aliased code a visible import issue', async () => {
    const base = exportTickets[0];
    if (!base) throw new Error('the export has no ticket');
    const blanked = await importBhavin(
      db.app,
      tenantId,
      crafted(base, { legacyId: 'bd_crafted_blank', ref: 'BD-99991', maintCode: null }),
      { timeZone: PLANT_ZONE },
    );
    expect(blanked.stats).toMatchObject({ imported: 1, errored: 0, status: 'done' });
    const kept = await q(
      `SELECT br.maint_code, br.breakdown_category
       FROM import_row ir
       JOIN ticket t ON t.id = ir.ticket_id
       JOIN breakdown_report br ON br.ticket_id = t.id
       WHERE ir.batch_id = $1 AND ir.source_ref = 'bd_crafted_blank'`,
      [blanked.batchId],
    );
    expect(kept.rows[0]).toEqual({ maint_code: null, breakdown_category: null });

    const unknown = await importBhavin(
      db.app,
      tenantId,
      crafted(base, { legacyId: 'bd_crafted_unknown', ref: 'BD-99992', maintCode: 'ZZZ' }),
      { timeZone: PLANT_ZONE },
    );
    expect(unknown.stats).toMatchObject({ imported: 0, errored: 1, status: 'failed' });
    expect(unknown.stats.issues).toContainEqual(
      expect.objectContaining({ code: 'unknown_code', field: 'reports[0].maintCode' }),
    );
    expect(unknown.stats.issues[0]?.message).toContain('Unknown or inactive');
    const noTicket = await q(
      "SELECT count(*)::int AS n FROM ticket WHERE tenant_id = $1 AND ref = 'BD-99992'",
      [tenantId],
    );
    expect(noTicket.rows[0].n).toBe(0);
    // The failed row is kept with its error, not dropped from the batch.
    const keptError = await q(
      "SELECT status, error FROM import_row WHERE batch_id = $1 AND source_ref = 'bd_crafted_unknown'",
      [unknown.batchId],
    );
    expect(keptError.rows[0]).toMatchObject({ status: 'error' });
    expect(keptError.rows[0].error).toContain('Unknown or inactive');
  }, 300_000);

  it('shows a history day on the desk list as closed backfill, not on /state', async () => {
    const res = await get(`/api/v1/tickets?from=${historyDay}&to=${nextDay(historyDay)}&limit=200`);
    expect(res.statusCode, res.body).toBe(200);
    const items = res.json().items as Array<Record<string, unknown>>;
    const listed = items.find((item) => item.id === freeTextTicketId);
    expect(listed).toBeDefined();
    expect(listed).toMatchObject({
      status: 'closed',
      raisedChannel: 'backfill',
      closeKind: 'report',
    });
    expect((listed?.figures as Record<string, unknown>).downtimeMin).toBe(105);

    const state = await get('/api/v1/state');
    expect(state.statusCode, state.body).toBe(200);
    expect(JSON.stringify(state.json())).not.toContain(freeTextTicketId);
  });

  it('erases a leaver named in the history: the replies lose the name and the free text is scrubbed', async () => {
    const before = await get(`/api/v1/tickets/${freeTextTicketId}`);
    expect(before.statusCode, before.body).toBe(200);
    expect(before.body).toContain(FREE_TEXT_PERSON);

    await withTenant(db.router, tenantId, (tx) =>
      erasePerson(tx, {
        tenantId,
        personId: freeTextPersonId,
        requestRef: 'request-37c-load',
        operator: 'agent-test',
      }),
    );

    const after = await get(`/api/v1/tickets/${freeTextTicketId}`);
    expect(after.statusCode, after.body).toBe(200);
    expect(after.body).not.toContain(FREE_TEXT_PERSON);
    const payload = after.json() as {
      ticket: Record<string, unknown>;
      report: Record<string, unknown>;
    };
    expect(payload.ticket.problem).toContain('Former staff');
    expect(payload.ticket.problem).not.toContain(FREE_TEXT_PERSON);
    expect(payload.report.problem).toContain('Former staff');
    expect(payload.report.correctiveAction).toContain('Former staff');

    const raw = await q(
      'SELECT payload FROM import_row WHERE tenant_id = $1 AND batch_id = $2 AND source_ref = $3',
      [tenantId, batchId, FREE_TEXT_ROW],
    );
    expect(raw.rows[0].payload).toEqual({});

    const list = await get(`/api/v1/tickets?from=${historyDay}&to=${nextDay(historyDay)}`);
    expect(list.statusCode, list.body).toBe(200);
    const listed = (list.json().items as Array<Record<string, unknown>>).find(
      (item) => item.id === freeTextTicketId,
    );
    expect(listed?.problem).toContain('Former staff');
    expect(list.body).not.toContain(FREE_TEXT_PERSON);
  });
});
