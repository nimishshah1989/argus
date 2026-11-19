import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runEngineFreeze } from '../src/modules/analytics/freeze.js';
import { A, B, M_B, M_USED, startFixture, type Fixture } from './plant-settings-fixture.js';

/**
 * The freeze through the server (ticket 52, packet 52a): the nightly `engine.freeze` writes one `forecast` row per
 * production machine, once, on the plant's own calendar month, and never touches `predicted` again. The fixture's
 * production fleet is two CNC machines (VC-01 and VC-02); only VC-02 has a breakdown, which is all the A9 core
 * needs to observe the plant.
 */

const DEC = new Date('2026-12-01T00:30:00Z');
/** The fixture's production fleet: VC-01 (M_FREE) and VC-02 (M_USED), both CNC, Robot excluded. */
const PRODUCTION_ROWS = 2;

let f: Fixture;

beforeAll(async () => {
  f = await startFixture();
  // The fixture's closed ticket on M_USED gets the report the A9 production fleet reads.
  const ticket = (
    await f.admin.query("SELECT id FROM ticket WHERE tenant_id = $1 AND ref = 'BD-0001'", [A])
  ).rows[0].id as string;
  await f.admin.query(
    `INSERT INTO breakdown_report (tenant_id, ticket_id, machine_id, date, shift_code, problem, downtime_min)
     VALUES ($1, $2, $3, '2026-11-20', 'DAY', 'Spindle noise', 90)`,
    [A, ticket, M_USED],
  );
}, 180_000);
afterAll(async () => f.stop());

interface StoredForecast {
  machine_id: string;
  month: string;
  as_of: string;
  profile: string;
  model: string;
  predicted: Record<string, unknown>;
  frozen_at: Date;
}

const rowsFor = async (tenantId: string): Promise<StoredForecast[]> =>
  (
    await f.admin.query(
      `SELECT machine_id, month::text AS month, as_of::text AS as_of, profile, model, predicted, frozen_at
         FROM forecast WHERE tenant_id = $1 ORDER BY machine_id`,
      [tenantId],
    )
  ).rows;

const freezeAudit = async (tenantId: string) =>
  (
    await f.admin.query(
      `SELECT action, entity, entity_id, login_id, before, after
         FROM audit_log WHERE tenant_id = $1 AND action = 'forecast.freeze' ORDER BY at, id`,
      [tenantId],
    )
  ).rows;

describe('the monthly freeze', () => {
  it('writes one forecast row per production machine, frozen as of the month’s 1st, and audits once', async () => {
    const result = await runEngineFreeze(f.db.app, {
      now: DEC,
      tenantId: A,
      allowFakeClock: true,
    });
    expect(result).toEqual({ tenants: 1, frozen: PRODUCTION_ROWS });

    const rows = await rowsFor(A);
    expect(rows).toHaveLength(PRODUCTION_ROWS);
    expect(rows.map((row) => row.machine_id)).toContain(M_USED);
    expect(new Set(rows.map((row) => row.machine_id)).size).toBe(PRODUCTION_ROWS);
    for (const row of rows) {
      expect(row).toMatchObject({
        month: '2026-12-01',
        as_of: '2026-12-01',
        profile: 'legacy',
        model: 'a9.m0.1',
      });
      expect(row.frozen_at.toISOString()).toBe(DEC.toISOString());
      expect(row.predicted).toMatchObject({
        days: 31,
        hoursProfile: { prodHrsPerDay: 20, workDaysPerYear: 300 },
      });
      for (const key of ['expN', 'expH', 'p1', 'p80', 'p90', 'pLong']) {
        expect(typeof row.predicted[key], key).toBe('number');
      }
      expect(['Hot', 'Likely', 'Watch', 'Stable']).toContain(row.predicted.band);
      expect(['High', 'Medium', 'Low']).toContain(row.predicted.confidence);
    }

    const audit = await freezeAudit(A);
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({
      action: 'forecast.freeze',
      entity: 'forecast',
      entity_id: null,
      login_id: null,
      before: null,
      after: { month: '2026-12-01', rows: PRODUCTION_ROWS },
    });
  });

  it('is a no-op on a second run: no row, no audit line, the same numbers', async () => {
    const before = await rowsFor(A);
    const auditBefore = await freezeAudit(A);
    const result = await runEngineFreeze(f.db.app, {
      now: new Date('2026-12-01T01:30:00Z'),
      tenantId: A,
      allowFakeClock: true,
    });
    expect(result.frozen).toBe(0);
    expect(await rowsFor(A)).toEqual(before);
    expect(await freezeAudit(A)).toHaveLength(auditBefore.length);
  });

  it('keeps the write-once grant: the app may score the row but never rewrite the prediction', async () => {
    await expect(
      f.db.app.query("UPDATE forecast SET predicted = '{}'::jsonb WHERE tenant_id = $1", [A]),
    ).rejects.toThrow(/permission denied/);
  });
});

