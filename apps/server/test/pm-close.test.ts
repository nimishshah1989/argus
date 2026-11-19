// Ticket 49c: the PM close. 46b writes a close's `pmReport` verbatim, so the route builds the stored object before
// the store (R8): it resolves the plan behind the job, derives `total`/`doneBy`, validates every ticked point and
// reading against the plan's checklist, and the close moves the plan's `last_done_on`/`last_meter_reading` in the
// same transaction. A switched-off plan closes but is not moved; a category plan is allowed when it is the machine's
// effective plan; a `planId` that is not the job's effective plan is refused; a report that is not a PM job's keeps
// `pm_report` NULL.
import { withTenant } from '@uptimo/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { raisePlannedTicket } from '../src/modules/tickets/index.js';
import {
  A,
  B,
  M_B,
  SEG_A,
  startFixture,
  type Fixture,
  type Res,
} from './plant-settings-fixture.js';

const HOST = 'plant-a.localhost';

/** The plan's checklist (R5): three tick points and one measured reading. */
const CHECKLIST = [
  { id: '1', kind: 'tick', point: 1 },
  { id: '2', kind: 'tick', point: 2 },
  { id: '3', kind: 'tick', point: 3 },
  { id: '4.bx', kind: 'reading', point: 4, metric: 'bx', label: 'Backlash X', unit: 'mm' },
];

let f: Fixture;
let keyCounter = 0;
let headPersonId = '';

function post(url: string, token: string, payload: object): Promise<Res> {
  keyCounter += 1;
  return f.app.inject({
    method: 'POST',
    url,
    headers: {
      host: HOST,
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
      'idempotency-key': `pmc-${keyCounter}`,
    },
    payload,
  });
}

async function machine(code: string, category: string | null = null): Promise<string> {
  const row = await f.admin.query(
    "INSERT INTO machine (tenant_id, code, segment_id, category, cell) VALUES ($1, $2, $3, $4, 'Cell 1') RETURNING id",
    [A, code, SEG_A, category],
  );
  return row.rows[0].id as string;
}

interface PlanFields {
  machineId?: string | null;
  category?: string | null;
  title?: string;
  intervalDays?: number | null;
  meterInterval?: number | null;
  lastMeterReading?: number | null;
  lastDoneOn?: string | null;
  checklist?: unknown[];
  active?: boolean;
}

