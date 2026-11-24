import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  engineRunsInRead,
  FIGURES_WARM_QUEUE,
  resetEngineRunsInRead,
  warmServedRun,
} from '../../src/modules/analytics/served.js';
import { A, B, M_B, M_USED, startFixture, type Fixture } from '../plant-settings-fixture.js';

/** Ticket 606, hidden: two plants never share a warm job; warming a date with nothing kept keeps a run and counts no read. */

let f: Fixture;
beforeAll(async () => {
  f = await startFixture();
}, 180_000);
afterAll(async () => f.stop());
beforeEach(() => resetEngineRunsInRead());

const read = (token: string, asOf: string) =>
  f.call('GET', `/api/v1/analytics/figures?asOf=${asOf}`, token);
const jobs = async (tenantId: string, asOf: string) =>
  Number(
    (
      await f.admin.query(
        `SELECT count(*)::int AS n FROM pgboss.job WHERE name = $1 AND data->>'tenantId' = $2 AND data->>'asOf' = $3`,
        [FIGURES_WARM_QUEUE, tenantId, asOf],
      )
    ).rows[0].n,
  );
const kept = async (tenantId: string, asOf: string) =>
  Number(
    (
      await f.admin.query(
        "SELECT count(*)::int AS n FROM kpi_snapshot WHERE profile = 'served' AND tenant_id = $1 AND as_of = $2",
        [tenantId, asOf],
      )
    ).rows[0].n,
  );

describe('the warm job edges (606)', () => {
  it('queues one job per plant when both plants go stale on the same date', async () => {
    const day = '2026-11-12';
    expect((await read(f.tokens.head!, day)).statusCode).toBe(200);
    expect((await read(f.tokens['b-admin']!, day)).statusCode).toBe(200);
    await f.admin.query(
      `INSERT INTO ticket (tenant_id, ref, kind, status, machine_id, problem, reported_at, raised_channel, severity)
       VALUES ($1, 'BD-7801', 'stopped', 'open', $2, 'Belt', '2026-11-06T04:00:00Z', 'floor', 'S3'),
              ($3, 'BD-7802', 'stopped', 'open', $4, 'Belt', '2026-11-06T04:00:00Z', 'floor', 'S3')`,
      [A, M_USED, B, M_B],
    );
    await read(f.tokens.head!, day);
    await read(f.tokens['b-admin']!, day);
    expect(await jobs(A, day)).toBe(1);
    expect(await jobs(B, day)).toBe(1);
  });

  it('keeps a run for a date with nothing kept, and it is not a run in a read', async () => {
    const day = '2026-11-16';
    expect(await kept(A, day)).toBe(0);
    await warmServedRun(f.db.app, { tenantId: A, asOf: day });
    expect(await kept(A, day)).toBe(1);
    expect(engineRunsInRead()).toBe(0);
    expect((await read(f.tokens.head!, day)).statusCode).toBe(200);
    expect(engineRunsInRead()).toBe(0);
  });
});
