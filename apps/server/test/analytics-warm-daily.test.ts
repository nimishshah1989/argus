import type { PgBoss } from 'pg-boss';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { withTenant } from '../src/kernel/index.js';
import { jobTenantIds } from '../src/modules/identity/index.js';
import { plantToday } from '../src/modules/plant/index.js';
import { startEngineJobs } from '../src/modules/analytics/jobs.js';
import {
  engineRunsInRead,
  FIGURES_WARM_QUEUE,
  resetEngineRunsInRead,
  warmServedRun,
} from '../src/modules/analytics/served.js';
import { A, B, startFixture, type Fixture } from './plant-settings-fixture.js';

// Ticket 606 (ADR 0024), reviewer finding: the daily warm (a `figures.warm` job with no plant) keeps today's served
// run for every plant, and one plant failing never stops the others (same shape as runPmGenerate: collect, then
// throw an AggregateError at the end).

vi.mock('../src/modules/analytics/served.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../src/modules/analytics/served.js')>();
  return { ...original, warmServedRun: vi.fn(original.warmServedRun) };
});

let f: Fixture;
let daily: (data: unknown) => Promise<unknown>;
beforeAll(async () => {
  f = await startFixture();
  // The smallest public surface: start the engine jobs on a stand-in queue handle and keep the warm worker.
  const boss = {
    getQueue: async () => ({}),
    createQueue: async () => undefined,
    schedule: async () => undefined,
    work: async (
      queue: string,
      _options: unknown,
      handler: (jobs: unknown[]) => Promise<unknown>,
    ) => {
      if (queue === FIGURES_WARM_QUEUE) daily = (data) => handler([{ id: 'daily', data }]);
      return 'worker-id';
    },
  } as unknown as PgBoss;
  await startEngineJobs(boss, { pool: f.db.app }, 'worker');
}, 180_000);
afterAll(async () => f.stop());
beforeEach(async () => {
  resetEngineRunsInRead();
  const original = (
    await vi.importActual<typeof import('../src/modules/analytics/served.js')>(
      '../src/modules/analytics/served.js',
    )
  ).warmServedRun;
  vi.mocked(warmServedRun).mockReset().mockImplementation(original);
  await f.admin.query(`DELETE FROM kpi_snapshot WHERE profile = 'served'`);
});

const today = (tenantId: string) =>
  withTenant(f.db.app, tenantId, (tx) => plantToday(tx, tenantId));
const read = async (token: string, asOf: string) => {
  const res = await f.call('GET', `/api/v1/analytics/figures?asOf=${asOf}`, token);
  expect(res.statusCode).toBe(200);
};
const readsAreKept = async () => {
  for (const [id, token] of [
    [A, f.tokens.head!],
    [B, f.tokens['b-admin']!],
  ] as const) {
    resetEngineRunsInRead();
    await read(token, await today(id));
    expect(engineRunsInRead(), `plant ${id} computed inside a read`).toBe(0);
  }
};

describe('daily figures warm (606)', () => {
  it('keeps today for every plant, so the first read of the day computes nothing', async () => {
    await daily({ v: 1 });
    await readsAreKept();
  });

  it('one plant failing does not stop the others; the job still fails at the end', async () => {
    const [first, second] = await jobTenantIds(f.db.app);
    const original = (
      await vi.importActual<typeof import('../src/modules/analytics/served.js')>(
        '../src/modules/analytics/served.js',
      )
    ).warmServedRun;
    vi.mocked(warmServedRun).mockImplementation(async (pool, input) => {
      if (input.tenantId === first) throw new Error('boom');
      return original(pool, input);
    });
    const error = await daily({ v: 1 }).then(
      () => undefined,
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(AggregateError);
    expect((error as AggregateError).errors).toHaveLength(1);
    // The plant after the failing one was still warmed: its first read computes nothing.
    resetEngineRunsInRead();
    const token = second === A ? f.tokens.head! : f.tokens['b-admin']!;
    await read(token, await today(second!));
    expect(engineRunsInRead()).toBe(0);
  });
});
