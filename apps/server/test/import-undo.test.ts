import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  emptyCompletionFingerprint,
  fingerprintMismatches,
  makeCompletionFingerprint,
} from '../src/import/fingerprint.js';
import { loadBatchSnapshot } from '../src/import/fingerprint-sql.js';
import {
  makeRawEnvelope,
  type CompletionFingerprint,
  type EntryType,
} from '../src/import/schema.js';
import { undoImport } from '../src/import/undo.js';
import {
  makeOrdinaryTicket,
  makeSyntheticExport,
  seedSyntheticTenant,
  syntheticIds,
  syntheticSource,
} from './import-fixture.js';
import { startTestDb, type TestDb } from './harness.js';

interface SeedOptions {
  status?: 'pending' | 'running' | 'done' | 'failed' | 'undone';
  source?: string;
  entryType?: EntryType;
  withTicket?: boolean;
  withSkipped?: boolean;
  staleSkipped?: boolean;
  withFingerprint?: boolean;
}

let db: TestDb;
let batchNumber = 0;

async function seedBatch(options: SeedOptions = {}) {
  const admin = db.admin;
  batchNumber += 1;
  const ref = `BD-${String(100 + batchNumber).padStart(4, '0')}`;
  const tenantId = syntheticIds.tenant;
  const batchId = randomUUID();
  const ticketId = randomUUID();
  const preexistingId = randomUUID();
  const legacyId = `synthetic-undo-${String(100 + batchNumber).padStart(4, '0')}`;
  const entryType = options.entryType ?? 'ordinary';
  const status = options.status ?? 'done';
  const finishedAt = new Date('2026-11-02T00:00:00.000Z');
  const raw = makeOrdinaryTicket({ entryType, legacyId, ref });
  const payload = makeRawEnvelope(raw, makeSyntheticExport().aliases);
  await admin.query(
    `INSERT INTO import_batch (id, tenant_id, source, status, started_at, finished_at, stats)
     VALUES ($1, $2, $3, $4, '2026-11-01T09:00:00Z', $5, $6)`,
    [
      batchId,
      tenantId,
      options.source ?? 'bhavin',
      status,
      finishedAt,
      JSON.stringify({ contract: syntheticSource }),
    ],
  );

  if (options.withSkipped || options.staleSkipped) {
    await admin.query(
      `INSERT INTO ticket (id, tenant_id, ref, kind, status, problem, reported_at)
       VALUES ($1, $2, 'BD-9000', 'stopped', 'open', 'Synthetic skipped', '2026-10-01T10:00:00Z')`,
      [preexistingId, tenantId],
    );
    await admin.query(
      `INSERT INTO import_row (tenant_id, batch_id, row_number, source_ref, status, payload, ticket_id)
       VALUES ($1, $2, 90, 'synthetic-skipped', 'skipped', $3, $4)`,
      [tenantId, batchId, JSON.stringify(payload), options.staleSkipped ? null : preexistingId],
    );
  }

  if (options.withTicket !== false) {
    await admin.query(
      `INSERT INTO ticket (
         id, tenant_id, ref, kind, status, machine_id, machine_snapshot, problem, reported_at,
         reported_by_person_id, raised_channel, started_at, lead_person_id, segment_started_at,
         machine_stopped_at, closed_at, closed_by_person_id, close_kind, close_note,
         last_event_seq, response_min, active_min, wait_min, vendor_min, handover_wait_min,
         down_acc_min, downtime_min, follow_min, repair_min, overrides
       ) VALUES (
         $1, $2, $7, 'stopped', 'closed', $3, $4, 'Synthetic spindle alarm',
         '2026-11-01T10:00:00Z', $5, $6, '2026-11-01T10:05:00Z', $5,
         '2026-11-01T10:05:00Z', '2026-11-01T10:00:00Z', '2026-11-01T11:00:00Z',
         $5, 'report', 'Synthetic repair complete', 3, 5, 55, 0, 0, 0, 60, 60, NULL, 55, '{}'
       )`,
      [
        ticketId,
        tenantId,
        syntheticIds.machine,
        JSON.stringify({ code: 'M-1', category: 'Synthetic category', cell: 'Synthetic cell' }),
        syntheticIds.asha,
        entryType === 'pastBreakdown' ? 'backfill' : 'import',
        ref,
      ],
    );
    await admin.query(
      `INSERT INTO ticket_event (tenant_id, ticket_id, seq, type, at, acting_person_id, text, payload)
       VALUES
        ($1, $2, 0, 'down', '2026-11-01T10:00:00Z', $3, NULL, '{}'),
        ($1, $2, 1, 'start', '2026-11-01T10:05:00Z', $3, NULL, '{}'),
        ($1, $2, 2, 'join', '2026-11-01T10:30:00Z', $4, NULL, '{"role":"support"}'),
        ($1, $2, 3, 'close', '2026-11-01T11:00:00Z', $3, 'Synthetic repair complete', '{"kind":"report"}')`,
      [tenantId, ticketId, syntheticIds.asha, syntheticIds.bina],
    );
    await admin.query(
      `INSERT INTO crew_member (tenant_id, ticket_id, person_id, role, joined_at, left_at, left_reason)
       VALUES
        ($1, $2, $3, 'primary', '2026-11-01T10:05:00Z', '2026-11-01T11:00:00Z', 'close'),
        ($1, $2, $4, 'support', '2026-11-01T10:30:00Z', '2026-11-01T11:00:00Z', 'close')`,
      [tenantId, ticketId, syntheticIds.asha, syntheticIds.bina],
    );
    await admin.query(
      `INSERT INTO work_segment (tenant_id, ticket_id, person_id, role, started_at, ended_at, end_reason)
       VALUES
        ($1, $2, $3, 'lead', '2026-11-01T10:05:00Z', '2026-11-01T11:00:00Z', 'close'),
        ($1, $2, $4, 'support', '2026-11-01T10:30:00Z', '2026-11-01T11:00:00Z', 'close')`,
      [tenantId, ticketId, syntheticIds.asha, syntheticIds.bina],
    );
    const report = await admin.query(
      `INSERT INTO breakdown_report (
         tenant_id, ticket_id, machine_id, date, shift_code, problem, observed_by,
         corrective_action, downtime_min, response_min, repair_min, breakdown_category,
         maint_code, root_cause, submitted_by_person_id, submitted_at
       ) VALUES (
         $1, $2, $3, '2026-11-01', '1', 'Synthetic spindle alarm', 'Asha',
         'Synthetic spindle reset', 60, 5, 55, 'M', 'M', 'Synthetic cause', $4,
         '2026-11-01T11:00:00Z'
       ) RETURNING id`,
      [tenantId, ticketId, syntheticIds.machine, syntheticIds.asha],
    );
    await admin.query(
      `INSERT INTO breakdown_report_person (tenant_id, report_id, person_id, role)
       VALUES ($1, $2, $3, 'done'), ($1, $2, $4, 'supported')`,
      [tenantId, report.rows[0].id, syntheticIds.asha, syntheticIds.bina],
    );
    await admin.query(
      `INSERT INTO import_row (tenant_id, batch_id, row_number, source_ref, status, payload, ticket_id)
       VALUES ($1, $2, 1, $3, 'imported', $4, $5)`,
      [tenantId, batchId, legacyId, JSON.stringify(payload), ticketId],
    );
  }

  const client = await admin.connect();
  let completion: CompletionFingerprint;
  try {
    const snapshot = await loadBatchSnapshot(client, tenantId, batchId, false);
    completion = makeCompletionFingerprint(snapshot);
  } finally {
    client.release();
  }
  if (options.withFingerprint !== false) {
    await admin.query('UPDATE import_batch SET stats = $1 WHERE id = $2', [
      JSON.stringify({ contract: syntheticSource, completion }),
      batchId,
    ]);
  }
  return { batchId, ticketId, preexistingId, legacyId, payload, completion, finishedAt };
}

