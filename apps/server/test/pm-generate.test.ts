// Ticket 49b: the daily `pm.generate` job. A plan is due by the calendar (its anchor plus its interval, R7) or by
// the meter (the plan's reading less the last PM's `readings.meter`, R6); one `general`/`pm` ticket per due machine,
// never a second while one is open, and no SLA clock, drift or escalation for planned work (R4).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { withTenant } from '@uptimo/db';
import { figureDrift } from '../src/modules/tickets/index.js';
import { pmDue } from '../src/modules/tickets/pm-due.js';
import { runPmGenerate } from '../src/modules/tickets/pm-generate.js';
import { pmPlanForMachine, pmPlansForScheduling } from '../src/modules/plant/index.js';
import { startTestDb, type TestDb } from './harness.js';

/** 2026-10-29 11:30 in the plant's zone (Asia/Kolkata): the day before the due date. */
const DAY_BEFORE = new Date('2026-10-29T06:00:00Z');
/** 2026-10-30 11:30 in the plant's zone: the due date of a plan last done 2026-05-01 with a 182-day interval. */
const DUE_DAY = new Date('2026-10-30T06:00:00Z');

const T = (n: number): string => `a${n}000000-0000-0000-0000-000000000001`;
const M = (n: number): string => `b0000000-0000-0000-0000-0000000000${String(n).padStart(2, '0')}`;
const T1 = T(1);
const T2 = T(2);
const T3 = T(3);
const T4 = T(4);
const T5 = T(5);
const T6 = T(6);
const T7 = T(7);
const M1 = M(1);
const M2 = M(2);
const M3 = M(3);
const M4 = M(4);
const M5 = M(5);
const M6 = M(6);
const M7 = M(7);
const M8 = M(8);
const M10 = M(10);
const M11 = M(11);
const M12 = M(12);
const M9 = M(9);

let db: TestDb;
/** The hand-built history the job did not raise: a baseline PM and a job already open. */
const seeded = new Set<string>();

interface PlanFields {
  machineId?: string | null;
  category?: string | null;
  title?: string;
  lastDoneOn?: string | null;
  intervalDays?: number | null;
  meterInterval?: number | null;
  meterTolerance?: number | null;
  lastMeterReading?: number | null;
  active?: boolean;
}

