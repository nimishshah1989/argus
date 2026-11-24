import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { actionCenterBoardSchema } from '@uptimo/shared';
import { withTenant } from '../src/kernel/index.js';
import { plantToday } from '../src/modules/plant/index.js';
import { engineRunsInRead, resetEngineRunsInRead } from '../src/modules/analytics/served.js';
import { boardsBuilt, resetServedBoards } from '../src/modules/analytics/served-board.js';
import { A, M_USED, startFixture, type Fixture } from './plant-settings-fixture.js';

// Ticket 628 (ADR 0029 addendum): the Action Center board a read answers is built once per data stamp. 30 readers
// on five years queued to p95 1,073 ms because every read loaded the plant and ran the board. A write must still
// show on the very next read.

let f: Fixture;
let today: string;
let nextRef = 6300;

/** One closed breakdown today on the used machine; four of them raise the plant's freq nudge. */
async function breakdown(): Promise<void> {
  nextRef += 1;
  const ticket = (
    await f.admin.query(
      `INSERT INTO ticket (tenant_id, ref, kind, status, machine_id, problem, reported_at, closed_at, severity, downtime_min)
       VALUES ($1, $2, 'stopped', 'closed', $3, 'Breakdown', $4, $4, 'S3', 15) RETURNING id`,
      [A, `BD-${nextRef}`, M_USED, `${today}T08:00:00+05:30`],
    )
  ).rows[0].id as string;
  await f.admin.query(
    `INSERT INTO breakdown_report (tenant_id, ticket_id, machine_id, date, shift_code, problem, downtime_min, maint_code)
     VALUES ($1, $2, $3, $4, 'DAY', 'Breakdown', 15, 'BRG')`,
    [A, ticket, M_USED, today],
  );
}

const FREQ_KEY = `freq|${M_USED}`;
const read = () => f.call('GET', '/api/v1/analytics/action-center', f.tokens.head!);
const boardOf = async () => {
  const res = await read();
  expect(res.statusCode).toBe(200);
  return actionCenterBoardSchema.parse(res.json());
};
const freq = async () => (await boardOf()).nudges.find((nudge) => nudge.key === FREQ_KEY);

beforeAll(async () => {
  f = await startFixture();
  today = await withTenant(f.db.app, A, (tx) => plantToday(tx, A));
  for (let i = 0; i < 4; i += 1) await breakdown();
}, 180_000);
afterAll(async () => f.stop());
beforeEach(() => {
  resetEngineRunsInRead();
  resetServedBoards();
});

describe('a board read is cheap (628)', () => {
  it('builds the board once for ten reads, counts that one build as an engine run, and answers the same board', async () => {
    const first = await boardOf();
    for (let i = 0; i < 9; i += 1) expect(await boardOf()).toEqual(first);
    expect(boardsBuilt()).toBe(1);
    expect(engineRunsInRead()).toBe(1);
  });

  it('ten readers at once on a cold board share one build', async () => {
    const replies = await Promise.all(Array.from({ length: 10 }, read));
    for (const res of replies) expect(res.statusCode).toBe(200);
    expect(boardsBuilt()).toBe(1);
    expect(engineRunsInRead()).toBe(1);
  });

  it('shows an ack on the very next read', async () => {
    expect((await freq())?.status).toBe('open');
    const put = await f.call(
      'PUT',
      `/api/v1/analytics/action-center/nudges/${encodeURIComponent(FREQ_KEY)}`,
      f.tokens.supervisor!,
      { status: 'ack' },
    );
    expect(put.statusCode).toBe(200);
    expect((await freq())?.status).toBe('ack');
    expect(boardsBuilt()).toBe(2);
    await f.call(
      'DELETE',
      `/api/v1/analytics/action-center/nudges/${encodeURIComponent(FREQ_KEY)}`,
      f.tokens.supervisor!,
    );
    expect((await freq())?.status).toBe('open');
  });

  it('builds again after a ticket is written outside the board routes', async () => {
    await boardOf();
    await breakdown();
    await boardOf();
    expect(boardsBuilt()).toBe(2);
  });
});
