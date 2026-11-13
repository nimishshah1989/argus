import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { auditPurge } from '../../../scripts/audit-purge.js';
import { startTestDb, type TestDb } from './harness.js';

const A = 'e1000000-0000-0000-0000-000000000001';
const B = 'e2000000-0000-0000-0000-000000000001';
const YEAR_DAYS = 365;

let db: TestDb;
const NOW = new Date();
const ago = (days: number): Date => new Date(NOW.getTime() - days * 86_400_000);

async function audit(tenantId: string, action: string, at: Date): Promise<void> {
  await db.admin.query(
    "INSERT INTO audit_log (id, tenant_id, action, entity, at) VALUES ($1, $2, $3, 'x', $4)",
    [randomUUID(), tenantId, action, at],
  );
}
const actions = async (tenantId: string): Promise<string[]> =>
  (
    await db.admin.query('SELECT action FROM audit_log WHERE tenant_id = $1 ORDER BY action', [
      tenantId,
    ])
  ).rows.map((r) => r.action);

beforeAll(async () => {
  db = await startTestDb();
  for (const [id, slug] of [
    [A, 'alpha'],
    [B, 'bravo'],
  ] as const)
    await db.admin.query('INSERT INTO tenant (id, slug, name) VALUES ($1, $2, $2)', [id, slug]);
  await audit(A, 'old.ordinary', ago(4 * YEAR_DAYS));
  await audit(A, 'inside.window', ago(2 * YEAR_DAYS));
  await audit(A, 'old.just-inside', ago(3 * YEAR_DAYS - 5));
  await audit(A, 'person.erase', ago(5 * YEAR_DAYS));
  await audit(A, 'tenant.offboard', ago(5 * YEAR_DAYS));
  await audit(B, 'old.other-customer', ago(4 * YEAR_DAYS));
}, 180_000);

afterAll(async () => {
  await db.stop();
});

describe('audit.purge', () => {
  it('without confirmation it reports what would go and removes nothing', async () => {
    const result = await auditPurge(db.router, {
      now: NOW,
      operator: 'agent-test',
      confirm: false,
    });
    expect(result).toEqual({ deleted: 2, confirmed: false });
    expect(await actions(A)).toHaveLength(5);
    expect(await actions(B)).toHaveLength(1);
  });

  it('removes ordinary rows past 3 years, keeps younger rows and the erase and offboard proof, notes it once per customer', async () => {
    const result = await auditPurge(db.router, { now: NOW, operator: 'agent-test', confirm: true });
    expect(result).toEqual({ deleted: 2, confirmed: true });
    expect(await actions(A)).toEqual([
      'audit.purge',
      'inside.window',
      'old.just-inside',
      'person.erase',
      'tenant.offboard',
    ]);
    expect(await actions(B)).toEqual(['audit.purge']);
    const note = await db.admin.query(
      "SELECT after FROM audit_log WHERE tenant_id = $1 AND action = 'audit.purge'",
      [A],
    );
    expect(note.rows[0].after).toMatchObject({ deleted: 1, operator: 'agent-test' });
  });

  it('a second run removes nothing and writes no second note', async () => {
    const result = await auditPurge(db.router, { now: NOW, operator: 'agent-test', confirm: true });
    expect(result.deleted).toBe(0);
    expect(await actions(A)).toHaveLength(5);
    expect(await actions(B)).toEqual(['audit.purge']);
  });

  it('refuses a clock that would reach inside the 3 years, and a missing operator', async () => {
    const future = new Date(NOW.getTime() + 4 * YEAR_DAYS * 86_400_000);
    await expect(
      auditPurge(db.router, { now: future, operator: 'agent-test', confirm: true }),
    ).rejects.toThrow(/at least 3 years/);
    await expect(auditPurge(db.router, { now: NOW, operator: ' ', confirm: true })).rejects.toThrow(
      /operator/,
    );
    expect(await actions(A)).toContain('inside.window');
  });
});
