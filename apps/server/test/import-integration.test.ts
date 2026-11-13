import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ImportFatalError } from '../src/modules/imports/batch.js';
import { importBhavin, undoImport } from '../src/modules/imports/bhavin.js';
import {
  makeOrdinaryTicket,
  makeSyntheticExport,
  seedSyntheticTenant,
  syntheticIds,
} from './import-fixture.js';
import { startTestDb, type TestDb } from './harness.js';

type RawTicket = Record<string, unknown>;
let db: TestDb;

function pastTicket(overrides: Record<string, unknown> = {}): RawTicket {
  const base = makeOrdinaryTicket(overrides);
  return {
    ...base,
    entryType: 'pastBreakdown',
    events: [base.events[0], base.events[3]],
    crew: [],
    segments: [],
    state: {
      ...base.state,
      startedAt: null,
      segmentStartedAt: null,
      leadPerson: null,
      selfStarted: false,
    },
    storedFigures: { ...base.storedFigures, activeMin: 0 },
  } as RawTicket;
}

function generalTicket(overrides: Record<string, unknown> = {}): RawTicket {
  const base = makeOrdinaryTicket({ ref: 'WR-0001', ...overrides });
  return {
    ...base,
    kind: 'general',
    machineCode: null,
    reports: [],
    events: base.events.map((event) =>
      event.type === 'close' ? { ...event, payload: { kind: 'done' } } : event,
    ),
    state: { ...base.state, closeKind: 'done' },
    storedFigures: { ...base.storedFigures, downAccMin: 0, downtimeMin: null },
  } as RawTicket;
}

function replaceLead(value: unknown, replacement: string): unknown {
  if (typeof value === 'string') return value === 'SYNTH-LEAD' ? replacement : value;
  if (Array.isArray(value)) return value.map((item) => replaceLead(item, replacement));
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, replaceLead(child, replacement)]),
    );
  }
  return value;
}

async function ticketCount(ref?: string): Promise<number> {
  const result = await db.admin.query(
    `SELECT count(*)::int AS n FROM ticket WHERE tenant_id = $1 ${ref ? 'AND ref = $2' : ''}`,
    ref ? [syntheticIds.tenant, ref] : [syntheticIds.tenant],
  );
  return result.rows[0].n as number;
}

beforeAll(async () => {
  db = await startTestDb();
}, 120_000);

beforeEach(async () => {
  await db.admin.query('DROP TRIGGER IF EXISTS fail_middle ON ticket');
  await db.admin.query('DROP TRIGGER IF EXISTS fail_raw ON import_row');
  await db.admin.query('DROP TRIGGER IF EXISTS fail_done ON import_batch');
  await db.admin.query('DROP FUNCTION IF EXISTS fail_middle_ticket()');
  await db.admin.query('DROP FUNCTION IF EXISTS fail_raw_row()');
  await db.admin.query('DROP FUNCTION IF EXISTS fail_done_batch()');
  await db.admin.query('DELETE FROM tenant');
  await seedSyntheticTenant(db.admin);
});

afterAll(async () => {
  await db.stop();
});

