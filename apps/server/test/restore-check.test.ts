import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { restoreCheck } from '../../../scripts/restore-check.js';
import { startTestDb, type TestDb } from './harness.js';

let db: TestDb;
const A = 'f1000000-0000-0000-0000-000000000001';
const B = 'f2000000-0000-0000-0000-000000000001';

beforeAll(async () => {
  db = await startTestDb();
  for (const [id, slug] of [
    [A, 'alpha'],
    [B, 'bravo'],
  ] as const)
    await db.admin.query('INSERT INTO tenant (id, slug, name) VALUES ($1, $2, $2)', [id, slug]);
  for (const ref of ['BD-0001', 'BD-0002']) {
    const id = randomUUID();
    await db.admin.query(
      `INSERT INTO ticket (id, tenant_id, ref, kind, status, problem, reported_at, severity)
       VALUES ($1, $2, $3, 'stopped', 'open', 'x', now(), 'S3')`,
      [id, A, ref],
    );
    await db.admin.query(
      "INSERT INTO ticket_event (tenant_id, ticket_id, seq, type) VALUES ($1, $2, 1, 'down')",
      [A, id],
    );
  }
  await db.admin.query("INSERT INTO person (tenant_id, name) VALUES ($1, 'Someone')", [B]);
}, 180_000);

afterAll(async () => {
  await db.stop();
});

describe('restore check', () => {
  it('counts each customer on its own, so a restored copy can be compared with the live one', async () => {
    const result = await restoreCheck(db.admin);
    const by = Object.fromEntries(result.customers.map((c) => [c.slug, c.counts]));
    expect(by.alpha).toMatchObject({ tickets: 2, events: 2, people: 0 });
    expect(by.bravo).toMatchObject({ tickets: 0, events: 0, people: 1 });
    // The ledger is part of what a restore must bring back.
    await db.admin.query(
      'CREATE TABLE IF NOT EXISTS schema_migration (filename text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())',
    );
    await db.admin.query(
      "INSERT INTO schema_migration (filename) VALUES ('0001_x.sql'), ('0002_y.sql')",
    );
    expect((await restoreCheck(db.admin)).migrations).toEqual({ applied: 2, last: '0002_y.sql' });
    // Same database, same answer: that is what makes the comparison meaningful.
    expect(await restoreCheck(db.admin)).toEqual(await restoreCheck(db.admin));
  });

  it('prints counts only, never a name or a value', async () => {
    expect(JSON.stringify(await restoreCheck(db.admin))).not.toMatch(/Someone|alpha-secret/);
  });
});
