import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { compareReplySchema } from '@uptimo/shared';
import { withTenant } from '../src/kernel/index.js';
import { plantToday } from '../src/modules/plant/index.js';
import { A, M_FREE, M_USED, startFixture, type Fixture } from './plant-settings-fixture.js';

/**
 * Ticket 585 (ADR 0020 §1, §4): `GET /analytics/compare` answers the engine's Compare page for a chosen pair, the
 * picker's codes and each machine's year so far; money (the value of a machine hour, the spares rows) for heads only.
 * Plant A: VC-01 (`M_FREE`) and VC-02 (`M_USED`), both made Vertical Machining Centers, with history breakdowns today.
 */

const URL = '/api/v1/analytics/compare';
const THROUGHPUT = 4321987;

let f: Fixture;
let today: string;
let nextRef = 8100;

/** One closed backfilled breakdown (channel `backfill`, so the engine reads it as history) today on one machine. */
async function seedBreakdown(machine: string, minutes: number): Promise<void> {
  nextRef += 1;
  const at = `${today}T08:00:00+05:30`;
  const ticket = (
    await f.admin.query(
      `INSERT INTO ticket (tenant_id, ref, kind, status, machine_id, problem, reported_at, closed_at, severity, downtime_min, raised_channel)
       VALUES ($1, $2, 'stopped', 'closed', $3, 'Breakdown', $4, $4, 'S3', $5, 'backfill') RETURNING id`,
      [A, `BD-${nextRef}`, machine, at, minutes],
    )
  ).rows[0].id as string;
  await f.admin.query(
    `INSERT INTO breakdown_report (tenant_id, ticket_id, machine_id, date, shift_code, problem, downtime_min, maint_code)
     VALUES ($1, $2, $3, $4, 'DAY', 'Breakdown', $5, 'BRG')`,
    [A, ticket, machine, today, minutes],
  );
}

const get = (query: string, token = f.tokens.head!) => f.call('GET', `${URL}${query}`, token);

beforeAll(async () => {
  f = await startFixture();
  today = await withTenant(f.db.app, A, (tx) => plantToday(tx, A));
  await f.admin.query(
    "UPDATE machine SET category = 'Vertical Machining Center' WHERE tenant_id = $1 AND id = ANY($2)",
    [A, [M_FREE, M_USED]],
  );
  await seedBreakdown(M_FREE, 60);
  for (let i = 0; i < 3; i += 1) await seedBreakdown(M_USED, 120);
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

describe('GET /analytics/compare', () => {
  it('with no pair answers the engine’s own pair, its page and both years', async () => {
    const res = await get('');
    expect(res.statusCode).toBe(200);
    const reply = compareReplySchema.parse(res.json());
    expect(reply.asOf).toBe(today);
    expect(new Set([reply.pair!.a, reply.pair!.b])).toEqual(new Set(['VC-01', 'VC-02']));
    expect([...reply.options].sort()).toEqual(['VC-01', 'VC-02']);
    expect(reply.figure).toMatchObject({ key: 'compare', screen: 'compare', status: 'ready' });
    expect(reply.figure.value).not.toBeNull();
    expect(new Set(reply.figure.drill.ids)).toEqual(new Set([M_FREE, M_USED]));
    expect(reply.years).not.toBeNull();
  });

  it('a chosen pair comes back in the order asked, with each machine’s year so far', async () => {
    const reply = compareReplySchema.parse((await get('?a=VC-01&b=VC-02')).json());
    expect(reply.pair).toEqual({ a: 'VC-01', b: 'VC-02' });
    expect(reply.figure.drill).toEqual({ type: 'machine', ids: [M_FREE, M_USED] });
    const [a, b] = reply.years!;
    expect([a.code, a.count, a.hours]).toEqual(['VC-01', 1, 1]);
    expect([b.code, b.count, b.hours]).toEqual(['VC-02', 3, 6]);
  });

  it('a head gets the value of a machine hour and the spares rows', async () => {
    const res = await get('?a=VC-02&b=VC-01');
    expect(compareReplySchema.parse(res.json()).rate).toBe(THROUGHPUT);
    expect(res.body).toContain('Spares cost');
  });

  it('a supervisor gets the comparison with no money at all', async () => {
    const res = await get('?a=VC-02&b=VC-01', f.tokens.supervisor!);
    expect(res.statusCode).toBe(200);
    const reply = compareReplySchema.parse(res.json());
    expect(reply.rate).toBeNull();
    expect(reply.years).not.toBeNull();
    expect(res.body).not.toContain('Spares cost');
    expect(res.body).not.toContain(String(THROUGHPUT));
  });

  it('422 names the field to correct', async () => {
    const field = async (query: string) => {
      const res = await get(query);
      expect(res.statusCode, query).toBe(422);
      return (res.json() as { error: { field?: string } }).error.field;
    };
    expect(await field('?a=VC-01&b=VC-01')).toBe('b');
    expect(await field('?a=NOPE&b=VC-01')).toBe('a');
    expect(await field('?a=VC-01')).toBe('b');
    expect(await field('?asOf=11-11-2026')).toBe('asOf');
  });
});
