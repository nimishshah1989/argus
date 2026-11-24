import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { withTenant } from '../src/kernel/index.js';
import { runForTenant } from '../src/modules/analytics/service.js';
import {
  engineRunsInRead,
  FIGURES_WARM_QUEUE,
  resetEngineRunsInRead,
  warmServedRun,
} from '../src/modules/analytics/served.js';
import { A, M_USED, startFixture, type Fixture } from './plant-settings-fixture.js';

// Ticket 606 (ADR 0024): a read never computes the engine when it has something kept for the date. It serves the kept
// run and queues one warm job; the job brings the run up to date. Only a cold miss computes inside the read.

let f: Fixture;
beforeAll(async () => {
  f = await startFixture();
  await f.admin.query(
    `INSERT INTO ticket (tenant_id, ref, kind, status, machine_id, problem, reported_at, closed_at, raised_channel, severity)
     VALUES ($1, 'BD-7601', 'stopped', 'closed', $2, 'Spindle noise', '2026-11-01T04:00:00Z', '2026-11-01T06:00:00Z', 'floor', 'S3')`,
    [A, M_USED],
  );
}, 180_000);
afterAll(async () => f.stop());
beforeEach(() => resetEngineRunsInRead());

type Reply = { figures: unknown[]; rows: Record<string, number> };
const figures = async (asOf: string): Promise<Reply> => {
  const res = await f.call('GET', `/api/v1/analytics/figures?asOf=${asOf}`, f.tokens.head!);
  expect(res.statusCode).toBe(200);
  return res.json() as Reply;
};
const fresh = async (asOf: string) =>
  JSON.parse(
    JSON.stringify(await withTenant(f.db.app, A, (tx) => runForTenant(tx, { tenantId: A, asOf }))),
  ) as Reply;
const warmJobs = async (asOf: string) =>
  Number(
    (
      await f.admin.query(
        `SELECT count(*)::int AS n FROM pgboss.job
          WHERE name = $1 AND data->>'tenantId' = $2 AND data->>'asOf' = $3`,
        [FIGURES_WARM_QUEUE, A, asOf],
      )
    ).rows[0].n,
  );
let n = 7700;
/** A write that moves the stamp and changes the figures. */
const write = () =>
  f.admin.query(
    `INSERT INTO ticket (tenant_id, ref, kind, status, machine_id, problem, reported_at, closed_at, raised_channel, severity)
     VALUES ($1, $2, 'stopped', 'closed', $3, 'Belt snapped', '2026-11-05T04:00:00Z', '2026-11-05T09:00:00Z', 'floor', 'S3')`,
    [A, `BD-${(n += 1)}`, M_USED],
  );

describe('figures never computed inside a read (606)', () => {
  it('serves the old kept figures after a write, runs no engine, and queues a warm job', async () => {
    const day = '2026-11-12';
    const before = await figures(day); // cold miss: computes and keeps
    resetEngineRunsInRead();
    await write();
    const after = await figures(day);
    expect(after).toEqual(before);
    expect(engineRunsInRead()).toBe(0);
    expect(await warmJobs(day)).toBe(1);
  });

  it('queues one warm job for twenty concurrent stale reads', async () => {
    const day = '2026-11-13';
    await figures(day);
    resetEngineRunsInRead();
    await write();
    await Promise.all(Array.from({ length: 20 }, () => figures(day)));
    expect(engineRunsInRead()).toBe(0);
    expect(await warmJobs(day)).toBe(1);
  });

  it('keeps a run at the current stamp when the warm job runs; the next read has the new figures', async () => {
    const day = '2026-11-14';
    const before = await figures(day);
    await write();
    await warmServedRun(f.db.app, { tenantId: A, asOf: day });
    resetEngineRunsInRead();
    const after = await figures(day);
    expect(after).not.toEqual(before);
    expect(after.figures).toEqual((await fresh(day)).figures);
    expect(engineRunsInRead()).toBe(0);
    const queued = await warmJobs(day);
    await figures(day);
    expect(await warmJobs(day)).toBe(queued); // current stamp: nothing more to warm
  });

  it('computes once inside the read on a cold miss, and counts it', async () => {
    const day = '2026-11-15';
    expect(await warmJobs(day)).toBe(0);
    const first = await figures(day);
    expect(engineRunsInRead()).toBe(1);
    await figures(day);
    expect(engineRunsInRead()).toBe(1);
    expect(first.figures).toEqual((await fresh(day)).figures);
    expect(await warmJobs(day)).toBe(0);
  });
});
