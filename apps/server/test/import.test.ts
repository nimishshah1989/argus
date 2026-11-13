import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { importBhavin, undoImport } from '../src/modules/imports/bhavin.js';
import {
  makeOrdinaryTicket,
  makeSyntheticExport,
  seedSyntheticTenant,
  syntheticIds,
} from './import-fixture.js';
import { startTestDb, type TestDb } from './harness.js';

let db: TestDb;

const duplicate = makeOrdinaryTicket({ legacyId: 'leg-dup', ref: 'BD-0099' });
const full = makeOrdinaryTicket({ legacyId: 'leg-full' });
const malformed = { ...makeOrdinaryTicket({ legacyId: 'leg-bad', ref: 'BD-0101' }), problem: null };
const FIXTURE = makeSyntheticExport([duplicate, full, malformed]);

beforeAll(async () => {
  db = await startTestDb();
  await seedSyntheticTenant(db.admin);
  await db.admin.query(
    `INSERT INTO ticket (id, tenant_id, ref, kind, status, problem, reported_at, severity)
     VALUES ($1, $2, 'BD-0099', 'stopped', 'open', 'Synthetic pre-existing', '2026-10-01T10:00:00Z', 'S3')`,
    [randomUUID(), syntheticIds.tenant],
  );
}, 120_000);

afterAll(async () => {
  await db.stop();
});

describe('bhavin import', () => {
  let firstBatchId = '';

  it('imports a full ticket, skips a duplicate, and errors a malformed row', async () => {
    const { batchId, stats } = await importBhavin(db.app, syntheticIds.tenant, FIXTURE);
    firstBatchId = batchId;
    expect(stats).toMatchObject({
      status: 'failed',
      tickets: 3,
      imported: 1,
      skipped: 1,
      errored: 1,
      events: 4,
      crew: 2,
      segments: 2,
      reports: 1,
      reportPeople: 2,
      hardMismatches: 0,
    });

    const ticketRows = await db.admin.query(
      `SELECT id, ref, last_event_seq, response_min, active_min, repair_min, downtime_min,
        work_type, location, raised_channel
       FROM ticket WHERE tenant_id = $1 ORDER BY ref`,
      [syntheticIds.tenant],
    );
    const imported = ticketRows.rows.find((row: { ref: string }) => row.ref === 'BD-0100');
    expect(imported).toMatchObject({
      last_event_seq: 3,
      response_min: 5,
      active_min: 55,
      repair_min: 55,
      downtime_min: 60,
      work_type: 'breakdown',
      location: 'Cell-1',
      raised_channel: 'import',
    });
    expect(ticketRows.rows.filter((row: { ref: string }) => row.ref === 'BD-0099')).toHaveLength(1);

    const ticketId = (imported as { id: string }).id;
    const count = async (sqlText: string) =>
      (await db.admin.query(sqlText, [ticketId])).rows[0].n as number;
    expect(await count('SELECT count(*)::int AS n FROM ticket_event WHERE ticket_id = $1')).toBe(4);
    expect(await count('SELECT count(*)::int AS n FROM crew_member WHERE ticket_id = $1')).toBe(2);
    expect(await count('SELECT count(*)::int AS n FROM work_segment WHERE ticket_id = $1')).toBe(2);
    expect(
      await count('SELECT count(*)::int AS n FROM breakdown_report WHERE ticket_id = $1'),
    ).toBe(1);
    expect(
      await count(
        'SELECT count(*)::int AS n FROM breakdown_report_person WHERE report_id IN (SELECT id FROM breakdown_report WHERE ticket_id = $1)',
      ),
    ).toBe(2);
    const events = await db.admin.query(
      'SELECT seq, type, acting_person_id, payload FROM ticket_event WHERE ticket_id = $1 ORDER BY seq',
      [ticketId],
    );
    expect(events.rows.map((row: { seq: number }) => row.seq)).toEqual([0, 1, 2, 3]);
    expect(events.rows.map((row: { type: string }) => row.type)).toEqual([
      'down',
      'start',
      'join',
      'close',
    ]);
    expect(events.rows[2]).toMatchObject({
      acting_person_id: syntheticIds.bina,
      payload: { role: 'support' },
    });

    const rows = await db.admin.query(
      'SELECT row_number, status, ticket_id FROM import_row WHERE batch_id = $1 ORDER BY row_number',
      [batchId],
    );
    expect(rows.rows.map((row: { status: string }) => row.status)).toEqual([
      'skipped',
      'imported',
      'error',
    ]);
    expect(rows.rows[1].ticket_id).toBe(ticketId);
  });

  it('re-running skips the already-imported rows', async () => {
    const { stats } = await importBhavin(db.app, syntheticIds.tenant, FIXTURE);
    expect(stats.imported).toBe(0);
    expect(stats.skipped).toBe(2);
    expect(stats.errored).toBe(1);
  });

  it('undo removes the imported tickets', async () => {
    const { deleted } = await undoImport(db.app, syntheticIds.tenant, firstBatchId);
    expect(deleted).toBe(1);
    const remains = await db.admin.query(
      "SELECT count(*)::int AS n FROM ticket WHERE tenant_id = $1 AND ref = 'BD-0100'",
      [syntheticIds.tenant],
    );
    expect(remains.rows[0].n).toBe(0);
    const batch = await db.admin.query(
      'SELECT status, finished_at FROM import_batch WHERE id = $1',
      [firstBatchId],
    );
    expect(batch.rows[0].status).toBe('undone');
    const raw = await db.admin.query(
      'SELECT status, payload FROM import_row WHERE batch_id = $1 AND row_number = 2',
      [firstBatchId],
    );
    expect(raw.rows[0].status).toBe('imported');
    expect(raw.rows[0].payload.format).toBe('argus.import-raw/v1');
  });
});
