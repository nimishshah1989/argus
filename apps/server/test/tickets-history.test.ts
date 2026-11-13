import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { withTenant } from '@uptimo/db';
import { machineHistory, notesSeenElsewhere } from '../src/modules/tickets/index.js';
import { startTestDb, type TestDb } from './harness.js';

const A = '72000000-0000-4000-8000-00000000000a';
const B = '72000000-0000-4000-8000-00000000000b';
const id = (n: number): string => `72000000-0000-4000-8000-0000000002${String(n).padStart(2, '0')}`;
const [M, S, O, MB] = [id(1), id(2), id(3), id(4)];
const BEFORE = new Date('2026-11-13T10:00:00Z');

describe('tickets history reads', () => {
  let db: TestDb;
  let n = 0;

  async function ticket(
    tenant: string,
    machine: string,
    reportedAt: string,
    o: { status?: string; closeNote?: string; actions?: string[] } = {},
  ): Promise<string> {
    n += 1;
    const t = (
      await db.admin.query(
        `INSERT INTO ticket (tenant_id, ref, kind, status, machine_id, problem, reported_at, close_note, severity)
         VALUES ($1, $2, 'stopped', $3, $4, $5, $6, $7, 'S3') RETURNING id`,
        [
          tenant,
          `H-${n}`,
          o.status ?? 'closed',
          machine,
          `Problem ${n}`,
          reportedAt,
          o.closeNote ?? null,
        ],
      )
    ).rows[0].id;
    for (const [i, action] of (o.actions ?? []).entries()) {
      await db.admin.query(
        `INSERT INTO breakdown_report (tenant_id, ticket_id, machine_id, date, shift_code, problem, corrective_action, submitted_at)
         VALUES ($1, $2, $3, '2026-10-01', 'A', 'p', $4, $5::timestamptz + ($6 || ' minutes')::interval)`,
        [tenant, t, machine, action, reportedAt, String(i)],
      );
    }
    return t;
  }

  beforeAll(async () => {
    db = await startTestDb();
    await db.admin.query(
      `INSERT INTO tenant (id, slug, name) VALUES ($1, 'hist-a', 'Test Plant A'), ($2, 'hist-b', 'Test Plant B')`,
      [A, B],
    );
    await db.admin.query(
      `INSERT INTO machine (id, tenant_id, code) VALUES
        ($1, $5, 'FM-1'), ($2, $5, 'FM-2'), ($3, $5, 'OT-1'), ($4, $6, 'FM-9')`,
      [M, S, O, MB, A, B],
    );
  });

  afterAll(async () => {
    await db.stop();
  });

  it('returns closed past tickets of the given machines, newest first, with the latest report', async () => {
    const sep = await ticket(A, M, '2026-09-01T08:00:00Z', { actions: ['Belt replaced'] });
    const oct = await ticket(A, M, '2026-10-01T08:00:00Z', {
      actions: ['Belt replaced', 'Belt replaced again'],
    });
    await ticket(A, M, '2026-11-20T08:00:00Z');
    await ticket(A, M, '2026-10-15T08:00:00Z', { status: 'open' });
    await ticket(A, M, '2026-10-16T08:00:00Z', { status: 'cancelled' });
    await ticket(A, O, '2026-10-02T08:00:00Z');
    const run = (machineIds: string[], limit: number) =>
      withTenant(db.app, A, (c) => machineHistory(c, A, { machineIds, before: BEFORE, limit }));
    const rows = await run([M], 10);
    expect(rows.map((r) => r.id)).toEqual([oct, sep]);
    expect(rows[0]?.action).toBe('Belt replaced again');
    expect((await run([M], 1)).map((r) => r.id)).toEqual([oct]);
    expect(await run([], 10)).toEqual([]);
  });

  it("never returns another tenant's tickets", async () => {
    await ticket(B, MB, '2026-10-01T08:00:00Z', { actions: ['Fan replaced'] });
    const rows = await withTenant(db.app, A, (c) =>
      machineHistory(c, A, { machineIds: [MB], before: BEFORE, limit: 10 }),
    );
    expect(rows).toEqual([]);
  });

  it('finds closing notes that also appear on machines outside the family', async () => {
    await ticket(A, M, '2026-10-03T08:00:00Z', { actions: ['Coupling ALIGNED'] });
    await ticket(A, O, '2026-10-03T08:00:00Z', { closeNote: 'coupling aligned' });
    await ticket(A, S, '2026-10-03T08:00:00Z', { actions: ['Belt changed'] });
    await ticket(B, MB, '2026-10-03T08:00:00Z', { actions: ['Bearing replaced'] });
    const seen = (notes: string[]) =>
      withTenant(db.app, A, (c) => notesSeenElsewhere(c, A, { notes, outsideMachineIds: [M, S] }));
    expect(await seen(['coupling aligned', 'belt changed', 'bearing replaced'])).toEqual(
      new Set(['coupling aligned']),
    );
    expect(await seen([])).toEqual(new Set());
  });
});
