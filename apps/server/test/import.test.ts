import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { importBhavin, undoImport } from '../src/import/bhavin.js';
import { startTestDb, type TestDb } from './harness.js';

const TENANT = '10000000-0000-0000-0000-000000000001';
const MACHINE = '10000000-0000-0000-0000-000000000002';
const ASHA = '10000000-0000-0000-0000-000000000003';
const BINA = '10000000-0000-0000-0000-000000000004';
const EXISTING_TICKET = '10000000-0000-0000-0000-000000000005';

let db: TestDb;

// Synthetic fixture for the documented Bhavin export format (the real N1 export is pending).
const FIXTURE = {
  source: 'bhavin-v3',
  tickets: [
    {
      legacyId: 'leg-dup',
      ref: 'BD-099', // matches a pre-seeded ticket → skipped
      kind: 'stopped',
      status: 'open',
      machineCode: null,
      problem: 'Duplicate',
      reportedAt: '2026-11-01T10:00:00Z',
      events: [],
      crew: [],
      segments: [],
      reports: [],
    },
    {
      legacyId: 'leg-full',
      ref: 'BD-100',
      kind: 'stopped',
      status: 'closed',
      machineCode: 'M-1',
      location: 'Cell-1',
      workType: 'breakdown',
      problem: 'Spindle alarm',
      reportedAt: '2026-11-01T10:00:00Z',
      reportedByPerson: 'Asha',
      startedAt: '2026-11-01T10:05:00Z',
      closedAt: '2026-11-01T11:05:00Z',
      cancelledAt: null,
      closeKind: 'report',
      closeNote: 'Fixed',
      leadPerson: 'Asha',
      parentRef: null,
      events: [
        { type: 'down', at: '2026-11-01T10:00:00Z', by: 'Asha', text: null, payload: {} },
        { type: 'start', at: '2026-11-01T10:05:00Z', by: 'Asha', text: null, payload: {} },
        { type: 'close', at: '2026-11-01T11:05:00Z', by: 'Asha', text: 'Fixed', payload: {} },
      ],
      crew: [
        {
          person: 'Asha',
          role: 'lead',
          joinedAt: '2026-11-01T10:05:00Z',
          leftAt: null,
          leftReason: null,
        },
        {
          person: 'Bina',
          role: 'support',
          joinedAt: '2026-11-01T10:30:00Z',
          leftAt: '2026-11-01T11:00:00Z',
          leftReason: 'done',
        },
      ],
      segments: [
        {
          person: 'Asha',
          role: 'lead',
          startedAt: '2026-11-01T10:05:00Z',
          endedAt: '2026-11-01T11:05:00Z',
          endReason: 'close',
        },
        {
          person: 'Bina',
          role: 'support',
          startedAt: '2026-11-01T10:30:00Z',
          endedAt: '2026-11-01T11:00:00Z',
          endReason: 'leave',
        },
      ],
      reports: [
        {
          kind: 'breakdown',
          problem: 'Spindle alarm',
          observedBy: 'Asha',
          correctiveAction: 'Replaced spindle',
          downtimeMin: 60,
          responseMin: 5,
          repairMin: 55,
          doneBy: ['Asha'],
          supportedBy: ['Bina'],
        },
      ],
    },
    {
      // malformed: missing the required `problem` → error, batch continues
      legacyId: 'leg-bad',
      ref: 'BD-101',
      kind: 'stopped',
      status: 'open',
      reportedAt: '2026-11-02T10:00:00Z',
    },
  ],
};

beforeAll(async () => {
  db = await startTestDb();
  await db.admin.query("INSERT INTO tenant (id, slug, name) VALUES ($1, 'cosmos', 'Cosmos')", [
    TENANT,
  ]);
  await db.admin.query(
    "INSERT INTO machine (id, tenant_id, code, category, cell) VALUES ($1, $2, 'M-1', 'CNC', 'Cell-1')",
    [MACHINE, TENANT],
  );
  await db.admin.query(
    "INSERT INTO person (id, tenant_id, name, team) VALUES ($1, $2, 'Asha', 'maintenance'), ($3, $2, 'Bina', 'maintenance')",
    [ASHA, TENANT, BINA],
  );
  await db.admin.query(
    "INSERT INTO ticket (id, tenant_id, ref, kind, status, problem, reported_at) VALUES ($1, $2, 'BD-099', 'stopped', 'open', 'Existing', now())",
    [EXISTING_TICKET, TENANT],
  );
}, 120_000);

afterAll(async () => {
  await db.stop();
});

describe('bhavin import', () => {
  let firstBatchId = '';

  it('imports a full ticket, skips a duplicate, and errors a malformed row', async () => {
    const { batchId, stats } = await importBhavin(db.app, TENANT, FIXTURE);
    firstBatchId = batchId;
    expect(stats).toEqual({
      tickets: 3,
      imported: 1,
      skipped: 1,
      errored: 1,
      events: 3,
      crew: 2,
      segments: 2,
    });

    const ticketRows = await db.admin.query(
      'SELECT id, ref FROM ticket WHERE tenant_id = $1 ORDER BY ref',
      [TENANT],
    );
    const imported = ticketRows.rows.find((r: { ref: string }) => r.ref === 'BD-100');
    expect(imported).toBeTruthy();
    expect(ticketRows.rows.filter((r: { ref: string }) => r.ref === 'BD-099')).toHaveLength(1);

    const ticketId = (imported as { id: string }).id;
    const count = async (sqlText: string) =>
      (await db.admin.query(sqlText, [ticketId])).rows[0].n as number;
    expect(await count('SELECT count(*)::int AS n FROM ticket_event WHERE ticket_id = $1')).toBe(3);
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

    const rows = await db.admin.query(
      'SELECT row_number, status FROM import_row WHERE batch_id = $1 ORDER BY row_number',
      [batchId],
    );
    expect(rows.rows.map((r: { status: string }) => r.status)).toEqual([
      'skipped',
      'imported',
      'error',
    ]);
  });

  it('re-running skips the already-imported rows', async () => {
    const { stats } = await importBhavin(db.app, TENANT, FIXTURE);
    expect(stats.imported).toBe(0);
    expect(stats.skipped).toBe(2);
    expect(stats.errored).toBe(1);
  });

  it('undo removes the imported tickets', async () => {
    const { deleted } = await undoImport(db.app, TENANT, firstBatchId);
    expect(deleted).toBe(1);
    const remains = await db.admin.query(
      "SELECT count(*)::int AS n FROM ticket WHERE tenant_id = $1 AND ref = 'BD-100'",
      [TENANT],
    );
    expect(remains.rows[0].n).toBe(0);
    const batch = await db.admin.query('SELECT status FROM import_batch WHERE id = $1', [
      firstBatchId,
    ]);
    expect(batch.rows[0].status).toBe('undone');
  });
});
