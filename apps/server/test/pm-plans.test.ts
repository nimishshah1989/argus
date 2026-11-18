import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { A, B, M_B, M_FREE, M_USED, startFixture, type Fixture } from './plant-settings-fixture.js';

let f: Fixture;
const SEEDED = '10000000-0000-0000-0000-000000000201';
const OTHER_TENANT = '20000000-0000-0000-0000-000000000201';
let created = '';

beforeAll(async () => {
  f = await startFixture();
  await f.admin.query(
    `INSERT INTO pm_plan (id, tenant_id, machine_id, title, interval_days, last_done_on, checklist)
     VALUES ($1, $2, $3, 'VC-01 preventive maintenance', 182, '2026-05-01', '[]')`,
    [SEEDED, A, M_FREE],
  );
  await f.admin.query(
    `INSERT INTO pm_plan (id, tenant_id, machine_id, title, interval_days, checklist)
     VALUES ($1, $2, $3, 'VC-01 preventive maintenance', 90, '[]')`,
    [OTHER_TENANT, B, M_B],
  );
}, 180_000);
afterAll(async () => f.stop());

const head = () => f.tokens.head!;

async function audits(id: string) {
  return (
    await f.admin.query(
      `SELECT action, before, after FROM audit_log
        WHERE entity = 'pm_plan' AND entity_id = $1 ORDER BY at, id`,
      [id],
    )
  ).rows as Array<{
    action: string;
    before: Record<string, unknown> | null;
    after: Record<string, unknown> | null;
  }>;
}

describe('the PM plans settings resource', () => {
  it('lists this plant’s plans only, with numbers and an ISO clock anchor', async () => {
    const res = await f.call('GET', '/api/v1/settings/pm-plans', head());
    expect(res.statusCode).toBe(200);
    const items = res.json().items;
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: SEEDED,
      machineId: M_FREE,
      title: 'VC-01 preventive maintenance',
      intervalDays: 182,
      lastDoneOn: '2026-05-01',
      checklist: [],
      active: true,
    });
    expect(typeof items[0].createdAt).toBe('string');
    expect(items[0].createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(items.some((plan: { id: string }) => plan.id === OTHER_TENANT)).toBe(false);
  });

  it('creates a plan with a form’s text fields and audits the create', async () => {
    const res = await f.call('POST', '/api/v1/settings/pm-plans', head(), {
      title: 'VC-02 preventive maintenance',
      machineId: M_USED,
      intervalDays: '182',
      meterInterval: '500',
      meterTolerance: '15',
      lastMeterReading: '1200',
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({
      machineId: M_USED,
      intervalDays: 182,
      meterInterval: 500,
      meterTolerance: 15,
      lastMeterReading: 1200,
      active: true,
    });
    created = res.json().id;
    const lines = await audits(created);
    expect(lines.map((line) => line.action)).toEqual(['pmPlan.create']);
    expect(lines[0]!.before).toBeNull();
    expect(lines[0]!.after).toMatchObject({
      title: 'VC-02 preventive maintenance',
      intervalDays: 182,
    });
  });

  it('edits one value, shows it after reload and audits only the changed key', async () => {
    const res = await f.call('PUT', `/api/v1/settings/pm-plans/${created}`, head(), {
      intervalDays: '200',
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().intervalDays).toBe(200);
    const listed = (await f.call('GET', '/api/v1/settings/pm-plans', head()))
      .json()
      .items.find((plan: { id: string }) => plan.id === created);
    expect(listed.intervalDays).toBe(200);
    const lines = await audits(created);
    expect(lines.map((line) => line.action)).toEqual(['pmPlan.create', 'pmPlan.update']);
    expect(lines[1]!.before).toEqual({ intervalDays: 182 });
    expect(lines[1]!.after).toEqual({ intervalDays: 200 });
  });

  it('refuses a second active plan on the same machine with 409, naming the machine', async () => {
    const res = await f.call('POST', '/api/v1/settings/pm-plans', head(), {
      title: 'VC-02 second plan',
      machineId: M_USED,
      intervalDays: '90',
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.field).toBe('machineId');
  });

  it('refuses a plan without an interval, a future last done and another plant’s machine', async () => {
    const noInterval = await f.call('POST', '/api/v1/settings/pm-plans', head(), {
      title: 'No interval',
      machineId: M_USED,
    });
    expect(noInterval.statusCode).toBe(422);
    expect(noInterval.json().error.field).toBe('intervalDays');

    const future = await f.call('POST', '/api/v1/settings/pm-plans', head(), {
      title: 'Future plan',
      machineId: M_USED,
      intervalDays: '90',
      lastDoneOn: '2099-01-01',
    });
    expect(future.statusCode).toBe(422);
    expect(future.json().error.field).toBe('lastDoneOn');

    const foreign = await f.call('POST', '/api/v1/settings/pm-plans', head(), {
      title: 'Another plant’s machine',
      machineId: M_B,
      intervalDays: '90',
    });
    expect(foreign.statusCode).toBe(404);
    expect(foreign.json().error.field).toBe('machineId');

    const noTarget = await f.call('POST', '/api/v1/settings/pm-plans', head(), {
      title: 'Nowhere',
      intervalDays: '90',
    });
    expect(noTarget.statusCode).toBe(422);
    expect(noTarget.json().error.field).toBe('machineId');
  });

  it('allows a category plan: the fallback for machines without a machine plan', async () => {
    const res = await f.call('POST', '/api/v1/settings/pm-plans', head(), {
      title: 'VMC preventive maintenance',
      category: 'VMC',
      intervalDays: '182',
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ machineId: null, category: 'VMC', active: true });
  });

  it('switches a plan off through the same PUT and keeps it on the list', async () => {
    const res = await f.call('PUT', `/api/v1/settings/pm-plans/${created}`, head(), {
      active: false,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().active).toBe(false);
    const items = (await f.call('GET', '/api/v1/settings/pm-plans', head())).json().items;
    expect(items.find((plan: { id: string }) => plan.id === created).active).toBe(false);
    // With the first plan switched off, the machine can carry a new active one (R3: one *active* plan).
    const again = await f.call('POST', '/api/v1/settings/pm-plans', head(), {
      title: 'VC-02 again',
      machineId: M_USED,
      intervalDays: '182',
    });
    expect(again.statusCode).toBe(201);
    const lines = await audits(created);
    expect(lines.at(-1)!.action).toBe('pmPlan.update');
    expect(lines.at(-1)!.before).toEqual({ active: true });
    expect(lines.at(-1)!.after).toEqual({ active: false });
  });

  it('refuses a technician and an operator the settings cell', async () => {
    for (const token of [f.tokens.technician!, f.tokens.operator!]) {
      expect((await f.call('GET', '/api/v1/settings/pm-plans', token)).statusCode).toBe(403);
      expect(
        (
          await f.call('POST', '/api/v1/settings/pm-plans', token, {
            title: 'Nope',
            machineId: M_FREE,
            intervalDays: '90',
          })
        ).statusCode,
      ).toBe(403);
    }
  });
});
