import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { withTenant } from '@uptimo/db';
import { erasePerson } from '../src/modules/identity/index.js';
import { importBhavin, undoImport } from '../src/modules/imports/bhavin.js';
import {
  makeOrdinaryTicket,
  makeSyntheticExport,
  seedSyntheticTenant,
  syntheticIds,
} from './import-fixture.js';
import { startTestDb, type TestDb } from './harness.js';

let db: TestDb;

beforeAll(async () => {
  process.env.ERASURE_HASH_KEY = ['erasure', 'test', 'import'].join('-').padEnd(40, 'x');
  db = await startTestDb();
}, 120_000);

beforeEach(async () => {
  await db.admin.query('DELETE FROM tenant');
  await seedSyntheticTenant(db.admin);
});

afterAll(async () => {
  delete process.env.ERASURE_HASH_KEY;
  await db.stop();
});

const tickets = async (): Promise<number> =>
  (
    await db.admin.query('SELECT count(*)::int AS n FROM ticket WHERE tenant_id = $1', [
      syntheticIds.tenant,
    ])
  ).rows[0].n;

/** Imports the synthetic export, then erases a person whose name is in its raw rows. */
async function importThenErase() {
  const input = makeSyntheticExport();
  const first = await importBhavin(db.app, syntheticIds.tenant, input);
  expect(first.stats).toMatchObject({ imported: 1, status: 'done' });
  await withTenant(db.router, syntheticIds.tenant, (tx) =>
    erasePerson(tx, {
      tenantId: syntheticIds.tenant,
      personId: syntheticIds.bina,
      requestRef: 'request-0001',
      operator: 'agent-test',
    }),
  );
  const raw = await db.admin.query(
    "SELECT payload FROM import_row WHERE batch_id = $1 AND status = 'imported'",
    [first.batchId],
  );
  expect(raw.rows[0].payload).toEqual({});
  return { input, first };
}

describe('a batch whose rows had a person erased from them', () => {
  it('can be imported again: the ticket it created is recognised and skipped', async () => {
    const { input } = await importThenErase();
    const again = await importBhavin(db.app, syntheticIds.tenant, input);
    expect(again.stats).toMatchObject({ imported: 0, skipped: 1, errored: 0, status: 'done' });
    expect(await tickets()).toBe(1);
  });

  it('keeps no raw text naming the erased person when it is imported again', async () => {
    const { input } = await importThenErase();
    await importBhavin(db.app, syntheticIds.tenant, input);
    const named = await db.admin.query(
      `SELECT (SELECT count(*)::int FROM import_row WHERE tenant_id = $1 AND payload::text ILIKE '%Bina%') AS rows,
              (SELECT count(*)::int FROM ticket_event WHERE tenant_id = $1 AND payload::text ILIKE '%Bina%') AS events`,
      [syntheticIds.tenant],
    );
    expect(named.rows[0]).toEqual({ rows: 0, events: 0 });
  });

  it('can still be undone, and the export can be imported afresh afterwards', async () => {
    const { input, first } = await importThenErase();
    const undone = await undoImport(db.router, syntheticIds.tenant, first.batchId, 'agent-test');
    expect(undone.deleted).toBe(1);
    expect(await tickets()).toBe(0);
    const revived = await importBhavin(db.app, syntheticIds.tenant, input);
    expect(revived.stats).toMatchObject({ imported: 1, status: 'done' });
    expect(await tickets()).toBe(1);
  });

  it('does not stop a different export from importing', async () => {
    await importThenErase();
    const other = makeSyntheticExport([
      makeOrdinaryTicket({ legacyId: 'synthetic-legacy-0200', ref: 'BD-0200' }),
    ]);
    const result = await importBhavin(db.app, syntheticIds.tenant, other);
    expect(result.stats).toMatchObject({ imported: 1, errored: 0, status: 'done' });
  });
});
