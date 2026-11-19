import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { insertAssetRegisters } from '../src/modules/plant/seed.js';
import { startTestDb, type TestDb } from './harness.js';

/**
 * The register seed on a schema older than 0015 (ticket 51a): the migration tests seed a plant before the M4b
 * tables exist, so `insertAssetRegisters` must be a no-op there rather than fail the seed (49a's guard).
 */

let db: TestDb;

beforeAll(async () => {
  db = await startTestDb({ through: '0014_m4a_schema.sql' });
}, 180_000);
afterAll(async () => db.stop());

describe('the register seed before 0015', () => {
  it('writes nothing and never fails: the table arrives with the migration', async () => {
    const table = (await db.admin.query("SELECT to_regclass('public.asset_register') AS table"))
      .rows[0].table;
    expect(table).toBeNull();
    const conflicts = await insertAssetRegisters(db.admin, '10000000-0000-0000-0000-000000000001', [
      {
        machineCode: 'TC-11',
        kind: 'amc',
        vendor: null,
        reference: null,
        startsOn: null,
        endsOn: null,
        dueOn: null,
        leadDays: 15,
        notes: 'AMC',
      },
    ]);
    expect(conflicts).toEqual([]);
  });
});
