import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { withTenant } from '@uptimo/db';
import { machinesByIds } from '../src/modules/plant/index.js';
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
    expect(rows).toEqual([{ id: M, code: 'LOCK-1', category: null, cell: null, criticality: 'A' }]);
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
