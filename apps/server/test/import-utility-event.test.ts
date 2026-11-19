/**
 * Ticket 69, packet 69a: the importer takes a plant event (one closed general ticket for a plant date, one
 * `utility_loss` history line per machine), switched-off old codes, machines that are no longer active and `P-`
 * person codes. Everything here is invented; no workbook, name or number is real.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { withTenant } from '@uptimo/db';
import { loadEngineData } from '../src/modules/analytics/index.js';
import { importBhavin, undoImport } from '../src/modules/imports/bhavin.js';
import { parseTicket } from '../src/modules/imports/schema.js';
import {
  makeOrdinaryTicket,
  makeSyntheticExport,
  seedSyntheticTenant,
  syntheticIds,
} from './import-fixture.js';
import { startTestDb, type TestDb } from './harness.js';

type Raw = Record<string, unknown>;
let db: TestDb;

const CHANDRA = 'a1b2c3d4-0000-0000-0000-00000000000c';
const DAY = '2023-03-04';

/** A past breakdown on `machine` (an alias of the fixture's M-1 unless it names another code). */
function pastBreakdown(overrides: Raw = {}, report: Raw = {}): Raw {
  const base = makeOrdinaryTicket(overrides);
  return {
    ...base,
    entryType: 'pastBreakdown',
    events: [base.events[0], base.events[3]],
    crew: [],
    segments: [],
    reports: [{ ...base.reports[0], ...report }],
    state: { ...base.state, startedAt: null, segmentStartedAt: null, leadPerson: null },
    storedFigures: { ...base.storedFigures, activeMin: 0 },
  } as Raw;
}

/** One plant date: a closed general ticket, a `utility_loss` line per machine, the longest line spans the day. */
function plantEvent(lines: Array<[string, number]>, overrides: Raw = {}): Raw {
  const start = new Date(`${DAY}T08:00:00Z`);
  const longest = Math.max(...lines.map(([, minutes]) => minutes));
  const end = new Date(start.getTime() + longest * 60_000).toISOString();
  const zero = { activeMin: 0, downAccMin: 0, downtimeMin: 0, repairMin: 0, vendorMin: 0 };
  return {
    legacyId: `lg-2023-uti-${DAY}`,
    ref: 'WR-30001',
    entryType: 'pastUtility',
    kind: 'general',
    status: 'closed',
    machineCode: null,
    location: 'Plant',
    workType: 'Utility failure',
    problem: 'Synthetic grid supply failure',
    reportedAt: start.toISOString(),
    reportedByPerson: null,
    parentRef: null,
    events: [
      { type: 'down', at: start.toISOString(), by: null, text: null, payload: {} },
      ...lines.map(([machineCode, minutes]) => ({
        type: 'utility_loss',
        at: start.toISOString(),
        by: null,
        text: null,
        payload: { machineCode, minutes, code: 'UTI' },
      })),
      { type: 'close', at: end, by: null, text: null, payload: { kind: 'done' } },
    ],
    crew: [],
    segments: [],
    reports: [],
    state: {
      ...makeOrdinaryTicket().state,
      startedAt: null,
      segmentStartedAt: null,
      leadPerson: null,
      closedAt: end,
      closedByPerson: null,
      closeKind: 'done',
      closeNote: null,
    },
    storedFigures: { ...makeOrdinaryTicket().storedFigures, ...zero, responseMin: null },
    ...overrides,
  };
}

const threeMachines = (): Array<[string, number]> => [
  ['SYNTH-MACHINE', 90],
  ['M-2', 45],
  ['M-3', 0],
];

async function figures() {
  const reports = await db.admin.query(
    `SELECT count(*)::int AS n, COALESCE(sum(downtime_min), 0)::int AS down,
            COALESCE(sum(repair_min), 0)::int AS repair FROM breakdown_report WHERE tenant_id = $1`,
    [syntheticIds.tenant],
  );
  const stopped = await db.admin.query(
    "SELECT count(*)::int AS n FROM ticket WHERE tenant_id = $1 AND kind = 'stopped'",
    [syntheticIds.tenant],
  );
  const row = reports.rows[0] as { n: number; down: number; repair: number };
  return {
    count: row.n,
    downtime: row.down,
    mttr: row.n === 0 ? 0 : row.repair / row.n,
    stopped: (stopped.rows[0] as { n: number }).n,
  };
}

