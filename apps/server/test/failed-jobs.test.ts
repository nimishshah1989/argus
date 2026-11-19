import { PgBoss } from 'pg-boss';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { failedJobsReplySchema } from '@uptimo/shared/replies';
import { logFailures } from '../src/kernel/index.js';
import { LATE_AFTER_SECONDS, runJobWatch } from '../src/modules/accountability/index.js';
import { APP_API_PASSWORD } from './harness.js';
import { A, startPeopleApp, type PeopleApp } from './people-harness.js';

/**
 * MILESTONES 78a: a job that fails shows on the admin's failed-jobs list with its error, the retry command runs
 * it once and is audited, the failure raises the alarm line, and a timer more than two minutes late raises it too.
 */

const FAILING = 'plant.fail';
const LATE = 'plant.late';
const LIST = '/api/v1/jobs/failed';
const ERROR = 'planted failure: the spindle file is missing';

let t: PeopleApp;
let boss: PgBoss;
let admin: string;
let head: string;
let outsider: string;
let runs = 0;
let broken = true;
let lines: Record<string, unknown>[] = [];

/** The alarm lines the process wrote to its log, parsed. */
function alarms(): Record<string, unknown>[] {
  return lines.filter((line) => typeof line.alarm === 'string');
}

async function eventually<T>(read: () => Promise<T | undefined>, within = 60_000): Promise<T> {
  const until = Date.now() + within;
  for (;;) {
    const value = await read();
    if (value !== undefined) return value;
    if (Date.now() > until) throw new Error('did not happen in time');
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

interface Item {
  id: string;
  queue: string;
  error: string;
  failedAt: string;
}
async function listed(token = admin, send = t.call): Promise<Item[]> {
  const res = await send('GET', LIST, token);
  expect(res.statusCode, res.body).toBe(200);
  return (res.json() as { items: Item[] }).items;
}

beforeAll(async () => {
  vi.spyOn(process.stdout, 'write').mockImplementation(((chunk: string | Uint8Array) => {
    for (const text of String(chunk).split('\n')) {
      try {
        lines.push(JSON.parse(text) as Record<string, unknown>);
      } catch {
        // not a JSON log line
      }
    }
    return true;
  }) as typeof process.stdout.write);
  t = await startPeopleApp();
  admin = await t.signIn('admin');
  head = await t.signIn('head');
  outsider = await t.signIn('b-admin', 'plant-two.localhost');
  const { container } = t.db;
  boss = new PgBoss({
    connectionString: `postgresql://app_api:${APP_API_PASSWORD}@${container.getHost()}:${container.getPort()}/${container.getDatabase()}`,
    migrate: false,
    schedule: false,
    supervise: false,
    openTelemetry: { enabled: false },
  });
  await boss.start();
  await boss.createQueue(FAILING, { policy: 'standard', retryLimit: 0 });
  await boss.createQueue(LATE, { policy: 'standard', retryLimit: 0 });
  await boss.work(
    FAILING,
    { batchSize: 1, pollingIntervalSeconds: 1 },
    logFailures(FAILING, async () => {
      runs += 1;
      if (broken) throw new Error(ERROR);
    }),
  );
});

afterAll(async () => {
  vi.restoreAllMocks();
  await boss?.stop();
  await t?.stop();
});

describe('failed jobs are seen (API)', () => {
  it('lists a planted failing job with its error within 60 s, and raises the alarm line', async () => {
    await boss.send(FAILING, { tenantId: A });
    const item = await eventually(async () =>
      (await listed()).find((one) => one.queue === FAILING),
    );
    expect(item.error).toBe(ERROR);
    // The reply is pinned to the schema: both times are ISO date-times with an offset, not any string.
    const reply = (await t.call('GET', LIST, admin)).json();
    expect(failedJobsReplySchema.parse(reply).items.length).toBeGreaterThan(0);
    const [first] = (reply as { items: object[] }).items;
    expect(
      failedJobsReplySchema.safeParse({ items: [{ ...first, createdAt: 'yesterday' }] }).success,
    ).toBe(false);
    expect(
      failedJobsReplySchema.safeParse({ items: [{ ...first, failedAt: '19/11 10:30' }] }).success,
    ).toBe(false);
    expect(Date.parse(item.failedAt)).not.toBeNaN();
    const alarm = alarms().find((line) => line.alarm === 'job-failed' && line.job === FAILING);
    expect(alarm).toMatchObject({ level: 50, jobId: item.id, error: ERROR });
  });

  it('shows the list to the admin and the head only, and each plant only its own jobs', async () => {
    expect((await t.call('GET', LIST)).statusCode).toBe(401);
    expect(await listed(head)).toHaveLength(1);
    expect(await listed(outsider, t.callB)).toEqual([]);
    const id = (await listed())[0]!.id;
    expect((await t.callB('POST', `${LIST}/${id}/retry`, outsider, {})).statusCode).toBe(404);
    for (const role of ['operator', 'technician', 'supervisor', 'plant_head', 'board']) {
      const token = await t.signIn(role);
      expect((await t.call('GET', LIST, token)).statusCode, role).toBe(403);
      expect((await t.call('POST', `${LIST}/${id}/retry`, token, {})).statusCode, role).toBe(403);
    }
    expect(await listed()).toHaveLength(1);
  });

  it('retry runs the job once more, and the audit trail names the job retried', async () => {
    const before = runs;
    broken = false;
    const id = (await listed())[0]!.id;
    const res = await t.call('POST', `${LIST}/${id}/retry`, admin, {});
    expect(res.statusCode, res.body).toBe(200);
    await eventually(async () => (runs > before ? true : undefined));
    expect(await listed()).toEqual([]);
    await new Promise((resolve) => setTimeout(resolve, 2500));
    expect(runs).toBe(before + 1);
    expect((await t.call('POST', `${LIST}/${id}/retry`, admin, {})).statusCode).toBe(404);
    const trail = await t.db.admin.query(
      "SELECT entity_id FROM audit_log WHERE action = 'job.retry' AND tenant_id = $1",
      [A],
    );
    expect(trail.rows.map((row) => row.entity_id)).toEqual([id]);
  });

  it('lets the head retry too, and the audit trail names the head', async () => {
    broken = true;
    const id = (await boss.send(FAILING, { tenantId: A }))!;
    await eventually(async () =>
      (await listed(head)).some((job) => job.id === id) ? true : undefined,
    );
    broken = false;
    const before = runs;
    const res = await t.call('POST', `${LIST}/${id}/retry`, head, {});
    expect(res.statusCode, res.body).toBe(200);
    await eventually(async () => (runs > before ? true : undefined));
    expect(await listed(head)).toEqual([]);
    const trail = await t.db.admin.query(
      `SELECT l.username FROM audit_log a JOIN login l ON l.id = a.login_id WHERE a.action = 'job.retry' AND a.entity_id = $1`,
      [id],
    );
    expect(trail.rows.map((row) => row.username)).toEqual(['head']);
  });

  it('shows no plant a failed job that names no plant, and refuses to retry it', async () => {
    broken = true;
    const id = (await boss.send(FAILING, {}))!;
    await eventually(async () => {
      const row = await t.db.admin.query('SELECT state FROM pgboss.job WHERE id = $1', [id]);
      return row.rows[0]?.state === 'failed' ? true : undefined;
    });
    expect(await listed()).toEqual([]);
    expect(await listed(outsider, t.callB)).toEqual([]);
    expect((await t.call('POST', `${LIST}/${id}/retry`, admin, {})).statusCode).toBe(404);
    expect((await t.callB('POST', `${LIST}/${id}/retry`, outsider, {})).statusCode).toBe(404);
    broken = false;
  });

  it('answers 404, not 500, for an id that is not a job id', async () => {
    expect((await t.call('POST', `${LIST}/not-an-id/retry`, admin, {})).statusCode).toBe(404);
  });

  it('raises the alarm for a timer more than 2 minutes late, and not for one 1 minute late', async () => {
    const lateBy = (seconds: number) => new Date(Date.now() - seconds * 1000);
    await boss.send(LATE, { tenantId: A }, { startAfter: lateBy(LATE_AFTER_SECONDS + 30) });
    await boss.send(LATE, { tenantId: A }, { startAfter: lateBy(60) });
    lines = [];
    const found = await runJobWatch(t.db.app);
    expect(found).toEqual([expect.objectContaining({ queue: LATE, count: 1 })]);
    expect(alarms()).toEqual([
      expect.objectContaining({ level: 50, alarm: 'timer-late', job: LATE, count: 1 }),
    ]);
  });

  it('says nothing when no timer is late', async () => {
    await t.db.admin.query('DELETE FROM pgboss.job WHERE name = $1', [LATE]);
    lines = [];
    expect(await runJobWatch(t.db.app)).toEqual([]);
    expect(alarms()).toEqual([]);
  });
});