async function plan(tenantId: string, fields: PlanFields): Promise<string> {
  const row = await db.admin.query(
    `INSERT INTO pm_plan (tenant_id, machine_id, category, title, interval_days, meter_interval,
       meter_tolerance, last_meter_reading, last_done_on, active)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
    [
      tenantId,
      fields.machineId ?? null,
      fields.category ?? null,
      fields.title ?? 'PM',
      fields.intervalDays === undefined ? 182 : fields.intervalDays,
      fields.meterInterval ?? null,
      fields.meterTolerance ?? null,
      fields.lastMeterReading ?? null,
      fields.lastDoneOn ?? null,
      fields.active ?? true,
    ],
  );
  return row.rows[0].id as string;
}

/** A closed PM job carrying the meter reading it was done at; it is the baseline for the next meter interval. */
async function closedMeterPm(tenantId: string, machineId: string, meter: number): Promise<void> {
  const ticket = await db.admin.query(
    `INSERT INTO ticket (tenant_id, ref, kind, status, machine_id, problem, reported_at, severity, raised_channel,
       closed_at, close_kind)
     VALUES ($1, $2, 'general', 'closed', $3, 'Earlier PM', '2026-04-01T06:00:00Z', 'S3', 'pm',
       '2026-04-01T07:00:00Z', 'report') RETURNING id`,
    [tenantId, `WR-PM-${machineId.slice(-4)}`, machineId],
  );
  seeded.add(ticket.rows[0].id as string);
  await db.admin.query(
    `INSERT INTO breakdown_report (tenant_id, ticket_id, machine_id, date, shift_code, problem, pm_report)
     VALUES ($1,$2,$3,'2026-04-01','A','Earlier PM',$4)`,
    [
      tenantId,
      ticket.rows[0].id,
      machineId,
      JSON.stringify({
        total: 0,
        undone: [],
        readings: { meter },
        comments: null,
        doneBy: null,
      }),
    ],
  );
}

async function openPm(tenantId: string, machineId: string): Promise<void> {
  const row = await db.admin.query(
    `INSERT INTO ticket (tenant_id, ref, kind, status, machine_id, problem, reported_at, severity, raised_channel)
     VALUES ($1, $2, 'general', 'open', $3, 'PM due: already open', '2026-10-30T06:00:00Z', 'S3', 'pm')
     RETURNING id`,
    [tenantId, `WR-OPEN-${machineId.slice(-4)}`, machineId],
  );
  seeded.add(row.rows[0].id as string);
}

/** The PM tickets the job raised, with the hand-built history filtered out. */
const pmTickets = async (tenantId: string) =>
  (
    await db.admin.query(
      `SELECT id, ref, kind, status, machine_id, problem, reported_at, work_type, location,
              task_expected_on::text AS task_expected_on
         FROM ticket WHERE tenant_id = $1 AND raised_channel = 'pm' ORDER BY ref`,
      [tenantId],
    )
  ).rows.filter((row) => !seeded.has(row.id as string));

const run = (now: Date, tenantId?: string) =>
  runPmGenerate(db.app, {
    now,
    allowFakeClock: true,
    ...(tenantId ? { tenantId } : {}),
  });

beforeAll(async () => {
  db = await startTestDb();
  const machines: Array<[string, string, string, string]> = [
    // [tenant, id, code, status]
    [T1, M1, 'VC-T1', 'active'],
    [T2, M2, 'VC-METER', 'active'],
    [T2, M3, 'VC-NOBASE', 'active'],
    [T3, M4, 'VC-OFF', 'active'],
    [T3, M5, 'VC-SCRAP', 'scrapped'],
    [T3, M6, 'VC-NOINT', 'active'],
    [T3, M7, 'VC-OPEN', 'active'],
    [T4, M8, 'VC-T4', 'active'],
    [T5, M10, 'VC-CAT', 'active'],
    [T5, M11, 'VC-MACHINE', 'active'],
    [T6, M9, 'VC-NEXT', 'active'],
    [T7, M12, 'VC-LATE', 'active'],
  ];
  for (const [index, id] of [T1, T2, T3, T4, T5, T6, T7].entries())
    await db.admin.query('INSERT INTO tenant (id, slug, name) VALUES ($1, $2, $2)', [
      id,
      `plant-${index + 1}`,
    ]);
  for (const [tenantId, id, code, status] of machines)
    await db.admin.query(
      "INSERT INTO machine (id, tenant_id, code, category, criticality, status) VALUES ($1,$2,$3,'VMC','B',$4)",
      [id, tenantId, code, status],
    );

  // T1: the calendar boundaries, one plan done 2026-05-01 on a 182-day interval (due 2026-10-30).
  await plan(T1, {
    machineId: M1,
    title: 'VC-T1 preventive maintenance',
    lastDoneOn: '2026-05-01',
  });
  // T2: a meter plan (interval far away) and a plan with a meter but no baseline.
  await plan(T2, {
    machineId: M2,
    title: 'VC-METER preventive maintenance',
    lastDoneOn: '2026-10-01',
    intervalDays: 3650,
    meterInterval: 500,
    meterTolerance: 50,
    lastMeterReading: 1499,
  });
  await closedMeterPm(T2, M2, 1000);
  await plan(T2, {
    machineId: M3,
    title: 'VC-NOBASE preventive maintenance',
    lastDoneOn: '2026-10-01',
    meterInterval: 500,
    lastMeterReading: 99999,
  });
  // T3: nothing raises: switched off, scrapped machine, no interval, and an open PM job.
  await plan(T3, { machineId: M4, title: 'Switched off', lastDoneOn: '2026-05-01', active: false });
  await plan(T3, { machineId: M5, title: 'Scrapped machine', lastDoneOn: '2026-05-01' });
  await plan(T3, {
    machineId: M6,
    title: 'No interval',
    lastDoneOn: '2026-05-01',
    intervalDays: null,
    meterInterval: 500,
    lastMeterReading: 99999,
  });
  await plan(T3, {
    machineId: M7,
    title: 'Already open',
    lastDoneOn: '2026-05-01',
    meterInterval: 500,
    lastMeterReading: 5000,
  });
  await closedMeterPm(T3, M7, 1000);
  await openPm(T3, M7);
  // T6: the next period after a PM report closes and the plan moves (49c's close).
  await plan(T6, {
    machineId: M9,
    title: 'VC-NEXT preventive maintenance',
    lastDoneOn: '2026-05-01',
  });
  await closedMeterPm(T6, M9, 200);
  // T4: the second plant of the fan-out.
  await plan(T4, {
    machineId: M8,
    title: 'VC-T4 preventive maintenance',
    lastDoneOn: '2026-05-01',
  });
  // T5: one category plan and one machine plan that must win over its category plan.
  await plan(T5, { category: 'VMC', title: 'Category fallback', lastDoneOn: '2026-05-01' });
  await plan(T5, { machineId: M11, title: 'Machine plan wins', lastDoneOn: '2026-05-01' });
  // T7: a plan the nightly run reaches late (50 R12: the ticket keeps the due, not the run's day).
  await plan(T7, {
    machineId: M12,
    title: 'VC-LATE preventive maintenance',
    lastDoneOn: '2026-05-01',
  });
}, 180_000);

afterAll(async () => {
  await db.stop();
});

describe('pm.generate by the calendar (R7)', () => {
  it('raises nothing the day before the due date and exactly one job on it', async () => {
    expect(await run(DAY_BEFORE, T1)).toMatchObject({ raised: 0 });
    expect(await pmTickets(T1)).toHaveLength(0);

    expect(await run(DUE_DAY, T1)).toMatchObject({ raised: 1 });
    const tickets = await pmTickets(T1);
    expect(tickets).toHaveLength(1);
    const raised = tickets[0];
    expect(raised.kind).toBe('general');
    expect(raised.status).toBe('open');
    expect(raised.ref).toMatch(/^WR-/);
    expect(raised.problem).toBe('PM due: VC-T1 preventive maintenance');
    expect(new Date(raised.reported_at).toISOString()).toBe(DUE_DAY.toISOString());
    // R4: only the merged raise input's fields; no work type or location is invented.
    expect(raised.work_type).toBeNull();
    expect(raised.location).toBeNull();
  });

  it('records the due, not the late day of the run, as the scheduled date (50 R12)', async () => {
    expect(await run(new Date('2026-11-02T06:00:00Z'), T7)).toMatchObject({ raised: 1 });
    const [ticket] = await pmTickets(T7);
    expect(ticket.task_expected_on).toBe('2026-10-30');
  });

  it('raises no second job on a re-run, the same day or the next', async () => {
    expect(await run(DUE_DAY, T1)).toMatchObject({ raised: 0 });
    expect(await run(new Date('2026-10-31T06:00:00Z'), T1)).toMatchObject({ raised: 0 });
    expect(await pmTickets(T1)).toHaveLength(1);
  });

  it('takes no SLA clock, drift line or escalation, and raises a fresh job once the old one is cancelled', async () => {
    const [ticket] = await pmTickets(T1);
    const id = ticket.id as string;
    expect(
      (await db.admin.query('SELECT 1 FROM sla_timer WHERE ticket_id = $1', [id])).rowCount,
    ).toBe(0);
    expect(
      (
        await db.admin.query(
          `SELECT 1 FROM pgboss.job
            WHERE name IN ('sla.timer', 'sla.escalate') AND data->>'ticketId' = $1`,
          [id],
        )
      ).rowCount,
    ).toBe(0);

    // A closed planned job is not a breakdown: an impossible cached figure still produces no drift line.
    await db.admin.query(
      `UPDATE ticket SET status = 'closed', closed_at = '2026-10-30T08:00:00Z', close_kind = 'no_report',
         downtime_min = 999 WHERE id = $1`,
      [id],
    );
    const lines = await withTenant(db.app, T1, (client) => figureDrift(client, T1));
    expect(lines.filter((line) => line.ref === ticket.ref)).toHaveLength(0);

    // Cancelled work is still due: the next run raises a fresh job.
    await db.admin.query("UPDATE ticket SET status = 'cancelled' WHERE id = $1", [id]);
    expect(await run(DUE_DAY, T1)).toMatchObject({ raised: 1 });
    const tickets = await pmTickets(T1);
    expect(tickets).toHaveLength(2);
    expect(new Set(tickets.map((row) => row.ref)).size).toBe(2);
  });

  it('raises the next period once after a PM report closes and the plan moves, not a day before', async () => {
    expect(await run(DUE_DAY, T6)).toMatchObject({ raised: 1 });
    const [raised] = await pmTickets(T6);
    const id = raised.id as string;
    // 49c's close moves the plan in the ticket's transaction; simulate it, then the same day owes nothing.
    await db.admin.query(
      `UPDATE ticket SET status = 'closed', closed_at = '2026-10-30T08:00:00Z', close_kind = 'report'
        WHERE id = $1`,
      [id],
    );
    await db.admin.query("UPDATE pm_plan SET last_done_on = '2026-10-30' WHERE machine_id = $1", [
      M9,
    ]);
    expect(await run(DUE_DAY, T6)).toMatchObject({ raised: 0 });
    expect(await run(new Date('2027-04-29T06:00:00Z'), T6)).toMatchObject({ raised: 0 });
    expect(await run(new Date('2027-04-30T06:00:00Z'), T6)).toMatchObject({ raised: 1 });
    expect(await pmTickets(T6)).toHaveLength(2);
  });
});

describe('pm.generate by the meter (R6)', () => {
  it('measures from the last closed PM reading, marks overdue past tolerance and never delays the raise', async () => {
    const meterPlan = {
      anchorOn: '2026-10-01',
      lastDoneOn: '2026-10-01',
      intervalDays: 3650,
      meterInterval: 500,
      meterTolerance: 50,
      lastMeterReading: 1499,
    };
    const at = (reading: number, baseline: number | null = 1000) =>
      pmDue(
        { ...meterPlan, lastMeterReading: reading },
        { today: '2026-10-30', horizonDays: 0, openPm: false, baseline },
      );
    expect(at(1499)).toMatchObject({ due: false, rule: null, overdue: false });
    expect(at(1500)).toMatchObject({ due: true, rule: 'meter', overdue: false });
    expect(at(1549)).toMatchObject({ due: true, rule: 'meter', overdue: false });
    expect(at(1550)).toMatchObject({
      due: true,
      rule: 'meter',
      overdue: true,
      nextDue: '2036-09-28',
    });
    // No baseline yet: the meter rule is inert, not "due from zero".
    expect(at(99999, null)).toMatchObject({ due: false, rule: null, overdue: false });

    expect(await run(DUE_DAY, T2)).toMatchObject({ raised: 0 });
    expect(await pmTickets(T2)).toHaveLength(0);

    const setReading = (machineId: string, reading: number) =>
      db.admin.query('UPDATE pm_plan SET last_meter_reading = $2 WHERE machine_id = $1', [
        machineId,
        reading,
      ]);
    await setReading(M2, 1500);
    expect(await run(DUE_DAY, T2)).toMatchObject({ raised: 1 });
    const [meterJob] = await pmTickets(T2);
    expect(meterJob).toMatchObject({
      machine_id: M2,
      problem: 'PM due: VC-METER preventive maintenance',
    });

    // Tolerance moves the status only: 1549 and 1550 raise no second job.
    await setReading(M2, 1549);
    expect(await run(DUE_DAY, T2)).toMatchObject({ raised: 0 });
    await setReading(M2, 1550);
    expect(await run(DUE_DAY, T2)).toMatchObject({ raised: 0 });
    expect(await pmTickets(T2)).toHaveLength(1);
  });

  it('raises a meter plan with no baseline by its time interval', async () => {
    // The plan's meter is far past its interval, but no PM has recorded a baseline, so only time can raise it.
    expect(await run(DUE_DAY, T2)).toMatchObject({ raised: 0 });
    await db.admin.query("UPDATE pm_plan SET last_done_on = '2026-05-01' WHERE machine_id = $1", [
      M3,
    ]);
    expect(await run(DUE_DAY, T2)).toMatchObject({ raised: 1 });
    const tickets = await pmTickets(T2);
    expect(tickets.find((row) => row.machine_id === M3)?.problem).toBe(
      'PM due: VC-NOBASE preventive maintenance',
    );
    expect(await pmTickets(T2)).toHaveLength(2);
  });
});

describe('what the job skips', () => {
  it('skips a switched-off plan, a scrapped machine, a plan with no interval and a machine with an open PM job', async () => {
    expect(await run(DUE_DAY, T3)).toMatchObject({ raised: 0 });
    expect(await pmTickets(T3)).toHaveLength(0);
    // The machine with an open PM job keeps exactly its history: the closed baseline and the open job.
    const counted = await db.admin.query(
      `SELECT machine_id, count(*)::int AS n FROM ticket
        WHERE tenant_id = $1 AND raised_channel = 'pm' GROUP BY machine_id`,
      [T3],
    );
    expect(counted.rows).toEqual([{ machine_id: M7, n: 2 }]);
  });

  it('resolves one effective plan per machine, machine over category (R3)', async () => {
    const plans = await withTenant(db.app, T5, (client) => pmPlansForScheduling(client, T5));
    expect(plans).toHaveLength(2);
    const byMachine = new Map(plans.map((row) => [row.machineId, row.title]));
    expect(byMachine.get(M10)).toBe('Category fallback');
    expect(byMachine.get(M11)).toBe('Machine plan wins');

    // The one resolver the detail and the close share gives the same plan; a switched-off plan resolves to null.
    const resolve = (tenantId: string, machineId: string) =>
      withTenant(db.app, tenantId, (client) => pmPlanForMachine(client, tenantId, machineId));
    expect((await resolve(T5, M10))?.title).toBe('Category fallback');
    expect((await resolve(T5, M11))?.title).toBe('Machine plan wins');
    expect(await resolve(T3, M4)).toBeNull();

    expect(await run(DUE_DAY, T5)).toMatchObject({ raised: 2 });
    const titles = new Map((await pmTickets(T5)).map((row) => [row.machine_id, row.problem]));
    expect(titles.get(M10)).toBe('PM due: Category fallback');
    expect(titles.get(M11)).toBe('PM due: Machine plan wins');
  });
});

describe('tenancy and the job', () => {
  it('raises each plant its own tickets, and another plant never resolves a machine', async () => {
    const before = await Promise.all([T1, T2, T3, T4, T5].map(pmTickets));
    expect(await run(DUE_DAY)).toMatchObject({ raised: 1 });
    const after = await Promise.all([T1, T2, T3, T4, T5].map(pmTickets));
    expect(after.map((rows) => rows.length)).toEqual([2, 2, 0, 1, 2]);
    expect(before.map((rows) => rows.length)).toEqual([2, 2, 0, 0, 2]);
    expect(after[3]?.[0]).toMatchObject({
      machine_id: M8,
      problem: 'PM due: VC-T4 preventive maintenance',
    });

    const seen = await withTenant(db.app, T3, (client) => pmPlansForScheduling(client, T3));
    expect(seen.some((row) => row.machineId === M8)).toBe(false);
  });

  it('refuses a clock far from the database unless the fake clock is allowed', async () => {
    await expect(runPmGenerate(db.app, { now: DUE_DAY })).rejects.toThrow(/clock/);
  });
});
