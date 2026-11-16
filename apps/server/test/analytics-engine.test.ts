import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { withTenant } from '../src/kernel/index.js';
import { loadEngineData } from '../src/modules/analytics/load.js';
import { runForTenant, type FigureStore } from '../src/modules/analytics/service.js';
import { A, B, M_USED, startFixture, type Fixture } from './plant-settings-fixture.js';

let f: Fixture;
beforeAll(async () => {
  f = await startFixture();
  // A closed breakdown with a report done by one technician, and a follow-up task under it.
  const ticket = (
    await f.admin.query("SELECT id FROM ticket WHERE tenant_id = $1 AND ref = 'BD-0001'", [A])
  ).rows[0].id as string;
  const person = (
    await f.admin.query(
      "SELECT id FROM person WHERE tenant_id = $1 AND name = 'plant-a technician'",
      [A],
    )
  ).rows[0].id as string;
  const report = (
    await f.admin.query(
      `INSERT INTO breakdown_report (tenant_id, ticket_id, machine_id, date, shift_code, problem, downtime_min, breakdown_category)
       VALUES ($1, $2, $3, '2026-11-01', 'DAY', 'Spindle noise, told plant-a technician', 90, 'M') RETURNING id`,
      [A, ticket, M_USED],
    )
  ).rows[0].id as string;
  await f.admin.query(
    "INSERT INTO breakdown_report_person (tenant_id, report_id, person_id, role) VALUES ($1, $2, $3, 'done')",
    [A, report, person],
  );
  await f.admin.query(
    `INSERT INTO ticket (tenant_id, ref, kind, status, machine_id, problem, reported_at, parent_id, task_reason, severity)
     VALUES ($1, 'BD-0002', 'general', 'open', $2, 'Recheck bearing', now(), $3, 'recheck', 'S4')`,
    [A, M_USED, ticket],
  );
}, 180_000);
afterAll(async () => f.stop());

const auditRows = async () =>
  (await f.admin.query("SELECT * FROM audit_log WHERE entity = 'analytics_profile' ORDER BY at"))
    .rows;

async function profileRow(token: string) {
  const res = await f.call('GET', '/api/v1/analytics-profile', token);
  expect(res.statusCode).toBe(200);
  return res.json().items[0] as Record<string, unknown>;
}

