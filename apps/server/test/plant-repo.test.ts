import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { withTenant } from '@uptimo/db';
import { machineFamily, machinesByIds } from '../src/modules/plant/index.js';
import { startTestDb, type TestDb } from './harness.js';

const T = '40000000-0000-4000-8000-000000000001';
const M = '40000000-0000-4000-8000-000000000002';

describe('plant machinesByIds', () => {
  let db: TestDb;

  beforeAll(async () => {
    db = await startTestDb();
    await db.admin.query(
      "INSERT INTO tenant (id, slug, name) VALUES ($1, 'lock-test', 'Lock Test')",
      [T],
    );
    await db.admin.query(
      "INSERT INTO machine (id, tenant_id, code, criticality) VALUES ($1, $2, 'LOCK-1', 'A')",
      [M, T],
    );
  });

  afterAll(async () => {
    await db.stop();
  });

  it('returns the machine row', async () => {
    const rows = await withTenant(db.app, T, (c) => machinesByIds(c, T, [M]));
    expect(rows).toEqual([
      { id: M, code: 'LOCK-1', category: null, cell: null, criticality: 'A', status: 'active' },
    ]);
  });

  async function updateWhileHeld(lock?: 'share'): Promise<void> {
    await withTenant(db.app, T, async (c) => {
      await machinesByIds(c, T, [M], lock);
      const other = await db.admin.connect();
      try {
        await other.query("SET lock_timeout = '300ms'");
        await other.query('UPDATE machine SET code = code WHERE id = $1', [M]);
      } finally {
        other.release();
      }
    });
  }

  it('holds a share lock until commit', async () => {
    await expect(updateWhileHeld('share')).rejects.toThrow(/lock timeout/);
    await expect(updateWhileHeld()).resolves.toBeUndefined();
  });
});

describe('plant machineFamily', () => {
  const A = '72000000-0000-4000-8000-00000000000a';
  const B = '72000000-0000-4000-8000-00000000000b';
  const id = (n: number): string =>
    `72000000-0000-4000-8000-0000000001${String(n).padStart(2, '0')}`;
  const [M, S, O, MB, N] = [id(1), id(2), id(3), id(4), id(5)];
  let db: TestDb;

  beforeAll(async () => {
    db = await startTestDb();
    await db.admin.query(
      `INSERT INTO tenant (id, slug, name) VALUES ($1, 'fam-a', 'Test Plant A'), ($2, 'fam-b', 'Test Plant B')`,
      [A, B],
    );
    await db.admin.query(
      `INSERT INTO machine (id, tenant_id, code, make, model) VALUES
        ($1, $6, 'FM-1', 'Fake Make', 'FM-100'),
        ($2, $6, 'FM-2', ' fake make ', 'fm-100'),
        ($3, $6, 'OT-1', 'Other Make', 'OT-5'),
        ($4, $7, 'FM-9', 'Fake Make', 'FM-100'),
        ($5, $6, 'NM-1', 'Fake Make', '  ')`,
      [M, S, O, MB, N, A, B],
    );
  });

  afterAll(async () => {
    await db.stop();
  });

  it('finds the same-model machines of a machine, ignoring case and spaces', async () => {
    const f = await withTenant(db.app, A, (c) => machineFamily(c, A, M));
    expect(f?.machine).toEqual({
      id: M,
      code: 'FM-1',
      make: 'Fake Make',
      model: 'FM-100',
      category: null,
    });
    expect(f?.siblings).toEqual([{ id: S, code: 'FM-2' }]);
  });

  it('gives no siblings without a model and nothing for an unknown machine', async () => {
    const n = await withTenant(db.app, A, (c) => machineFamily(c, A, N));
    expect(n?.siblings).toEqual([]);
    expect(await withTenant(db.app, A, (c) => machineFamily(c, A, MB))).toBeNull();
    expect(
      await withTenant(db.app, A, (c) =>
        machineFamily(c, A, '72000000-0000-4000-8000-0000000fffff'),
      ),
    ).toBeNull();
  });
});