/** One `pm_plan` row, written the way the seed or the settings screen writes it. */
async function plan(fields: PlanFields = {}, tenantId = A): Promise<string> {
  const row = await f.admin.query(
    `INSERT INTO pm_plan (tenant_id, machine_id, category, title, interval_days, meter_interval,
       last_meter_reading, last_done_on, checklist, active)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
    [
      tenantId,
      fields.machineId ?? null,
      fields.category ?? null,
      fields.title ?? 'Preventive maintenance',
      fields.intervalDays === undefined ? 182 : fields.intervalDays,
      fields.meterInterval ?? null,
      fields.lastMeterReading ?? null,
      fields.lastDoneOn ?? null,
      JSON.stringify(fields.checklist ?? CHECKLIST),
      fields.active ?? true,
    ],
  );
  return row.rows[0].id as string;
}

/** A PM job on the machine, raised through 46c's planned raise and started by the technician (a close needs working). */
async function pmJob(machineId: string, tenantId = A): Promise<string> {
  const ticket = await withTenant(f.db.app, tenantId, (client) =>
    raisePlannedTicket(client, {
      tenantId,
      machineId,
      channel: 'pm',
      problem: 'PM due: Preventive maintenance',
    }),
  );
  const started = await post(`/api/v1/tickets/${ticket.id}/start`, f.tokens.technician!, {});
  expect(started.statusCode, started.body).toBe(200);
  return ticket.id;
}

const close = (id: string, payload: object) =>
  post(`/api/v1/tickets/${id}/close`, f.tokens.head!, payload);
const detail = (id: string) => f.call('GET', `/api/v1/tickets/${id}`, f.tokens.head!);
const errorOf = (res: Res): Record<string, unknown> => res.json().error as Record<string, unknown>;

async function storedReport(id: string) {
  const row = (
    await f.admin.query(
      `SELECT r.pm_report, r.failure_component, t.close_kind
         FROM breakdown_report r JOIN ticket t ON t.id = r.ticket_id
        WHERE r.ticket_id = $1`,
      [id],
    )
  ).rows[0];
  return row as
    | {
        pm_report: Record<string, unknown> | null;
        close_kind: string;
        failure_component: string | null;
      }
    | undefined;
}

async function planRow(id: string) {
  return (
    await f.admin.query(
      'SELECT last_done_on::text AS last_done_on, last_meter_reading::float8 AS meter FROM pm_plan WHERE id = $1',
      [id],
    )
  ).rows[0] as { last_done_on: string | null; meter: number | null };
}

/** The plant day the ticket closed on: the same day the plan's move is judged in (Asia/Kolkata by default). */
async function closedDay(id: string): Promise<string> {
  return (
    await f.admin.query(
      "SELECT ((closed_at AT TIME ZONE 'Asia/Kolkata')::date)::text AS day FROM ticket WHERE id = $1",
      [id],
    )
  ).rows[0].day as string;
}

/** The reported body of a PM close, with the placeholders the phone sends (R8: the server derives them). */
const pmBody = (planId: string | undefined, patch: Record<string, unknown> = {}) => ({
  kind: 'report',
  at: new Date().toISOString(),
  report: {
    pmReport: {
      ...(planId ? { planId } : {}),
      total: 0,
      undone: [],
      readings: {},
      comments: null,
      doneBy: null,
      ...patch,
    },
  },
});

beforeAll(async () => {
  f = await startFixture();
  headPersonId = (
    await f.admin.query(
      "SELECT person_id FROM login WHERE tenant_id = $1 AND username = 'plant-a-head'",
      [A],
    )
  ).rows[0].person_id as string;
  // The plant's failure-code list, so a live breakdown close with a report is accepted (the non-PM case).
  await f.admin.query(
    `INSERT INTO list_item (tenant_id, list, code, label) VALUES ($1, 'failure_code', 'E', 'Electrical')`,
    [A],
  );
}, 180_000);

afterAll(async () => f.stop());

describe('a PM close builds the stored report before the store (R8)', () => {
  it('derives total and doneBy, writes the plan id, and moves the plan in the same transaction', async () => {
    const machineId = await machine('PM-01');
    const planId = await plan({
      machineId,
      meterInterval: 500,
      lastMeterReading: 1000,
      lastDoneOn: '2026-01-01',
    });
    const id = await pmJob(machineId);

    // The detail carries the job's effective plan and its checklist, so the screen can render it.
    const loaded = await detail(id);
    expect(loaded.statusCode, loaded.body).toBe(200);
    expect(loaded.json().pmPlan).toMatchObject({ id: planId, active: true, checklist: CHECKLIST });

    const closed = await close(
      id,
      pmBody(planId, {
        undone: ['2'],
        readings: { '4.bx': 0.01, meter: 1200 },
        comments: 'Guard refitted',
      }),
    );
    expect(closed.statusCode, closed.body).toBe(200);
    expect(closed.json().ticket.closeKind).toBe('report');

    const report = await storedReport(id);
    expect(report?.close_kind).toBe('report');
    expect(report?.pm_report).toEqual({
      total: 3,
      undone: ['2'],
      readings: { '4.bx': 0.01, meter: 1200 },
      comments: 'Guard refitted',
      doneBy: headPersonId,
      planId,
    });
    // A PM close carries no failure code and asks no sign-off (Q32/49 R8).
    expect(report?.failure_component).toBeNull();
    const closeEvent = (
      await f.admin.query(
        "SELECT payload FROM ticket_event WHERE ticket_id = $1 AND type = 'close'",
        [id],
      )
    ).rows[0];
    expect(closeEvent.payload?.handbackRequested).toBeUndefined();

    const moved = await planRow(planId);
    expect(moved.last_done_on).toBe(await closedDay(id));
    expect(moved.meter).toBe(1200);

    const after = await detail(id);
    expect(after.json().report.pmReport).toMatchObject({ total: 3, undone: ['2'], planId });
    expect(after.json().ticket.closeKind).toBe('report');
  });

  it('ignores the client placeholders: the server derivation wins', async () => {
    const machineId = await machine('PM-02');
    const planId = await plan({ machineId });
    const id = await pmJob(machineId);
    const closed = await close(id, pmBody(planId, { total: 99, doneBy: null }));
    expect(closed.statusCode, closed.body).toBe(200);
    expect((await storedReport(id))?.pm_report).toMatchObject({ total: 3, doneBy: headPersonId });
  });

  it('closes a non-PM report with pm_report NULL, even when the body smuggles one', async () => {
    const machineId = await machine('PM-03');
    const raised = await post('/api/v1/tickets', f.tokens.technician!, {
      machineId,
      kind: 'stopped',
      problem: 'Spindle alarm',
    });
    expect(raised.statusCode, raised.body).toBe(201);
    const id = raised.json().ticket.id as string;
    expect((await post(`/api/v1/tickets/${id}/start`, f.tokens.technician!, {})).statusCode).toBe(
      200,
    );
    const closed = await close(id, {
      kind: 'report',
      report: {
        correctiveAction: 'Replaced the belt',
        failureComponent: 'E',
        pmReport: { total: 9, undone: [], readings: {}, comments: null, doneBy: null },
      },
    });
    expect(closed.statusCode, closed.body).toBe(200);
    expect((await storedReport(id))?.pm_report).toBeNull();
    expect((await detail(id)).json().pmPlan).toBeNull();
  });
});

describe('the accepted plan (R8)', () => {
  it('refuses another plant’s plan id and a plan that is not the job’s, writing nothing', async () => {
    const machineId = await machine('PM-10');
    const planId = await plan({ machineId });
    const other = await plan({ machineId: null, category: 'VMC', title: 'Another machine' });
    const foreign = await plan({ machineId: M_B, title: 'The other plant' }, B);
    const id = await pmJob(machineId);

    const notMine = await close(id, pmBody(other));
    expect(notMine.statusCode).toBe(422);
    expect(errorOf(notMine)).toMatchObject({ code: 'validation', field: 'planId' });

    const elsewhere = await close(id, pmBody(foreign));
    expect(elsewhere.statusCode).toBe(404);
    expect(errorOf(elsewhere)).toMatchObject({ code: 'not_found', field: 'planId' });

    expect(await storedReport(id)).toBeUndefined();
    expect((await detail(id)).json().ticket.status).toBe('working');
    expect((await planRow(planId)).last_done_on).toBeNull();
  });

  it('refuses a reading key off the checklist and a meter plan with no meter reading', async () => {
    const machineId = await machine('PM-11');
    const planId = await plan({ machineId, meterInterval: 500, lastMeterReading: 1000 });
    const id = await pmJob(machineId);

    const badKey = await close(id, pmBody(planId, { readings: { '9.zz': 1, meter: 1200 } }));
    expect(badKey.statusCode).toBe(422);
    expect(errorOf(badKey)).toMatchObject({ code: 'validation', field: 'readings' });

    const noMeter = await close(id, pmBody(planId, { readings: { '4.bx': 0.01 } }));
    expect(noMeter.statusCode).toBe(422);
    expect(errorOf(noMeter)).toMatchObject({ code: 'validation', field: 'readings.meter' });

    const badTick = await close(id, pmBody(planId, { undone: ['99'], readings: { meter: 1200 } }));
    expect(badTick.statusCode).toBe(422);
    expect(errorOf(badTick)).toMatchObject({ code: 'validation', field: 'undone' });

    expect(await storedReport(id)).toBeUndefined();
    expect((await planRow(planId)).last_done_on).toBeNull();
  });
});

describe('the plan a close leaves behind (R8)', () => {
  it('closes a plan switched off after the job opened, but does not move it', async () => {
    const machineId = await machine('PM-20');
    const planId = await plan({ machineId, lastDoneOn: '2026-01-01' });
    const id = await pmJob(machineId);
    await f.admin.query('UPDATE pm_plan SET active = false WHERE id = $1', [planId]);

    const closed = await close(id, pmBody(planId, { undone: ['1'] }));
    expect(closed.statusCode, closed.body).toBe(200);
    expect((await storedReport(id))?.pm_report).toMatchObject({ total: 3, undone: ['1'], planId });
    expect((await planRow(planId)).last_done_on).toBe('2026-01-01');
  });

  it('allows a category plan whose category is the machine’s, and moves it', async () => {
    const machineId = await machine('PM-21', 'HMC');
    const planId = await plan({ category: 'HMC', title: 'HMC category maintenance' });
    const id = await pmJob(machineId);

    const closed = await close(id, pmBody(planId, { undone: ['3'] }));
    expect(closed.statusCode, closed.body).toBe(200);
    expect((await storedReport(id))?.pm_report).toMatchObject({ total: 3, undone: ['3'], planId });
    expect((await planRow(planId)).last_done_on).toBe(await closedDay(id));
  });

  it('closes a job whose plan row is gone with an empty report, never a dead end', async () => {
    const machineId = await machine('PM-22');
    const planId = await plan({ machineId });
    const id = await pmJob(machineId);
    await f.admin.query('DELETE FROM pm_plan WHERE id = $1', [planId]);

    const closed = await close(id, pmBody(planId, { undone: ['2'] }));
    expect(closed.statusCode, closed.body).toBe(200);
    expect((await storedReport(id))?.pm_report).toEqual({
      total: 0,
      undone: [],
      readings: {},
      comments: null,
      doneBy: headPersonId,
    });
  });

  it('moves the active plan on a mark-done close, so the next run owes no second job', async () => {
    const machineId = await machine('PM-23');
    const planId = await plan({ machineId, lastDoneOn: '2026-01-01' });
    const id = await pmJob(machineId);

    const closed = await close(id, { kind: 'done', note: 'Done on the floor' });
    expect(closed.statusCode, closed.body).toBe(200);
    expect(await storedReport(id)).toBeUndefined();
    expect((await planRow(planId)).last_done_on).toBe(await closedDay(id));
  });
});

describe('the list reads the channel (49c)', () => {
  it('lists a PM job only under channel=pm, and the detail always carries the key', async () => {
    const machineId = await machine('PM-30');
    await plan({ machineId });
    const id = await pmJob(machineId);

    const pm = await f.call(
      'GET',
      '/api/v1/tickets?channel=pm&status=open,working',
      f.tokens.head!,
    );
    expect(pm.statusCode, pm.body).toBe(200);
    expect(pm.json().items.map((item: { id: string }) => item.id)).toContain(id);

    const floor = await f.call('GET', '/api/v1/tickets?channel=floor', f.tokens.head!);
    expect(floor.json().items.map((item: { id: string }) => item.id)).not.toContain(id);

    const unknown = await f.call('GET', '/api/v1/tickets?channel=nope', f.tokens.head!);
    expect(unknown.statusCode).toBe(422);
    expect((await detail(id)).json()).toHaveProperty('pmPlan');
  });
});
