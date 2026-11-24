import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { compareReplySchema } from '@uptimo/shared';
import { withTenant } from '../../src/kernel/index.js';
import { plantToday } from '../../src/modules/plant/index.js';
import { A, M_B, M_FREE, M_USED, startFixture, type Fixture } from '../plant-settings-fixture.js';

/** Ticket 585, hidden: who may read the comparison, the plant with none, the other tenant, and the money cut. */

const URL = '/api/v1/analytics/compare';

let f: Fixture;
let today: string;

type Table = { title: string; rows: string[][]; rowCount: number };
const checkupOf = (value: unknown): Table =>
  (value as { pages: { tables: Table[] }[] }).pages[0]!.tables.find(
    (table) => table.title === 'Health checkup',
  )!;

beforeAll(async () => {
  f = await startFixture();
  today = await withTenant(f.db.app, A, (tx) => plantToday(tx, A));
  await f.admin.query(
    "UPDATE machine SET category = 'Vertical Machining Center' WHERE tenant_id = $1 AND id = ANY($2)",
    [A, [M_FREE, M_USED]],
  );
  for (const [n, machine] of [M_FREE, M_USED, M_USED].entries()) {
    const ticket = (
      await f.admin.query(
        `INSERT INTO ticket (tenant_id, ref, kind, status, machine_id, problem, reported_at, closed_at, severity, downtime_min, raised_channel)
         VALUES ($1, $2, 'stopped', 'closed', $3, 'Breakdown', $4, $4, 'S3', 30, 'backfill') RETURNING id`,
        [A, `BD-${8200 + n}`, machine, `${today}T09:00:00+05:30`],
      )
    ).rows[0].id as string;
    await f.admin.query(
      `INSERT INTO breakdown_report (tenant_id, ticket_id, machine_id, date, shift_code, problem, downtime_min, maint_code)
       VALUES ($1, $2, $3, $4, 'DAY', 'Breakdown', 30, 'ATC')`,
      [A, ticket, machine, today],
    );
  }
}, 180_000);

afterAll(async () => f.stop());

describe('GET /analytics/compare, hidden edges', () => {
  it('401 with no login, 403 for an operator', async () => {
    const anonymous = await f.app.inject({
      method: 'GET',
      url: URL,
      headers: { host: 'plant-a.localhost' },
    });
    expect(anonymous.statusCode).toBe(401);
    expect((await f.call('GET', URL, f.tokens.operator!)).statusCode).toBe(403);
  });

  it('a plant with no comparison answers 200 with nothing to compare', async () => {
    const res = await f.call('GET', URL, f.tokens['b-admin']!);
    expect(res.statusCode).toBe(200);
    const reply = compareReplySchema.parse(res.json());
    expect(reply.pair).toBeNull();
    expect(reply.years).toBeNull();
    expect(reply.options).toEqual([]);
    expect(reply.figure.value).toBeNull();
    expect(reply.figure.drill.ids).toEqual([]);
  });

  it('never names the other tenant’s machine', async () => {
    const res = await f.call('GET', `${URL}?a=VC-01&b=VC-02`, f.tokens.head!);
    expect(res.statusCode).toBe(200);
    expect(res.body).not.toContain(M_B);
  });

  it('b without a names a; a code is read trimmed', async () => {
    const res = await f.call('GET', `${URL}?b=VC-01`, f.tokens.head!);
    expect(res.statusCode).toBe(422);
    expect(res.json().error.field).toBe('a');
    const trimmed = await f.call('GET', `${URL}?a=%20VC-01%20&b=VC-02`, f.tokens.head!);
    expect(compareReplySchema.parse(trimmed.json()).pair).toEqual({ a: 'VC-01', b: 'VC-02' });
  });

  it('cuts exactly the two spares rows for a role without money, and keeps the row count true', async () => {
    const head = compareReplySchema.parse(
      (await f.call('GET', `${URL}?a=VC-01&b=VC-02`, f.tokens.head!)).json(),
    );
    const supervisor = compareReplySchema.parse(
      (await f.call('GET', `${URL}?a=VC-01&b=VC-02`, f.tokens.supervisor!)).json(),
    );
    const full = checkupOf(head.figure.value);
    const cut = checkupOf(supervisor.figure.value);
    expect(cut.rows).toEqual(full.rows.filter((row) => !row[0]!.startsWith('Spares cost')));
    expect(full.rows.length - cut.rows.length).toBe(2);
    expect(cut.rowCount).toBe(cut.rows.length);
    expect(supervisor.years).toEqual(head.years);
  });

  it('an asked date counts nothing after it in the year so far', async () => {
    const reply = compareReplySchema.parse(
      (await f.call('GET', `${URL}?a=VC-01&b=VC-02&asOf=2025-06-01`, f.tokens.head!)).json(),
    );
    expect(reply.asOf).toBe('2025-06-01');
    expect(reply.years!.map((year) => year.count)).toEqual([0, 0]);
  });
});
