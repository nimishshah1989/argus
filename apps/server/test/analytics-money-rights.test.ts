import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MAX_DRILL_IDS } from '@uptimo/shared';
import { FIGURES } from '@uptimo/domain';
import { withTenant } from '../src/kernel/index.js';
import { plantToday } from '../src/modules/plant/index.js';
import { A, M_USED, startFixture, type Fixture } from './plant-settings-fixture.js';

/**
 * G1.6: rupees never reach a role without money rights on any route the v2 figures screens read. A supervisor may
 * read analytics but not money (`canMoney`). The plant carries a spare cost and a value of a machine hour that no
 * other number in it shares, so a leak shows up as that exact amount in the reply, whatever the field.
 */
const SPARE = 987654.32;
const THROUGHPUT = 4321987;
/** Each seeded amount as the engine or the reply could print it: raw, Indian grouping, and four rows' total. */
const AMOUNTS = ['987654', '9,87,654', '3950617', '39,50,617', '4321987', '43,21,987'];
/**
 * A rupee sign before any non-zero digit. Compare's two "Spares cost" rows print a placeholder `₹ 0` for every role
 * (the engine never fills them), which carries no plant data, so only a non-zero rupee counts as a leak here.
 */
const RUPEE = /₹\s?[1-9]/;
const MONEY_KEYS = new Set(FIGURES.filter((figure) => figure.money).map((figure) => figure.key));

let f: Fixture;
let today: string;
let nextRef = 7000;

type Reply = Awaited<ReturnType<Fixture['call']>>;

/** The reply carries none of the plant's money: no seeded amount and no non-zero rupee anywhere in its body. */
function expectNoMoney(res: Reply): void {
  for (const amount of AMOUNTS) expect(res.body, amount).not.toContain(amount);
  expect(res.body).not.toMatch(RUPEE);
}

/** One closed breakdown on `M_USED` today with a costly spare: four of them raise the freq and spares nudges. */
async function seedCostlyBreakdown(): Promise<void> {
  nextRef += 1;
  const start = `${today}T08:00:00+05:30`;
  const ticket = (
    await f.admin.query(
      `INSERT INTO ticket (tenant_id, ref, kind, status, machine_id, problem, reported_at, closed_at, severity, downtime_min)
       VALUES ($1, $2, 'stopped', 'closed', $3, 'Breakdown', $4, $4, 'S3', 15) RETURNING id`,
      [A, `BD-${nextRef}`, M_USED, start],
    )
  ).rows[0].id as string;
  await f.admin.query(
    `INSERT INTO breakdown_report (tenant_id, ticket_id, machine_id, date, shift_code, problem, downtime_min, maint_code, spare_used, spare_cost)
     VALUES ($1, $2, $3, $4, 'DAY', 'Breakdown', 15, 'BRG', 'Bearing', $5)`,
    [A, ticket, M_USED, today, SPARE],
  );
}

beforeAll(async () => {
  f = await startFixture();
  today = await withTenant(f.db.app, A, (tx) => plantToday(tx, A));
  for (let index = 0; index < 4; index += 1) await seedCostlyBreakdown();
  // A head sets the value of a machine hour, through the same screen a plant uses.
  const row = (await f.call('GET', '/api/v1/analytics-profile', f.tokens.head!)).json()
    .items[0] as Record<string, unknown>;
  const { id, active, ...numbers } = row;
  const form = Object.fromEntries(Object.entries(numbers).map(([k, v]) => [k, String(v)]));
  const saved = await f.call('PUT', `/api/v1/analytics-profile/${id}`, f.tokens.head!, {
    ...form,
    mmThroughput: String(THROUGHPUT),
    active,
  });
  expect(saved.statusCode).toBe(200);
}, 180_000);

afterAll(async () => f.stop());