async function refreshFingerprint(batchId: string): Promise<void> {
  const client = await db.admin.connect();
  let completion: CompletionFingerprint;
  try {
    completion = makeCompletionFingerprint(
      await loadBatchSnapshot(client, syntheticIds.tenant, batchId, false),
    );
  } finally {
    client.release();
  }
  await db.admin.query('UPDATE import_batch SET stats = $1 WHERE id = $2', [
    JSON.stringify({ contract: syntheticSource, completion }),
    batchId,
  ]);
}

async function counts(ticketId: string) {
  const result = await db.admin.query(
    `SELECT
      (SELECT count(*)::int FROM ticket WHERE tenant_id = $1 AND id = $2) AS ticket,
      (SELECT count(*)::int FROM ticket_event WHERE tenant_id = $1 AND ticket_id = $2) AS events,
      (SELECT count(*)::int FROM crew_member WHERE tenant_id = $1 AND ticket_id = $2) AS crew,
      (SELECT count(*)::int FROM work_segment WHERE tenant_id = $1 AND ticket_id = $2) AS segments,
      (SELECT count(*)::int FROM breakdown_report WHERE tenant_id = $1 AND ticket_id = $2) AS reports`,
    [syntheticIds.tenant, ticketId],
  );
  return result.rows[0] as {
    ticket: number;
    events: number;
    crew: number;
    segments: number;
    reports: number;
  };
}