async function engineReports(): Promise<unknown> {
  return withTenant(db.app, syntheticIds.tenant, async (client) => {
    const data = await loadEngineData(client, syntheticIds.tenant);
    return data.reports.map((report) => ({ ...report, id: undefined }));
  });
}

async function run(tickets: Raw[], aliases = makeSyntheticExport().aliases) {
  return importBhavin(db.app, syntheticIds.tenant, makeSyntheticExport(tickets, aliases));
}

const count = async (sql: string, ...params: unknown[]): Promise<number> =>
  ((await db.admin.query(sql, [syntheticIds.tenant, ...params])).rows[0] as { n: number }).n;

beforeAll(async () => {
  db = await startTestDb();
}, 120_000);

beforeEach(async () => {
  await db.admin.query('DELETE FROM tenant');
  await seedSyntheticTenant(db.admin);
  const t = syntheticIds.tenant;
  await db.admin.query(
    `INSERT INTO machine (tenant_id, code, category, cell, status) VALUES
       ($1, 'M-2', 'CNC', 'Cell-1', 'active'), ($1, 'M-3', 'CNC', 'Cell-1', 'active'),
       ($1, 'M-OLD', 'CNC', 'Cell-1', 'scrapped')`,
    [t],
  );
  await db.admin.query(
    `INSERT INTO list_item (tenant_id, list, code, label, active) VALUES
       ($1, 'location', 'Plant', 'Plant', true),
       ($1, 'work_type', 'Utility failure', 'Utility failure', true),
       ($1, 'maint_code', 'TR', 'Switched-off synthetic code', false)`,
    [t],
  );
  await db.admin.query(
    "INSERT INTO person (id, tenant_id, name, team) VALUES ($1, $2, 'Chandra', 'maintenance')",
    [CHANDRA, t],
  );
});

afterAll(async () => {
  await db.stop();
});