describe('the plant’s own month', () => {
  it('does not freeze the next month before the plant’s clock reaches it', async () => {
    await f.admin.query("UPDATE tenant SET time_zone = 'America/New_York' WHERE id = $1", [A]);
    const early = await runEngineFreeze(f.db.app, {
      now: new Date('2027-01-01T00:30:00Z'),
      tenantId: A,
      allowFakeClock: true,
    });
    expect(early.frozen).toBe(0);
    expect((await rowsFor(A)).filter((row) => row.month === '2027-01-01')).toEqual([]);

    const late = await runEngineFreeze(f.db.app, {
      now: new Date('2027-01-02T05:30:00Z'),
      tenantId: A,
      allowFakeClock: true,
    });
    expect(late.frozen).toBe(PRODUCTION_ROWS);
    const january = (await rowsFor(A)).filter((row) => row.month === '2027-01-01');
    expect(january).toHaveLength(PRODUCTION_ROWS);
    expect(january.every((row) => row.as_of === '2027-01-01')).toBe(true);
  });

  it('catches up a missed 1st: a later run freezes the month as of its 1st', async () => {
    // A quiet plant writes nothing and says nothing.
    const quiet = await runEngineFreeze(f.db.app, {
      now: DEC,
      tenantId: B,
      allowFakeClock: true,
    });
    expect(quiet).toEqual({ tenants: 1, frozen: 0 });
    expect(await rowsFor(B)).toEqual([]);
    expect(await freezeAudit(B)).toEqual([]);

    // Give the plant its first breakdown, then freeze December on the 20th: backdated to the 1st.
    const ticket = (
      await f.admin.query(
        `INSERT INTO ticket (tenant_id, ref, kind, status, machine_id, problem, reported_at, severity)
         VALUES ($1, 'BD-0100', 'stopped', 'closed', $2, 'Bearing', '2026-11-10T04:00:00Z', 'S3') RETURNING id`,
        [B, M_B],
      )
    ).rows[0].id as string;
    await f.admin.query(
      `INSERT INTO breakdown_report (tenant_id, ticket_id, machine_id, date, shift_code, problem, downtime_min)
       VALUES ($1, $2, $3, '2026-11-10', 'DAY', 'Bearing', 60)`,
      [B, ticket, M_B],
    );
    const now = new Date('2026-12-20T00:30:00Z');
    const late = await runEngineFreeze(f.db.app, { now, tenantId: B, allowFakeClock: true });
    expect(late.frozen).toBe(1);
    const rows = await rowsFor(B);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ month: '2026-12-01', as_of: '2026-12-01' });
    expect(rows[0]!.frozen_at.toISOString()).toBe(now.toISOString());
  });
});

describe('the clock guard', () => {
  it('refuses a fake clock more than 24 hours from the database’s and writes nothing', async () => {
    const rowsBefore = await rowsFor(A);
    const auditBefore = await freezeAudit(A);
    await expect(
      runEngineFreeze(f.db.app, {
        now: new Date('2027-06-15T00:00:00Z'),
        tenantId: A,
      }),
    ).rejects.toThrow(/more than 24 hours/);
    expect(await rowsFor(A)).toEqual(rowsBefore);
    expect(await freezeAudit(A)).toHaveLength(auditBefore.length);
  });
});