describe('the analytics profile and the engine, through HTTP', () => {
  it('a head sets the value of a machine hour, the engine uses it, an operator cannot, and the change is audited', async () => {
    const row = await profileRow(f.tokens.head!);
    expect(row).toMatchObject({
      prodHrsPerDay: 20,
      workDaysPerYear: 300,
      mmThroughput: 1800,
      snoozeDays: 7,
    });

    for (const role of ['operator', 'technician', 'supervisor', 'plant_head', 'board']) {
      const list = await f.call('GET', '/api/v1/analytics-profile', f.tokens[role]!);
      expect(list.statusCode, role).toBe(403);
      const edit = await f.call('PUT', `/api/v1/analytics-profile/${row.id}`, f.tokens[role]!, {
        mmThroughput: 1,
      });
      expect(edit.statusCode, role).toBe(403);
    }
    expect(await auditRows()).toHaveLength(0);

    const put = await f.call('PUT', `/api/v1/analytics-profile/${row.id}`, f.tokens.head!, {
      mmThroughput: '2500',
    });
    expect(put.statusCode).toBe(200);
    expect(put.json()).toMatchObject({ id: row.id, mmThroughput: 2500, prodHrsPerDay: 20 });

    const figures = await f.call(
      'GET',
      '/api/v1/analytics/figures?asOf=2026-11-11',
      f.tokens.head!,
    );
    expect(figures.statusCode).toBe(200);
    expect(figures.json()).toMatchObject({ asOf: '2026-11-11', profile: { mmThroughput: 2500 } });

    const audit = await auditRows();
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({
      action: 'analytics_profile.update',
      entity_id: row.id,
      before: { mmThroughput: 1800 },
      after: { mmThroughput: 2500 },
    });
  });

  it('refuses nonsense with 422, writes nothing and audits nothing; an unchanged value is not an event', async () => {
    const row = await profileRow(f.tokens.admin!);
    const before = (await auditRows()).length;
    for (const [body, field] of [
      [{ prodHrsPerDay: 25 }, 'prodHrsPerDay'],
      [{ workDaysPerYear: 0 }, 'workDaysPerYear'],
      [{ mmThroughput: -5 }, 'mmThroughput'],
      [{ freqMin: 2.5 }, 'freqMin'],
      [{ mmThroughput: 'lots' }, 'mmThroughput'],
      [{ madeUp: 1 }, 'madeUp'],
    ] as const) {
      const res = await f.call('PUT', `/api/v1/analytics-profile/${row.id}`, f.tokens.admin!, body);
      expect(res.statusCode, JSON.stringify(body)).toBe(422);
      expect(res.json().error.field, JSON.stringify(body)).toBe(field);
    }
    expect((await profileRow(f.tokens.admin!)).prodHrsPerDay).toBe(20);
    const same = await f.call('PUT', `/api/v1/analytics-profile/${row.id}`, f.tokens.admin!, {
      prodHrsPerDay: 20,
    });
    expect(same.statusCode).toBe(200);
    expect(await auditRows()).toHaveLength(before);
    expect(
      (await f.call('PUT', '/api/v1/analytics-profile/not-an-id', f.tokens.admin!, {})).statusCode,
    ).toBe(404);
  });

  it('has one profile row and no way to add another', async () => {
    const res = await f.call('POST', '/api/v1/analytics-profile', f.tokens.head!, {
      mmThroughput: 1,
    });
    expect(res.statusCode).toBe(404);
    const list = await f.call('GET', '/api/v1/analytics-profile', f.tokens.head!);
    expect(list.json().items).toHaveLength(1);
  });

  it('keeps plants apart: a plant sees only its own rows and its own profile', async () => {
    const a = (await f.call('GET', '/api/v1/analytics/figures', f.tokens.head!)).json();
    expect(a.rows).toEqual({ machines: 2, moves: 0, tickets: 1, tasks: 1, reports: 1, people: 7 });
    expect(a.profile.mmThroughput).toBe(2500);
    const b = (await f.call('GET', '/api/v1/analytics/figures', f.tokens['b-admin']!)).json();
    expect(b.rows).toMatchObject({ machines: 1, tickets: 0, people: 1 });
    expect(b.profile.mmThroughput).toBe(1800);
    const aRow = await profileRow(f.tokens.head!);
    const crossEdit = await f.call(
      'PUT',
      `/api/v1/analytics-profile/${aRow.id}`,
      f.tokens['b-admin']!,
      {
        mmThroughput: 1,
      },
    );
    expect(crossEdit.statusCode).toBe(404);
    expect((await profileRow(f.tokens.head!)).mmThroughput).toBe(2500);
  });

  it('answers every registered figure with its owner and a drill type, and defaults the date to the plant today', async () => {
    const res = await f.call('GET', '/api/v1/analytics/figures', f.tokens.head!);
    const { asOf, figures } = res.json();
    expect(asOf).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(figures.length).toBeGreaterThan(30);
    for (const figure of figures) {
      expect(['machine', 'ticket', 'move'], figure.key).toContain(figure.drill.type);
      expect(figure.owner, figure.key).toBeGreaterThanOrEqual(38);
      expect(figure.status, figure.key).toBe('not_computed');
    }
    expect(figures.map((figure: { key: string }) => figure.key)).toContain('money-matters');
  });

  it('shows money only to heads and admin, and the figures only to those who may read analytics', async () => {
    const supervisor = await f.call('GET', '/api/v1/analytics/figures', f.tokens.supervisor!);
    expect(supervisor.statusCode).toBe(200);
    expect(supervisor.json().profile.mmThroughput).toBeNull();
    expect(supervisor.json().figures.map((x: { key: string }) => x.key)).not.toContain(
      'money-matters',
    );
    for (const role of ['operator', 'technician', 'board']) {
      expect(
        (await f.call('GET', '/api/v1/analytics/figures', f.tokens[role]!)).statusCode,
        role,
      ).toBe(403);
    }
  });

  it('saves what the generated screen sends: every number as text, and the row switch sent back', async () => {
    const row = await profileRow(f.tokens.head!);
    const { id, active, ...numbers } = row;
    const form = Object.fromEntries(Object.entries(numbers).map(([k, v]) => [k, String(v)]));
    const before = (await auditRows()).length;
    const same = await f.call('PUT', `/api/v1/analytics-profile/${id}`, f.tokens.head!, {
      ...form,
      active,
    });
    expect(same.statusCode).toBe(200);
    expect(await auditRows()).toHaveLength(before);
    const edit = await f.call('PUT', `/api/v1/analytics-profile/${id}`, f.tokens.head!, {
      ...form,
      snoozeDays: '10',
      active,
    });
    expect(edit.statusCode).toBe(200);
    expect(edit.json().snoozeDays).toBe(10);
    const audit = await auditRows();
    expect(audit).toHaveLength(before + 1);
    expect(audit.at(-1)).toMatchObject({ before: { snoozeDays: 7 }, after: { snoozeDays: 10 } });
    const off = await f.call('PUT', `/api/v1/analytics-profile/${id}`, f.tokens.head!, {
      active: false,
    });
    expect(off.statusCode).toBe(422);
  });

  it('refuses numbers that cannot both be true, naming the field to correct', async () => {
    const row = await profileRow(f.tokens.head!);
    const res = await f.call('PUT', `/api/v1/analytics-profile/${row.id}`, f.tokens.head!, {
      repeatMinDays: 9,
    });
    expect(res.statusCode).toBe(422);
    expect(res.json().error.field).toBe('repeatMinDays');
    expect((await profileRow(f.tokens.head!)).repeatMinDays).toBe(2);
  });

  it('runs the engine as of a past plant date: later tickets, reports and closings are not in it', async () => {
    // 01:00 IST on 1 Nov is 19:30Z on 31 Oct: it belongs to 1 Nov in this plant.
    const nightStop = (
      await f.admin.query(
        `INSERT INTO ticket (tenant_id, ref, kind, status, machine_id, problem, reported_at, severity)
         VALUES ($1, 'BD-0003', 'stopped', 'open', $2, 'Night stop', '2026-10-31T19:30:00Z', 'S3')
         RETURNING id`,
        [A, M_USED],
      )
    ).rows[0].id as string;
    // A report is in a snapshot only with its own ticket: point the seeded report at this 1 Nov ticket,
    // so the cut proves the report's date rather than an incoherent report with a ticket from the future.
    await f.admin.query('UPDATE breakdown_report SET ticket_id = $1 WHERE tenant_id = $2', [
      nightStop,
      A,
    ]);
    const at = async (asOf: string) =>
      (await f.call('GET', `/api/v1/analytics/figures?asOf=${asOf}`, f.tokens.head!)).json().rows;
    expect((await at('2026-10-31')).tickets).toBe(0);
    expect((await at('2026-11-01')).tickets).toBe(1);
    expect((await at('2026-10-31')).reports).toBe(0);
    expect((await at('2026-11-01')).reports).toBe(1);
  });

  it('shows the money numbers of the profile only to heads and admin', async () => {
    const money = ['mmThroughput', 'mmTurnover', 'mmSucc'];
    const head = (await f.call('GET', '/api/v1/analytics/figures', f.tokens.head!)).json().profile;
    for (const key of money) expect(head[key], key).toEqual(expect.any(Number));
    const supervisor = (
      await f.call('GET', '/api/v1/analytics/figures', f.tokens.supervisor!)
    ).json().profile;
    for (const key of money) expect(supervisor[key], key).toBeNull();
    expect(supervisor.snoozeDays).toBe(10);
  });

  it('refuses a date that is not a plant date', async () => {
    const res = await f.call('GET', '/api/v1/analytics/figures?asOf=2026-02-30', f.tokens.head!);
    expect(res.statusCode).toBe(422);
    expect(res.json().error.field).toBe('asOf');
  });
});