describe('plant event (69a, R20)', () => {
  it('loads one closed general ticket with three lines and leaves every breakdown figure alone', async () => {
    const breakdown = pastBreakdown();
    expect((await run([breakdown])).stats).toMatchObject({ imported: 1, status: 'done' });
    const before = { figures: await figures(), engine: await engineReports() };
    expect(before.figures).toMatchObject({ count: 1, downtime: 60, stopped: 1 });

    const both = await run([breakdown, plantEvent(threeMachines())]);
    expect(both.stats).toMatchObject({ imported: 1, skipped: 1, errored: 0, status: 'done' });

    const tickets = await db.admin.query(
      `SELECT kind, status, machine_id, raised_channel, work_type, location, closed_at
         FROM ticket WHERE tenant_id = $1 AND ref = 'WR-30001'`,
      [syntheticIds.tenant],
    );
    expect(tickets.rows).toHaveLength(1);
    expect(tickets.rows[0]).toMatchObject({
      kind: 'general',
      status: 'closed',
      machine_id: null,
      raised_channel: 'backfill',
      work_type: 'Utility failure',
      location: 'Plant',
    });
    const lines = await db.admin.query(
      `SELECT payload FROM ticket_event WHERE tenant_id = $1 AND type = 'utility_loss' ORDER BY seq`,
      [syntheticIds.tenant],
    );
    const minutes = lines.rows.map((row) => (row.payload as { minutes: number }).minutes);
    expect(minutes).toEqual([90, 45, 0]);
    expect(minutes.reduce((a, b) => a + b, 0)).toBe(135);
    const machineIds = lines.rows.map((row) => (row.payload as { machineId: string }).machineId);
    const known = await db.admin.query(
      'SELECT code FROM machine WHERE tenant_id = $1 AND id = ANY($2) ORDER BY code',
      [syntheticIds.tenant, machineIds],
    );
    expect(known.rows.map((row) => row.code)).toEqual(['M-1', 'M-2', 'M-3']);
    expect(lines.rows[0]?.payload).toMatchObject({ code: 'UTI' });

    expect(await figures()).toEqual(before.figures);
    expect(await engineReports()).toEqual(before.engine);
  });

  it('skips the same file the second time and undo removes the ticket with its lines', async () => {
    const tickets = [pastBreakdown(), plantEvent(threeMachines())];
    const first = await run(tickets);
    expect(first.stats).toMatchObject({ imported: 2, status: 'done' });
    expect((await run(tickets)).stats).toMatchObject({ imported: 0, skipped: 2, status: 'done' });
    await undoImport(db.router, syntheticIds.tenant, first.batchId, 'agent-test');
    expect(await count('SELECT count(*)::int AS n FROM ticket WHERE tenant_id = $1')).toBe(0);
    expect(await count('SELECT count(*)::int AS n FROM ticket_event WHERE tenant_id = $1')).toBe(0);
  });

  it('refuses a line that names a machine the plant has never had, and loads nothing of that event', async () => {
    const bad = plantEvent([
      ['M-2', 30],
      ['NO-SUCH-MACHINE', 10],
    ]);
    const result = await run([bad]);
    expect(result.stats).toMatchObject({ imported: 0, errored: 1, status: 'failed' });
    expect(result.stats.issues[0]?.message).toContain('NO-SUCH-MACHINE');
    expect(await count('SELECT count(*)::int AS n FROM ticket WHERE tenant_id = $1')).toBe(0);
  });

  it('takes a line on a machine that is no longer active', async () => {
    const result = await run([plantEvent([['M-OLD', 20]])]);
    expect(result.stats).toMatchObject({ imported: 1, errored: 0, status: 'done' });
  });
});

describe('plant event shape (schema)', () => {
  const minutesOf = (value: unknown) => plantEvent([['M-2', 1]], { events: value });

  it('accepts the frozen shape and parses the line payload', () => {
    const parsed = parseTicket(plantEvent(threeMachines()));
    expect(parsed.entryType).toBe('pastUtility');
    expect(parsed.events.filter((event) => event.type === 'utility_loss')).toHaveLength(3);
  });

  it.each([
    ['a negative minute count', { machineCode: 'M-2', minutes: -1, code: null }, /minutes/],
    ['a fractional minute count', { machineCode: 'M-2', minutes: 1.5, code: null }, /minutes/],
    ['an extra key', { machineCode: 'M-2', minutes: 1, code: null, note: 'x' }, /note/],
    ['no machine', { minutes: 1, code: null }, /machineCode/],
  ])('refuses %s', (_name, payload, why) => {
    const at = `${DAY}T08:00:00Z`;
    const events = [
      { type: 'down', at, by: null, text: null, payload: {} },
      { type: 'utility_loss', at, by: null, text: null, payload },
      { type: 'close', at, by: null, text: null, payload: { kind: 'done' } },
    ];
    expect(() => parseTicket(minutesOf(events))).toThrow(why);
  });

  it('refuses a plant event that carries a machine, a report, crew or a non-general kind', () => {
    expect(() => parseTicket(plantEvent([['M-2', 1]], { machineCode: 'M-2' }))).toThrow(
      /General tickets require null machine/,
    );
    expect(() => parseTicket(plantEvent([['M-2', 1]], { kind: 'stopped', ref: 'BD-1' }))).toThrow(
      /Plant event requires general/,
    );
    expect(() => parseTicket(plantEvent([['M-2', 1]], { reports: [{}] }))).toThrow(/reports/);
  });

  it('refuses a utility line on an ordinary or past-breakdown ticket', async () => {
    const line = {
      type: 'utility_loss',
      at: `${DAY}T08:00:00Z`,
      by: null,
      text: null,
      payload: { machineCode: 'M-2', minutes: 5, code: null },
    };
    const sneaky = pastBreakdown();
    (sneaky.events as unknown[]).splice(1, 0, line);
    const result = await run([sneaky]);
    expect(result.stats).toMatchObject({ imported: 0, errored: 1 });
    expect(result.stats.issues[0]?.message).toContain('utility_loss_requires_plant_event');
    expect(await count('SELECT count(*)::int AS n FROM ticket WHERE tenant_id = $1')).toBe(0);
  });

  it('refuses a plant event whose lines are not between the raise and the close', async () => {
    const event = plantEvent([['M-2', 5]]);
    const events = event.events as unknown[];
    const result = await run([{ ...event, events: [events[0], events[2], events[1]] }]);
    expect(result.stats).toMatchObject({ imported: 0, errored: 1 });
    expect(result.stats.issues[0]?.message).toContain('past_utility_shape');
  });
});