/** The ids the head's figures drill to, per drill type: the rows a v2 screen asks the drill route for. */
async function drillIds(type: 'machine' | 'ticket' | 'move'): Promise<string[]> {
  const figures = (await f.call('GET', '/api/v1/analytics/figures', f.tokens.head!)).json()
    .figures as { drill: { type: string; ids: string[] } }[];
  const ids = [
    ...new Set(figures.filter((x) => x.drill.type === type).flatMap((x) => x.drill.ids)),
  ];
  return ids.length > 0 ? ids.slice(0, MAX_DRILL_IDS) : [randomUUID()];
}

describe('no rupee reaches a supervisor on a v2 figures route', () => {
  it('the head does see the seeded money, so the checks below can fail', async () => {
    const head = await f.call('GET', '/api/v1/analytics/figures', f.tokens.head!);
    expect(head.statusCode).toBe(200);
    expect(head.json().profile.mmThroughput).toBe(THROUGHPUT);
    expect(head.body).toContain(String(THROUGHPUT));
    const keys = (head.json().figures as { key: string }[]).map((x) => x.key);
    for (const key of MONEY_KEYS) expect(keys, key).toContain(key);
  });

  it('GET /analytics/figures: no money figure, the profile money nulled, no amount in any figure', async () => {
    const res = await f.call('GET', '/api/v1/analytics/figures', f.tokens.supervisor!);
    expect(res.statusCode).toBe(200);
    const keys = (res.json().figures as { key: string }[]).map((x) => x.key);
    expect(keys.filter((key) => MONEY_KEYS.has(key))).toEqual([]);
    expect(res.json().profile.mmThroughput).toBeNull();
    expectNoMoney(res);
  });

  it('GET /analytics/figures?asOf=<today>: the same for a dated read', async () => {
    const res = await f.call(
      'GET',
      `/api/v1/analytics/figures?asOf=${today}`,
      f.tokens.supervisor!,
    );
    expect(res.statusCode).toBe(200);
    expectNoMoney(res);
  });

  it.each(['ticket', 'machine', 'move'] as const)(
    'GET /analytics/drill?type=%s: the rows behind a figure carry no cost',
    async (type) => {
      const ids = await drillIds(type);
      const res = await f.call(
        'GET',
        `/api/v1/analytics/drill?type=${type}&ids=${ids.join(',')}`,
        f.tokens.supervisor!,
      );
      expect(res.statusCode).toBe(200);
      expectNoMoney(res);
    },
  );

  it('GET /analytics/action-center: the board, spares nudge included, names no amount', async () => {
    const res = await f.call('GET', '/api/v1/analytics/action-center', f.tokens.supervisor!);
    expect(res.statusCode).toBe(200);
    expectNoMoney(res);
  });

  it('PUT and DELETE /analytics/action-center/nudges/:key: the fresh board they answer names no amount', async () => {
    const board = (
      await f.call('GET', '/api/v1/analytics/action-center', f.tokens.supervisor!)
    ).json() as { nudges: { key: string; sev: string; status: string }[] };
    const open = board.nudges.find((n) => n.status === 'open' && n.sev !== 'info');
    expect(open, 'an open nudge to acknowledge').toBeDefined();
    const key = encodeURIComponent(open!.key);
    const ack = await f.call(
      'PUT',
      `/api/v1/analytics/action-center/nudges/${key}`,
      f.tokens.supervisor!,
      { status: 'ack' },
    );
    expect(ack.statusCode).toBe(200);
    expectNoMoney(ack);
    const reopen = await f.call(
      'DELETE',
      `/api/v1/analytics/action-center/nudges/${key}`,
      f.tokens.supervisor!,
    );
    expect(reopen.statusCode).toBe(200);
    expectNoMoney(reopen);
  });

  it('POST /analytics/run: refused, and the refusal carries no figure', async () => {
    const res = await f.call('POST', '/api/v1/analytics/run', f.tokens.supervisor!, {});
    expect(res.statusCode).toBe(403);
    expectNoMoney(res);
  });

  it('GET /analytics-profile: refused, so the value of a machine hour never reaches the screen', async () => {
    const res = await f.call('GET', '/api/v1/analytics-profile', f.tokens.supervisor!);
    expect(res.statusCode).toBe(403);
    expectNoMoney(res);
  });
});