describe('the data loader', () => {
  it('reads the plant into plain rows: tasks apart from tickets, people as codes, no names or phones', async () => {
    const data = await withTenant(f.db.app, A, (tx) => loadEngineData(tx, A));
    expect(data.machines.map((m) => m.code)).toEqual(['VC-01', 'VC-02']);
    expect(data.tickets.map((t) => t.ref)).toEqual(['BD-0003', 'BD-0001']);
    expect(data.tasks.map((t) => [t.ref, t.reason])).toEqual([['BD-0002', 'recheck']]);
    expect(data.reports).toHaveLength(1);
    expect(data.reports[0]).toMatchObject({ downtimeMin: 90, category: 'M', shift: 'DAY' });
    const technician = data.people.find((p) => p.code === data.reports[0]!.doneBy[0]);
    expect(technician).toMatchObject({ team: 'maintenance', active: true });
    expect(data.reports[0]!.supportedBy).toEqual([]);
    expect(data.lists.wait_reason?.map((l) => l.code)).toEqual(['spare']);
    const text = JSON.stringify(data);
    expect(text).not.toMatch(/plant-a|plant-b/);
    expect(text).not.toMatch(/phone/i);
    expect(data.reports[0]!.problem).toMatch(/^Spindle noise, told \[P\d+\]$/);
    expect(data.timeZone).toBe('Asia/Kolkata');
    expect(data.people.every((p) => /^P-[0-9a-f]{8}$/.test(p.code))).toBe(true);
  });
});

describe('storing a run', () => {
  it('hands the result to the figure store inside the same transaction, and stores nothing by default', async () => {
    const saved: Array<{ tenantId: string; figures: number }> = [];
    const store: FigureStore = {
      save: async (_tx, tenantId, result) =>
        void saved.push({ tenantId, figures: result.figures.length }),
    };
    const result = await withTenant(f.db.app, B, (tx) =>
      runForTenant(tx, { tenantId: B, asOf: '2026-11-11', store }),
    );
    expect(saved).toEqual([{ tenantId: B, figures: result.figures.length }]);
    const plain = await withTenant(f.db.app, B, (tx) =>
      runForTenant(tx, { tenantId: B, asOf: '2026-11-11' }),
    );
    expect(plain).toEqual(result);
  });
});