describe('old codes, retired machines and person codes (69a, R9, R14prime)', () => {
  it('loads a past breakdown coded with a switched-off entry, with that code', async () => {
    const result = await run([pastBreakdown({}, { maintCode: 'TR' })]);
    expect(result.stats).toMatchObject({ imported: 1, errored: 0, status: 'done' });
    expect(
      await count(
        "SELECT count(*)::int AS n FROM breakdown_report WHERE tenant_id = $1 AND maint_code = 'TR'",
      ),
    ).toBe(1);
  });

  it('reports a code with no entry at all and loads nothing', async () => {
    const result = await run([pastBreakdown({}, { maintCode: 'ZZ' })]);
    expect(result.stats).toMatchObject({ imported: 0, errored: 1, status: 'failed' });
    expect(result.stats.issues[0]).toMatchObject({ code: 'unknown_code' });
    expect(result.stats.issues[0]?.message).toContain('ZZ');
    expect(await count('SELECT count(*)::int AS n FROM ticket WHERE tenant_id = $1')).toBe(0);
  });

  it('still refuses a switched-off code on a live (ordinary) ticket', async () => {
    const ordinary = makeOrdinaryTicket({
      reports: [{ ...makeOrdinaryTicket().reports[0], maintCode: 'TR' }],
    });
    const result = await run([ordinary]);
    expect(result.stats).toMatchObject({ imported: 0, errored: 1 });
    expect(result.stats.issues[0]).toMatchObject({ code: 'unknown_code' });
  });

  it('loads a past breakdown on a retired machine and refuses a live ticket on it', async () => {
    const aliases = { ...makeSyntheticExport().aliases, machines: { 'SYNTH-MACHINE': 'M-OLD' } };
    const past = await run([pastBreakdown()], aliases);
    expect(past.stats).toMatchObject({ imported: 1, errored: 0, status: 'done' });
    const live = await run([makeOrdinaryTicket({ legacyId: 'live-1', ref: 'BD-0101' })], aliases);
    expect(live.stats).toMatchObject({ imported: 0, errored: 1 });
    expect(live.stats.issues[0]?.message).toContain('M-OLD');
  });

  it('links the person a P- alias names, by the first eight characters of the person id', async () => {
    const aliases = {
      ...makeSyntheticExport().aliases,
      people: { 'SYNTH-LEAD': 'P-a1b2c3d4' },
    };
    const result = await run([pastBreakdown({ reportedByPerson: 'SYNTH-LEAD' })], aliases);
    expect(result.stats).toMatchObject({ imported: 1, errored: 0, pendingPeople: 0 });
    const done = await db.admin.query(
      `SELECT p.person_id FROM breakdown_report_person p WHERE p.tenant_id = $1 AND p.role = 'done'`,
      [syntheticIds.tenant],
    );
    expect(done.rows.map((row) => row.person_id)).toEqual([CHANDRA]);
  });

  it('refuses a P- alias that no active person carries', async () => {
    const aliases = { ...makeSyntheticExport().aliases, people: { 'SYNTH-LEAD': 'P-ffffffff' } };
    const result = await run([pastBreakdown()], aliases);
    expect(result.stats).toMatchObject({ imported: 0, errored: 1 });
  });
});