beforeAll(async () => {
  db = await startTestDb();
}, 120_000);

afterAll(async () => {
  await db.stop();
});

describe('completion fingerprints', () => {
  it('uses the canonical empty fingerprint and detects no self mismatch', () => {
    const empty = emptyCompletionFingerprint();
    expect(empty).toEqual(makeCompletionFingerprint({ tickets: [] }));
    expect(empty).toMatchObject({ version: 1, algorithm: 'sha256', tickets: [] });
    expect(empty.digest).toMatch(/^[0-9a-f]{64}$/);
    expect(fingerprintMismatches(empty, emptyCompletionFingerprint())).toEqual([]);
  });
});

describe('undoImport terminal behavior and safety (T21–T25)', () => {
  beforeEach(async () => {
    batchNumber = 0;
    await db.admin.query('DELETE FROM tenant');
    await seedSyntheticTenant(db.admin);
    await db.admin.query(
      "INSERT INTO ref_counter (tenant_id, prefix, next_value) VALUES ($1, 'BD', 101), ($1, 'WR', 8)",
      [syntheticIds.tenant],
    );
  });

  it.each([
    { status: 'done' as const, entryType: 'ordinary' as const },
    { status: 'failed' as const, entryType: 'pastBreakdown' as const },
  ])(
    'T21 undoes $status $entryType imports while preserving independent data',
    async ({ status, entryType }) => {
      const seeded = await seedBatch({ status, entryType, withSkipped: true });
      const peopleBefore = await db.admin.query(
        'SELECT count(*)::int AS n FROM person WHERE tenant_id = $1',
        [syntheticIds.tenant],
      );
      expect(await counts(seeded.ticketId)).toEqual({
        ticket: 1,
        events: 4,
        crew: 2,
        segments: 2,
        reports: 1,
      });

      await expect(undoImport(db.app, syntheticIds.tenant, seeded.batchId)).resolves.toEqual({
        deleted: 1,
      });
      expect(await counts(seeded.ticketId)).toEqual({
        ticket: 0,
        events: 0,
        crew: 0,
        segments: 0,
        reports: 0,
      });
      const preserved = await db.admin.query(
        `SELECT b.status, b.finished_at, ir.payload,
        (SELECT count(*)::int FROM ticket WHERE tenant_id = $1 AND id = $3) AS skipped,
        (SELECT count(*)::int FROM person WHERE tenant_id = $1) AS people,
        (SELECT next_value FROM ref_counter WHERE tenant_id = $1 AND prefix = 'BD') AS counter,
        (SELECT count(*)::int FROM audit_log WHERE tenant_id = $1 AND entity_id = $2) AS audits
       FROM import_batch b JOIN import_row ir ON ir.batch_id = b.id AND ir.row_number = 1
       WHERE b.tenant_id = $1 AND b.id = $2`,
        [syntheticIds.tenant, seeded.batchId, seeded.preexistingId],
      );
      expect(preserved.rows[0]).toMatchObject({
        status: 'undone',
        skipped: 1,
        people: peopleBefore.rows[0].n,
        counter: 101,
        audits: 1,
      });
      expect(preserved.rows[0].payload).toEqual(seeded.payload);
      expect(preserved.rows[0].finished_at).toEqual(seeded.finishedAt);
    },
  );

  it('T21 cascades ticket tags on undo while preserving the tenant', async () => {
    const seeded = await seedBatch();
    const item = await db.admin.query(
      "SELECT id FROM list_item WHERE tenant_id = $1 AND list = 'maint_code' AND code = 'M'",
      [syntheticIds.tenant],
    );
    await db.admin.query(
      `INSERT INTO ticket_tag (tenant_id, ticket_id, item_id, applied_by_person_id)
       VALUES ($1, $2, $3, $4)`,
      [syntheticIds.tenant, seeded.ticketId, item.rows[0].id, syntheticIds.asha],
    );

    await expect(undoImport(db.app, syntheticIds.tenant, seeded.batchId)).resolves.toEqual({
      deleted: 1,
    });
    expect(
      (
        await db.admin.query('SELECT count(*)::int AS n FROM ticket_tag WHERE ticket_id = $1', [
          seeded.ticketId,
        ])
      ).rows[0].n,
    ).toBe(0);
    expect((await counts(seeded.ticketId)).ticket).toBe(0);
    expect(
      (
        await db.admin.query('SELECT count(*)::int AS n FROM tenant WHERE id = $1', [
          syntheticIds.tenant,
        ])
      ).rows[0].n,
    ).toBe(1);
  });

  it('T22 rejects a missing batch without writes', async () => {
    await expect(undoImport(db.app, syntheticIds.tenant, randomUUID())).rejects.toThrow(
      /not found/i,
    );
    expect(await db.admin.query('SELECT count(*)::int AS n FROM audit_log')).toEqual(
      expect.objectContaining({ rows: [{ n: 0 }] }),
    );
  });

  it.each(['pending', 'running', 'undone'] as const)(
    'T22 rejects terminal-invalid status %s',
    async (status) => {
      const seeded = await seedBatch({ status });
      await expect(undoImport(db.app, syntheticIds.tenant, seeded.batchId)).rejects.toThrow(
        /status|undone|pending|running/i,
      );
      expect((await counts(seeded.ticketId)).ticket).toBe(1);
    },
  );

  it('T22 rejects wrong tenant and non-Bhavin provenance', async () => {
    const wrongTenant = await seedBatch();
    const otherTenant = randomUUID();
    await db.admin.query(
      "INSERT INTO tenant (id, slug, name) VALUES ($1, 'other', 'Synthetic Other')",
      [otherTenant],
    );
    await expect(undoImport(db.app, otherTenant, wrongTenant.batchId)).rejects.toThrow(
      /not found/i,
    );
    expect((await counts(wrongTenant.ticketId)).ticket).toBe(1);

    const wrongSource = await seedBatch({ source: 'seed' });
    await expect(undoImport(db.app, syntheticIds.tenant, wrongSource.batchId)).rejects.toThrow(
      /not found|source/i,
    );
    expect((await counts(wrongSource.ticketId)).ticket).toBe(1);
  });

  it('T22 rejects absent fingerprints, changed provenance, and wrong channels', async () => {
    const noFingerprint = await seedBatch({ withFingerprint: false });
    await expect(undoImport(db.app, syntheticIds.tenant, noFingerprint.batchId)).rejects.toThrow(
      /fingerprint/i,
    );

    const wrongProvenance = await seedBatch();
    await db.admin.query(
      'UPDATE import_row SET source_ref = $1 WHERE batch_id = $2 AND row_number = 1',
      ['changed-legacy-id', wrongProvenance.batchId],
    );
    await expect(undoImport(db.app, syntheticIds.tenant, wrongProvenance.batchId)).rejects.toThrow(
      /provenance|legacyId|fingerprint/i,
    );

    const wrongChannel = await seedBatch();
    await db.admin.query("UPDATE ticket SET raised_channel = 'floor' WHERE id = $1", [
      wrongChannel.ticketId,
    ]);
    await expect(undoImport(db.app, syntheticIds.tenant, wrongChannel.batchId)).rejects.toThrow(
      /channel|fingerprint/i,
    );
    for (const seeded of [noFingerprint, wrongProvenance, wrongChannel]) {
      expect((await counts(seeded.ticketId)).ticket).toBe(1);
    }
  });

  it.each([
    {
      label: 'ticket state',
      mutate: async (ticketId: string) =>
        db.admin.query("UPDATE ticket SET status = 'working' WHERE id = $1", [ticketId]),
    },
    {
      label: 'ticket cache',
      mutate: async (ticketId: string) =>
        db.admin.query('UPDATE ticket SET active_min = active_min + 1 WHERE id = $1', [ticketId]),
    },
    {
      label: 'event sequence',
      mutate: async (ticketId: string) =>
        db.admin.query('UPDATE ticket_event SET seq = 9 WHERE ticket_id = $1 AND seq = 0', [
          ticketId,
        ]),
    },
    {
      label: 'event payload',
      mutate: async (ticketId: string) =>
        db.admin.query(
          'UPDATE ticket_event SET payload = \'{"changed":true}\' WHERE ticket_id = $1 AND seq = 0',
          [ticketId],
        ),
    },
    {
      label: 'crew',
      mutate: async (ticketId: string) =>
        db.admin.query(
          "UPDATE crew_member SET left_reason = 'leave' WHERE ticket_id = $1 AND role = 'primary'",
          [ticketId],
        ),
    },
    {
      label: 'segment',
      mutate: async (ticketId: string) =>
        db.admin.query(
          "UPDATE work_segment SET started_at = '2026-11-01T10:06:00Z' WHERE ticket_id = $1 AND role = 'lead'",
          [ticketId],
        ),
    },
    {
      label: 'segment endReason',
      mutate: async (ticketId: string) =>
        db.admin.query(
          "UPDATE work_segment SET end_reason = 'leave' WHERE ticket_id = $1 AND role = 'lead'",
          [ticketId],
        ),
    },
    {
      label: 'report scalar',
      mutate: async (ticketId: string) =>
        db.admin.query(
          "UPDATE breakdown_report SET corrective_action = 'Changed later' WHERE ticket_id = $1",
          [ticketId],
        ),
    },
    {
      label: 'report person',
      mutate: async (ticketId: string) =>
        db.admin.query(
          "UPDATE breakdown_report_person SET role = 'supported' WHERE report_id IN (SELECT id FROM breakdown_report WHERE ticket_id = $1) AND role = 'done'",
          [ticketId],
        ),
    },
    {
      label: 'parent',
      mutate: async (ticketId: string) => {
        const parent = await db.admin.query(
          "SELECT id FROM ticket WHERE tenant_id = $1 AND ref = 'BD-9000'",
          [syntheticIds.tenant],
        );
        await db.admin.query('UPDATE ticket SET parent_id = $1 WHERE id = $2', [
          parent.rows[0].id,
          ticketId,
        ]);
      },
    },
  ])(
    'T23 names the changed ticket in $label fingerprint diagnostics and deletes nothing',
    async ({ mutate }) => {
      const seeded = await seedBatch({ withSkipped: true });
      await mutate(seeded.ticketId);
      await expect(undoImport(db.app, syntheticIds.tenant, seeded.batchId)).rejects.toThrow(
        new RegExp(`fingerprint[\\s\\S]*${seeded.legacyId}`),
      );
      expect((await counts(seeded.ticketId)).ticket).toBe(1);
      const state = await db.admin.query('SELECT status FROM import_batch WHERE id = $1', [
        seeded.batchId,
      ]);
      const audits = await db.admin.query(
        'SELECT count(*)::int AS n FROM audit_log WHERE entity_id = $1',
        [seeded.batchId],
      );
      expect(state.rows).toEqual([{ status: 'done' }]);
      expect(audits.rows).toEqual([{ n: 0 }]);
    },
  );

  it('T24 refuses an outside child reference and preserves it', async () => {
    const seeded = await seedBatch({ withSkipped: true });
    await db.admin.query('UPDATE ticket SET parent_id = $1 WHERE id = $2', [
      seeded.ticketId,
      seeded.preexistingId,
    ]);
    await expect(undoImport(db.app, syntheticIds.tenant, seeded.batchId)).rejects.toThrow(
      /outside|child|reference/i,
    );
    const outside = await db.admin.query('SELECT parent_id FROM ticket WHERE id = $1', [
      seeded.preexistingId,
    ]);
    expect(outside.rows[0].parent_id).toBe(seeded.ticketId);
    expect((await counts(seeded.ticketId)).ticket).toBe(1);
  });

  it('T24 refuses a ticket file reference and preserves it', async () => {
    const seeded = await seedBatch();
    const fileId = randomUUID();
    await db.admin.query(
      `INSERT INTO file (id, tenant_id, kind, s3_key, mime, bytes, sha256, ticket_id)
       VALUES ($1, $2, 'photo', 'synthetic-file', 'image/png', 1, $3, $4)`,
      [fileId, syntheticIds.tenant, '0'.repeat(64), seeded.ticketId],
    );
    await expect(undoImport(db.app, syntheticIds.tenant, seeded.batchId)).rejects.toThrow(
      /file|reference/i,
    );
    expect((await counts(seeded.ticketId)).ticket).toBe(1);
    expect(
      (await db.admin.query('SELECT ticket_id FROM file WHERE id = $1', [fileId])).rows[0]
        .ticket_id,
    ).toBe(seeded.ticketId);
  });

  it.each(['signature_file_id', 'pdf_file_id'])(
    'T24 refuses report %s references',
    async (column) => {
      const seeded = await seedBatch();
      const fileId = randomUUID();
      await db.admin.query(
        `INSERT INTO file (id, tenant_id, kind, s3_key, mime, bytes, sha256)
         VALUES ($1, $2, 'signature', $3, 'image/png', 1, $4)`,
        [fileId, syntheticIds.tenant, `synthetic-report-${column}`, '0'.repeat(64)],
      );
      await db.admin.query(`UPDATE breakdown_report SET ${column} = $1 WHERE ticket_id = $2`, [
        fileId,
        seeded.ticketId,
      ]);
      await refreshFingerprint(seeded.batchId);
      await expect(undoImport(db.app, syntheticIds.tenant, seeded.batchId)).rejects.toThrow(
        /file|report|reference/i,
      );
      expect((await counts(seeded.ticketId)).reports).toBe(1);
      expect((await counts(seeded.ticketId)).ticket).toBe(1);
    },
  );

  it('T25 undoes an empty failed batch once and ignores stale skipped rows', async () => {
    const seeded = await seedBatch({ status: 'failed', withTicket: false, staleSkipped: true });
    expect(seeded.completion).toEqual(emptyCompletionFingerprint());
    await expect(undoImport(db.app, syntheticIds.tenant, seeded.batchId)).resolves.toEqual({
      deleted: 0,
    });
    await expect(undoImport(db.app, syntheticIds.tenant, seeded.batchId)).rejects.toThrow(
      /undone|status/i,
    );
    const result = await db.admin.query(
      `SELECT b.status, b.finished_at, ir.status AS row_status, ir.ticket_id,
        (SELECT count(*)::int FROM ticket WHERE tenant_id = $1 AND id = $3) AS skipped,
        (SELECT count(*)::int FROM audit_log WHERE tenant_id = $1 AND entity_id = $2) AS audits
       FROM import_batch b JOIN import_row ir ON ir.batch_id = b.id AND ir.row_number = 90
       WHERE b.tenant_id = $1 AND b.id = $2`,
      [syntheticIds.tenant, seeded.batchId, seeded.preexistingId],
    );
    expect(result.rows[0]).toMatchObject({
      status: 'undone',
      row_status: 'skipped',
      ticket_id: null,
      skipped: 1,
      audits: 1,
    });
    expect(result.rows[0].finished_at).toEqual(seeded.finishedAt);
    const audit = await db.admin.query('SELECT before, after FROM audit_log WHERE entity_id = $1', [
      seeded.batchId,
    ]);
    expect(audit.rows[0]).toEqual({
      before: { status: 'failed', fingerprintDigest: seeded.completion.digest, ticketIds: [] },
      after: { status: 'undone', deleted: 0 },
    });
  });
});
