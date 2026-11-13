import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runRetentionJob } from '../src/retention.js';
import { startTestDb, type TestDb } from './harness.js';

const NOW = new Date('2027-06-15T03:00:00Z');
const A = 'd1000000-0000-0000-0000-000000000001';
const B = 'd2000000-0000-0000-0000-000000000001';

let db: TestDb;
const people = new Map<string, string>();

/**
 * A closed breakdown reported 09:00, started 09:10 by one person, closed 10:00 with the machine still down:
 * response 10, hands-on 50, repair 50, downtime 60, no waiting. Worked out by hand, not by the code under test.
 */
const HAND_COMPUTED = {
  response_min: 10,
  active_min: 50,
  wait_min: 0,
  vendor_min: 0,
  handover_wait_min: 0,
  down_acc_min: 60,
  downtime_min: 60,
  follow_min: null,
  repair_min: 50,
};

interface Made {
  ref: string;
  channel?: string;
  status?: 'closed' | 'working';
  cached?: Partial<typeof HAND_COMPUTED>;
  overrides?: Record<string, number>;
}

async function ticket(tenantId: string, made: Made): Promise<string> {
  const id = randomUUID();
  const person = people.get(tenantId)!;
  const status = made.status ?? 'closed';
  const closed = status === 'closed';
  const cached = { ...HAND_COMPUTED, ...made.cached };
  await db.admin.query(
    `INSERT INTO ticket (id, tenant_id, ref, kind, status, problem, reported_at, severity, raised_channel,
       started_at, lead_person_id, closed_at, close_kind, response_min, active_min, wait_min, vendor_min,
       handover_wait_min, down_acc_min, downtime_min, follow_min, repair_min, overrides)
     VALUES ($1,$2,$3,'stopped',$4,'x','2027-01-10T09:00:00Z','S3',$5,'2027-01-10T09:10:00Z',$6,$7,$8,
       $9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
    [
      id,
      tenantId,
      made.ref,
      status,
      made.channel ?? 'floor',
      person,
      closed ? '2027-01-10T10:00:00Z' : null,
      closed ? 'no_report' : null,
      cached.response_min,
      cached.active_min,
      cached.wait_min,
      cached.vendor_min,
      cached.handover_wait_min,
      cached.down_acc_min,
      cached.downtime_min,
      cached.follow_min,
      cached.repair_min,
      JSON.stringify(made.overrides ?? {}),
    ],
  );
  const events: Array<[string, string]> = [
    ['down', '2027-01-10T09:00:00Z'],
    ['start', '2027-01-10T09:10:00Z'],
  ];
  if (closed) events.push(['close', '2027-01-10T10:00:00Z']);
  for (const [i, [type, at]] of events.entries()) {
    await db.admin.query(
      'INSERT INTO ticket_event (tenant_id, ticket_id, seq, type, at) VALUES ($1,$2,$3,$4,$5)',
      [tenantId, id, i + 1, type, at],
    );
  }
  await db.admin.query(
    `INSERT INTO work_segment (tenant_id, ticket_id, person_id, role, started_at, ended_at, end_reason)
     VALUES ($1,$2,$3,'lead','2027-01-10T09:10:00Z',$4,$5)`,
    [tenantId, id, person, closed ? '2027-01-10T10:00:00Z' : null, closed ? 'close' : null],
  );
  return id;
}

beforeAll(async () => {
  db = await startTestDb();
  for (const [id, slug] of [
    [A, 'alpha'],
    [B, 'bravo'],
  ] as const) {
    await db.admin.query('INSERT INTO tenant (id, slug, name) VALUES ($1, $2, $2)', [id, slug]);
    const person = randomUUID();
    await db.admin.query('INSERT INTO person (id, tenant_id, name) VALUES ($1, $2, $3)', [
      person,
      id,
      `Person ${slug}`,
    ]);
    people.set(id, person);
  }
}, 180_000);

afterAll(async () => {
  await db.stop();
});

const drift = (tenantId?: string) =>
  runRetentionJob(db.app, 'figures.drift', {
    now: NOW,
    allowFakeClock: true,
    ...(tenantId ? { tenantId } : {}),
  });

describe('figures.drift', () => {
  it('is silent when every cached figure matches its events', async () => {
    await ticket(A, { ref: 'BD-0001' });
    const result = await drift(A);
    expect(result.report).toEqual([]);
    expect(result.affected).toBe(0);
  });

  it('reports a cached figure that differs from its events, naming the ticket and both numbers', async () => {
    await ticket(A, { ref: 'BD-0002', cached: { active_min: 75, repair_min: 80 } });
    const result = await drift(A);
    expect(result.report).toEqual([
      { ref: 'BD-0002', figure: 'activeMin', cached: 75, recomputed: 50 },
      { ref: 'BD-0002', figure: 'repairMin', cached: 80, recomputed: 50 },
    ]);
    expect(result.affected).toBe(2);
  });

  it('skips a figure the admin overrode, but still checks the others on that ticket', async () => {
    await ticket(A, {
      ref: 'BD-0003',
      cached: { active_min: 75, wait_min: 9 },
      overrides: { handsOnOverrideMin: 75 },
    });
    const lines = (await drift(A)).report!.filter((line) => line.ref === 'BD-0003');
    expect(lines).toEqual([{ ref: 'BD-0003', figure: 'waitMin', cached: 9, recomputed: 0 }]);
  });

  it('skips tickets imported from Bhavin or backfilled, whose stored figures legitimately differ', async () => {
    await ticket(A, { ref: 'BD-0004', channel: 'import', cached: { repair_min: 999 } });
    await ticket(A, { ref: 'BD-0005', channel: 'backfill', cached: { repair_min: 999 } });
    await ticket(A, { ref: 'BD-0006', channel: 'desk', cached: { repair_min: 999 } });
    const refs = (await drift(A)).report!.map((line) => line.ref);
    expect(refs).not.toContain('BD-0004');
    expect(refs).not.toContain('BD-0005');
    expect(refs).toContain('BD-0006');
  });

  it('skips tickets that are still open: their figures move with the clock', async () => {
    await ticket(A, { ref: 'BD-0007', status: 'working', cached: { active_min: 1 } });
    expect((await drift(A)).report!.map((line) => line.ref)).not.toContain('BD-0007');
  });

  it('checks each customer on its own and changes nothing', async () => {
    await ticket(B, { ref: 'BD-0101', cached: { downtime_min: 5 } });
    const before = await db.admin.query(
      'SELECT ref, repair_min, active_min FROM ticket ORDER BY ref',
    );
    const onlyA = await drift(A);
    expect(onlyA.report!.map((line) => line.ref)).not.toContain('BD-0101');
    const everyone = await drift();
    expect(everyone.report!.map((line) => line.ref)).toContain('BD-0101');
    expect(everyone.tenants).toBeGreaterThanOrEqual(2);
    const after = await db.admin.query(
      'SELECT ref, repair_min, active_min FROM ticket ORDER BY ref',
    );
    expect(after.rows).toEqual(before.rows);
  });
});