describe('synthetic importer integration', () => {
  it('T39 preserves canonical identity, in-file duplicates, conflicts, and undone reimport', async () => {
    const input = makeSyntheticExport();
    const first = await importBhavin(db.app, syntheticIds.tenant, input);
    expect(first.stats).toMatchObject({ imported: 1, skipped: 0, status: 'done' });
    const rerun = await importBhavin(db.app, syntheticIds.tenant, input);
    expect(rerun.stats).toMatchObject({ imported: 0, skipped: 1, status: 'done' });
    const changed = makeOrdinaryTicket({ problem: 'Changed payload' });
    const conflict = await importBhavin(
      db.app,
      syntheticIds.tenant,
      makeSyntheticExport([changed]),
    );
    expect(conflict.stats).toMatchObject({ imported: 0, errored: 1, status: 'failed' });
    const otherLegacy = makeOrdinaryTicket({ legacyId: 'other-legacy' });
    const refConflict = await importBhavin(
      db.app,
      syntheticIds.tenant,
      makeSyntheticExport([otherLegacy]),
    );
    expect(refConflict.stats.errored).toBe(1);
    await undoImport(db.router, syntheticIds.tenant, first.batchId, 'agent-test');
    const revived = await importBhavin(db.app, syntheticIds.tenant, input);
    expect(revived.stats.imported).toBe(1);
    expect(await ticketCount('BD-0100')).toBe(1);
  });

  it('T39 imports an identical in-file duplicate once and rejects a conflicting duplicate', async () => {
    const same = makeOrdinaryTicket();
    const duplicates = await importBhavin(
      db.app,
      syntheticIds.tenant,
      makeSyntheticExport([same, same]),
    );
    expect(duplicates.stats).toMatchObject({ imported: 1, skipped: 1, errored: 0 });
    expect(await ticketCount()).toBe(1);
    const changed = makeOrdinaryTicket({ ref: 'BD-0101' });
    const conflict = await importBhavin(
      db.app,
      syntheticIds.tenant,
      makeSyntheticExport([makeOrdinaryTicket(), changed]),
    );
    expect(conflict.stats).toMatchObject({ imported: 0, skipped: 1, errored: 1 });
  });

  it('T40 serializes concurrent identical imports', async () => {
    const input = makeSyntheticExport();
    const [first, second] = await Promise.all([
      importBhavin(db.app, syntheticIds.tenant, input),
      importBhavin(db.app, syntheticIds.tenant, input),
    ]);
    expect(first.stats.imported + second.stats.imported).toBe(1);
    expect(first.stats.skipped + second.stats.skipped).toBe(1);
    expect(first.stats.errored + second.stats.errored).toBe(0);
    expect(await ticketCount()).toBe(1);
  });

  it('T41 projects canonical reference codes and retains raw provenance', async () => {
    const ticket = makeOrdinaryTicket({ workType: 'BREAKDOWN', location: ' cell-1 ' });
    const { stats } = await importBhavin(
      db.app,
      syntheticIds.tenant,
      makeSyntheticExport([ticket]),
    );
    expect(stats.status).toBe('done');
    const result = await db.admin.query(
      `SELECT t.work_type, t.location, r.maint_code, ir.payload
       FROM ticket t JOIN breakdown_report r ON r.ticket_id = t.id
       JOIN import_row ir ON ir.ticket_id = t.id WHERE t.tenant_id = $1`,
      [syntheticIds.tenant],
    );
    expect(result.rows[0]).toMatchObject({
      work_type: 'breakdown',
      location: 'Cell-1',
      maint_code: 'M',
    });
    expect(result.rows[0].payload.raw).toMatchObject({
      workType: 'BREAKDOWN',
      location: ' cell-1 ',
    });
  });

  it('T34 uses the supplied tenant timezone for report-shift validation', async () => {
    const { stats } = await importBhavin(db.app, syntheticIds.tenant, makeSyntheticExport(), {
      timeZone: 'America/New_York',
    });
    expect(stats).toMatchObject({ imported: 0, errored: 1, status: 'failed' });
    expect(stats.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'report_shift' })]),
    );
  });

  it('T41 inserts and counts 128 done plus 128 supported past-breakdown people', async () => {
    const ticket = pastTicket({
      reports: [
        {
          ...makeOrdinaryTicket().reports[0],
          doneBy: Array.from({ length: 128 }, (_, index) => `Done ${index + 1}`),
          supportedBy: Array.from({ length: 128 }, (_, index) => `Supported ${index + 1}`),
        },
      ],
    });
    const { stats } = await importBhavin(
      db.app,
      syntheticIds.tenant,
      makeSyntheticExport([ticket]),
    );
    expect(stats).toMatchObject({ reportPeople: 256, pendingPeople: 256, status: 'done' });
    const counts = await db.admin.query(
      `SELECT role, count(*)::int AS n FROM breakdown_report_person
       WHERE tenant_id = $1 GROUP BY role ORDER BY role`,
      [syntheticIds.tenant],
    );
    expect(counts.rows).toEqual([
      { role: 'done', n: 128 },
      { role: 'supported', n: 128 },
    ]);
  });

  it('T42 tracks pending provenance and rejects ambiguous active names', async () => {
    const vendor = replaceLead(makeOrdinaryTicket(), 'Vendor Team') as RawTicket;
    const aliases = {
      ...makeSyntheticExport().aliases,
      people: { 'Vendor Team': 'Synthetic Vendor' },
    };
    const resolved = await importBhavin(
      db.app,
      syntheticIds.tenant,
      makeSyntheticExport([vendor], aliases),
    );
    expect(resolved.stats.pendingPeople).toBe(0);
    const unknown = replaceLead(
      makeOrdinaryTicket({ ref: 'BD-0101', legacyId: 'unknown-person' }),
      'New Person',
    ) as RawTicket;
    const pending = await importBhavin(db.app, syntheticIds.tenant, makeSyntheticExport([unknown]));
    expect(pending.stats).toMatchObject({ pendingPeople: 1, pendingPersons: ['New Person'] });
    await db.admin.query(
      "INSERT INTO person (tenant_id, name, team) VALUES ($1, 'Asha', 'maintenance')",
      [syntheticIds.tenant],
    );
    const ambiguous = await importBhavin(db.app, syntheticIds.tenant, makeSyntheticExport());
    expect(ambiguous.stats).toMatchObject({ imported: 0, errored: 1 });
  });

  it('T43 resolves forward/backward parents and rejects missing and cyclic graphs', async () => {
    const child = generalTicket({ ref: 'WR-0001', parentRef: 'WR-0002', legacyId: 'child' });
    const parent = generalTicket({ ref: 'WR-0002', legacyId: 'parent' });
    const linked = await importBhavin(
      db.app,
      syntheticIds.tenant,
      makeSyntheticExport([child, parent]),
    );
    expect(linked.stats).toMatchObject({ imported: 2, errored: 0 });
    const row = await db.admin.query(
      `SELECT c.ref, p.ref AS parent FROM ticket c JOIN ticket p ON p.id = c.parent_id
       WHERE c.tenant_id = $1 AND c.ref = 'WR-0001'`,
      [syntheticIds.tenant],
    );
    expect(row.rows[0].parent).toBe('WR-0002');
    const missing = generalTicket({ ref: 'WR-0003', parentRef: 'WR-9999', legacyId: 'missing' });
    const failed = await importBhavin(db.app, syntheticIds.tenant, makeSyntheticExport([missing]));
    expect(failed.stats).toMatchObject({ imported: 0, errored: 1 });
    const cycleA = generalTicket({ ref: 'WR-0004', parentRef: 'WR-0005', legacyId: 'cycle-a' });
    const cycleB = generalTicket({ ref: 'WR-0005', parentRef: 'WR-0004', legacyId: 'cycle-b' });
    const cyclic = await importBhavin(
      db.app,
      syntheticIds.tenant,
      makeSyntheticExport([cycleA, cycleB]),
    );
    expect(cyclic.stats).toMatchObject({ imported: 0, errored: 2 });
    expect(await ticketCount('WR-0004')).toBe(0);
  });

  it('T43 repairs a cleared synthetic parent and refuses conflicting/non-import mutation', async () => {
    const child = generalTicket({ ref: 'WR-0001', parentRef: 'WR-0002', legacyId: 'child' });
    const parent = generalTicket({ ref: 'WR-0002', legacyId: 'parent' });
    const input = makeSyntheticExport([child, parent]);
    await importBhavin(db.app, syntheticIds.tenant, input);
    await db.admin.query(
      "UPDATE ticket SET parent_id = NULL WHERE tenant_id = $1 AND ref = 'WR-0001'",
      [syntheticIds.tenant],
    );
    const repaired = await importBhavin(db.app, syntheticIds.tenant, input);
    expect(repaired.stats.parentRepairs).toHaveLength(1);
    await db.admin.query(
      "UPDATE ticket SET parent_id = id WHERE tenant_id = $1 AND ref = 'WR-0001'",
      [syntheticIds.tenant],
    );
    const conflict = await importBhavin(db.app, syntheticIds.tenant, input);
    expect(conflict.stats.errored).toBeGreaterThan(0);
    const outside = await db.admin.query(
      "SELECT parent_id = id AS self_parent FROM ticket WHERE ref = 'WR-0001'",
    );
    expect(outside.rows[0].self_parent).toBe(true);
  });

  it('T44 rolls back a middle SQL failure and continues valid rows', async () => {
    await db.admin.query(
      `CREATE FUNCTION fail_middle_ticket() RETURNS trigger LANGUAGE plpgsql AS $$
       BEGIN IF NEW.ref = 'BD-0101' THEN RAISE EXCEPTION 'forced row failure' USING ERRCODE = '23514'; END IF; RETURN NEW; END; $$`,
    );
    await db.admin.query(
      'CREATE TRIGGER fail_middle BEFORE INSERT ON ticket FOR EACH ROW EXECUTE FUNCTION fail_middle_ticket()',
    );
    const rows = [
      makeOrdinaryTicket(),
      makeOrdinaryTicket({ ref: 'BD-0101', legacyId: 'middle' }),
      makeOrdinaryTicket({ ref: 'BD-0102', legacyId: 'last' }),
    ];
    const { stats } = await importBhavin(db.app, syntheticIds.tenant, makeSyntheticExport(rows));
    expect(stats).toMatchObject({ imported: 2, errored: 1, status: 'failed' });
    expect(await ticketCount('BD-0101')).toBe(0);
    expect(await ticketCount('BD-0102')).toBe(1);
  });

  it('T44 persists a minimal safe row after raw-insert failure', async () => {
    await db.admin.query(
      `CREATE FUNCTION fail_raw_row() RETURNS trigger LANGUAGE plpgsql AS $$
       BEGIN IF NEW.source_ref = 'raw-bad' AND NEW.payload->>'format' = 'argus.import-raw/v1'
       THEN RAISE EXCEPTION 'forced raw failure' USING ERRCODE = '23514'; END IF; RETURN NEW; END; $$`,
    );
    await db.admin.query(
      'CREATE TRIGGER fail_raw BEFORE INSERT ON import_row FOR EACH ROW EXECUTE FUNCTION fail_raw_row()',
    );
    const bad = makeOrdinaryTicket({ legacyId: 'raw-bad' });
    const good = makeOrdinaryTicket({ ref: 'BD-0101', legacyId: 'raw-good' });
    const { batchId, stats } = await importBhavin(
      db.app,
      syntheticIds.tenant,
      makeSyntheticExport([bad, good]),
    );
    expect(stats).toMatchObject({ imported: 1, errored: 1 });
    const raw = await db.admin.query(
      "SELECT status, payload->>'format' AS format, error FROM import_row WHERE batch_id = $1 AND source_ref = 'raw-bad'",
      [batchId],
    );
    expect(raw.rows[0]).toMatchObject({
      status: 'error',
      format: 'argus.import-error/v1',
      error: 'raw_insert_failed',
    });
  });

  it('T44 persists fatal batch state without partial work', async () => {
    await db.admin.query(
      `CREATE FUNCTION fail_done_batch() RETURNS trigger LANGUAGE plpgsql AS $$
       BEGIN IF NEW.status = 'done' THEN RAISE EXCEPTION 'forced fatal failure'; END IF; RETURN NEW; END; $$`,
    );
    await db.admin.query(
      'CREATE TRIGGER fail_done BEFORE UPDATE OF status ON import_batch FOR EACH ROW EXECUTE FUNCTION fail_done_batch()',
    );
    await expect(importBhavin(db.app, syntheticIds.tenant, makeSyntheticExport())).rejects.toThrow(
      ImportFatalError,
    );
    expect(await ticketCount()).toBe(0);
    const batch = await db.admin.query(
      "SELECT status, finished_at, stats->'fatal' AS fatal FROM import_batch WHERE source = 'bhavin'",
    );
    expect(batch.rows[0].status).toBe('failed');
    expect(batch.rows[0].finished_at).toBeInstanceOf(Date);
    expect(batch.rows[0].fatal).not.toBeNull();
    const rows = await db.admin.query('SELECT count(*)::int AS n FROM import_row');
    expect(rows.rows[0].n).toBe(0);
  });

  it('T45 advances both counters from every existing ref and never lowers on undo', async () => {
    await db.admin.query(
      `INSERT INTO ticket (id, tenant_id, ref, kind, status, problem, reported_at, severity)
       VALUES ($1, $2, 'BD-0999', 'stopped', 'closed', 'Higher existing', '2026-10-01T10:00:00Z', 'S3')`,
      [randomUUID(), syntheticIds.tenant],
    );
    const general = generalTicket({ ref: 'WR-0100', legacyId: 'general-high' });
    const { batchId, stats } = await importBhavin(
      db.app,
      syntheticIds.tenant,
      makeSyntheticExport([makeOrdinaryTicket(), general]),
    );
    expect(stats.refCounters).toEqual({ BD: 1000, WR: 101 });
    await undoImport(db.router, syntheticIds.tenant, batchId, 'agent-test');
    const counters = await db.admin.query(
      'SELECT prefix, next_value FROM ref_counter WHERE tenant_id = $1 ORDER BY prefix',
      [syntheticIds.tenant],
    );
    expect(counters.rows).toEqual([
      { prefix: 'BD', next_value: 1000 },
      { prefix: 'WR', next_value: 101 },
    ]);
  });

  it('T46 derives severity and the criticality snapshot for imported tickets', async () => {
    await db.admin.query("UPDATE machine SET criticality = 'A' WHERE id = $1", [
      syntheticIds.machine,
    ]);
    const { stats } = await importBhavin(db.app, syntheticIds.tenant, makeSyntheticExport());
    expect(stats).toMatchObject({ imported: 1, status: 'done' });
    const row = await db.admin.query(
      'SELECT severity, criticality_snapshot FROM ticket WHERE tenant_id = $1',
      [syntheticIds.tenant],
    );
    expect(row.rows[0]).toEqual({ severity: 'S1', criticality_snapshot: 'A' });
  });

  it('T45 fails closed on counter exhaustion', async () => {
    await db.admin.query(
      `INSERT INTO ticket (id, tenant_id, ref, kind, status, problem, reported_at, severity)
       VALUES ($1, $2, 'BD-2147483647', 'stopped', 'closed', 'Exhausted', '2026-10-01T10:00:00Z', 'S3')`,
      [randomUUID(), syntheticIds.tenant],
    );
    await expect(
      importBhavin(db.app, syntheticIds.tenant, makeSyntheticExport([])),
    ).rejects.toThrow(ImportFatalError);
    const batch = await db.admin.query("SELECT status FROM import_batch WHERE source = 'bhavin'");
    expect(batch.rows[0].status).toBe('failed');
  });

  it('T44 undoes a batch whose tickets follow each other', async () => {
    const child = generalTicket({ ref: 'WR-0001', parentRef: 'WR-0002', legacyId: 'child' });
    const parent = generalTicket({ ref: 'WR-0002', legacyId: 'parent' });
    const { batchId } = await importBhavin(
      db.app,
      syntheticIds.tenant,
      makeSyntheticExport([child, parent]),
    );
    await expect(
      undoImport(db.router, syntheticIds.tenant, batchId, 'agent-test'),
    ).resolves.toEqual({ deleted: 2 });
    expect(await ticketCount('WR-0001')).toBe(0);
    expect(await ticketCount('WR-0002')).toBe(0);
  });
});
