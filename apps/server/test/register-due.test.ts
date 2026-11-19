import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { PgBoss } from 'pg-boss';
import { withTenant } from '../src/kernel/index.js';
import {
  insertAssetRegister,
  type AssetRegisterInput,
  type AssetRegisterRow,
} from '../src/modules/plant/index.js';
import { runRegisterDue, startRegisterJobs } from '../src/modules/notifications/index.js';
import { startTestDb, type TestDb } from './harness.js';

/**
 * The `register.due` notice (ticket 51b, R8–R11): `due_on ?? ends_on`, inclusive at `watchOn − lead_days`, no upper
 * bound, one message per item per date to the active owner. The fake clock is 11:30 IST, so the plant's own day is
 * the date in the constant.
 */

const A = '5b000000-0000-4000-8000-00000000000a';
const B = '5b000000-0000-4000-8000-00000000000b';
const OWNER = '5b000000-0000-4000-8000-0000000000a1';
const NEW_OWNER = '5b000000-0000-4000-8000-0000000000a2';
const RETIRED = '5b000000-0000-4000-8000-0000000000a3';
const OTHER_OWNER = '5b000000-0000-4000-8000-0000000000b1';
const DAY = 86_400_000;
/** 11:30 in the plant's own time zone (Asia/Kolkata), the hour the plan's acceptance names. */
const at = (day: string): Date => new Date(`${day}T06:00:00Z`);

let db: TestDb;

async function addRow(input: AssetRegisterInput, tenantId = A): Promise<AssetRegisterRow> {
  return withTenant(db.app, tenantId, (tx) => insertAssetRegister(tx, tenantId, input));
}

const run = (now: Date, tenantId?: string) =>
  runRegisterDue({
    pool: db.app,
    boss: null,
    now,
    allowFakeClock: true,
    ...(tenantId ? { tenantId } : {}),
  });

async function notices(tenantId = A) {
  return (
    await db.admin.query(
      `SELECT dedupe_key, kind, person_id, channel, ticket_id, event_id
         FROM notification WHERE tenant_id = $1 ORDER BY dedupe_key`,
      [tenantId],
    )
  ).rows as Array<{
    dedupe_key: string;
    kind: string;
    person_id: string;
    channel: string;
    ticket_id: string | null;
    event_id: string | null;
  }>;
}

const keys = async (tenantId = A): Promise<string[]> =>
  (await notices(tenantId)).map((row) => row.dedupe_key);

beforeAll(async () => {
  db = await startTestDb();
  await db.admin.query(
    `INSERT INTO tenant (id, slug, name) VALUES ($1, 'register-a', 'Register A'),
       ($2, 'register-b', 'Register B')`,
    [A, B],
  );
  await db.admin.query(
    `INSERT INTO person (id, tenant_id, name, active) VALUES
       ($1, $4, 'Asha Register', true), ($2, $4, 'Bina Register', true),
       ($3, $4, 'Retired Register', false)`,
    [OWNER, NEW_OWNER, RETIRED, A],
  );
  await db.admin.query(
    "INSERT INTO person (id, tenant_id, name) VALUES ($1, $2, 'Other Register')",
    [OTHER_OWNER, B],
  );
}, 180_000);

beforeEach(async () => {
  await db.admin.query('DELETE FROM notification');
  await db.admin.query('DELETE FROM asset_register');
});

afterAll(() => db.stop());

describe('the register due notice', () => {
  it('is silent the day before the window and sends one on its first day', async () => {
    const row = await addRow({
      kind: 'amc',
      endsOn: '2026-12-01',
      leadDays: 15,
      ownerPersonId: OWNER,
      vendor: 'V-1',
      notes: 'AMC (Comprehensive)',
    });

    expect(await run(at('2026-11-15'), A)).toEqual({ tenants: 1, notified: 0 });
    expect(await notices()).toEqual([]);

    // The window opens inclusive on `watchOn − lead_days`: 2026-12-01 − 15 = 2026-11-16.
    expect(await run(at('2026-11-16'), A)).toEqual({ tenants: 1, notified: 1 });
    expect(await notices()).toEqual([
      {
        dedupe_key: `register:${row.id}:2026-12-01:${OWNER}:push`,
        kind: 'register.due',
        person_id: OWNER,
        channel: 'push',
        ticket_id: null,
        event_id: null,
      },
    ]);
    // Ids only: the note and the vendor never reach the row.
    const stored = JSON.stringify(await notices());
    expect(stored).not.toMatch(/AMC \(Comprehensive\)|V-1/);

    // A second run the same day is silent: `notify`'s stored key already names this person and channel.
    expect(await run(at('2026-11-16'), A)).toEqual({ tenants: 1, notified: 0 });
    expect(await notices()).toHaveLength(1);
  });

  it('prefers due_on over ends_on, and a lead of 0 opens on the day itself', async () => {
    await addRow({
      kind: 'legal',
      startsOn: '2025-01-01',
      endsOn: '2025-01-01',
      dueOn: '2026-12-01',
      leadDays: 0,
      ownerPersonId: OWNER,
    });

    expect(await run(at('2026-11-30'), A)).toEqual({ tenants: 1, notified: 0 });
    expect(await run(at('2026-12-01'), A)).toEqual({ tenants: 1, notified: 1 });
    expect(await keys()).toHaveLength(1);
    expect((await keys())[0]).toMatch(/:2026-12-01:/);
  });

  it('warns an overdue item once on the first run after its window opened, never in a stream', async () => {
    const row = await addRow({
      kind: 'legal',
      dueOn: '2026-12-01',
      leadDays: 10,
      ownerPersonId: OWNER,
    });

    // The window opened on 2026-11-21; the job was down until 2026-12-02.
    expect(await run(at('2026-12-02'), A)).toEqual({ tenants: 1, notified: 1 });
    expect(await keys()).toEqual([`register:${row.id}:2026-12-01:${OWNER}:push`]);
    expect(await run(at('2026-12-02'), A)).toEqual({ tenants: 1, notified: 0 });
    expect(await keys()).toHaveLength(1);
  });

  it('treats a moved date as a new window and repeats no old key', async () => {
    const row = await addRow({
      kind: 'amc',
      endsOn: '2026-12-01',
      leadDays: 15,
      ownerPersonId: OWNER,
    });
    expect((await run(at('2026-11-16'), A)).notified).toBe(1);

    await db.admin.query('UPDATE asset_register SET due_on = $2 WHERE id = $1', [
      row.id,
      '2027-12-01',
    ]);
    expect(await run(at('2027-11-16'), A)).toEqual({ tenants: 1, notified: 1 });
    expect(await keys()).toEqual([
      `register:${row.id}:2026-12-01:${OWNER}:push`,
      `register:${row.id}:2027-12-01:${OWNER}:push`,
    ]);
    expect(await run(at('2027-11-16'), A)).toEqual({ tenants: 1, notified: 0 });
    expect(await keys()).toHaveLength(2);
  });

  it('tells a new owner once for the same date, and does not tell the old one again', async () => {
    const row = await addRow({
      kind: 'amc',
      dueOn: '2026-12-01',
      leadDays: 15,
      ownerPersonId: OWNER,
    });
    expect((await run(at('2026-11-16'), A)).notified).toBe(1);

    await db.admin.query('UPDATE asset_register SET owner_person_id = $2 WHERE id = $1', [
      row.id,
      NEW_OWNER,
    ]);
    expect(await run(at('2026-11-16'), A)).toEqual({ tenants: 1, notified: 1 });
    expect(await keys()).toEqual([
      `register:${row.id}:2026-12-01:${OWNER}:push`,
      `register:${row.id}:2026-12-01:${NEW_OWNER}:push`,
    ]);
    expect(await run(at('2026-11-16'), A)).toEqual({ tenants: 1, notified: 0 });
    expect(await keys()).toHaveLength(2);
  });

  it('cannot re-key a row that was removed, and the earlier message stays', async () => {
    const row = await addRow({
      kind: 'legal',
      dueOn: '2026-12-01',
      leadDays: 15,
      ownerPersonId: OWNER,
    });
    expect((await run(at('2026-11-16'), A)).notified).toBe(1);

    await db.admin.query('DELETE FROM asset_register WHERE id = $1', [row.id]);
    expect(await run(at('2026-12-02'), A)).toEqual({ tenants: 1, notified: 0 });
    expect(await keys()).toEqual([`register:${row.id}:2026-12-01:${OWNER}:push`]);
  });

  it('sends nothing for no owner, an inactive owner, or a row with only a start date', async () => {
    await addRow({ kind: 'amc', dueOn: '2026-12-01', leadDays: 15, ownerPersonId: null });
    await addRow({ kind: 'warranty', dueOn: '2026-12-01', leadDays: 15, ownerPersonId: RETIRED });
    await addRow({ kind: 'amc', startsOn: '2026-01-01', leadDays: 15, ownerPersonId: OWNER });

    expect(await run(at('2026-11-16'), A)).toEqual({ tenants: 1, notified: 0 });
    expect(await notices()).toEqual([]);
  });

  it('tells only the named plant’s owner, and the fan-out run tells each plant once', async () => {
    const mine = await addRow({
      kind: 'amc',
      dueOn: '2026-12-01',
      leadDays: 15,
      ownerPersonId: OWNER,
    });
    const theirs = await addRow(
      { kind: 'amc', dueOn: '2026-12-01', leadDays: 15, ownerPersonId: OTHER_OWNER },
      B,
    );

    expect(await run(at('2026-11-16'), A)).toEqual({ tenants: 1, notified: 1 });
    expect(await keys(A)).toEqual([`register:${mine.id}:2026-12-01:${OWNER}:push`]);
    expect(await notices(B)).toEqual([]);

    const all = await run(at('2026-11-16'));
    expect(all.tenants).toBeGreaterThanOrEqual(2);
    expect(all.notified).toBe(1);
    expect(await keys(B)).toEqual([`register:${theirs.id}:2026-12-01:${OTHER_OWNER}:push`]);
  });

  it('refuses a clock more than 24 hours from the database before writing', async () => {
    await addRow({ kind: 'amc', dueOn: '2026-12-01', leadDays: 15, ownerPersonId: OWNER });
    const wrong = new Date(Date.now() + 5 * DAY);
    await expect(
      runRegisterDue({ pool: db.app, boss: null, now: wrong, tenantId: A }),
    ).rejects.toThrow(/more than 24 hours/);
    expect(await notices()).toEqual([]);
  });

  it('registers a daily 00:15 UTC queue and a worker only for the roles that run jobs', async () => {
    interface Calls {
      queue: string[];
      work: string[];
      schedule: Array<[string, string, unknown]>;
    }
    const fake = () => {
      const calls: Calls = { queue: [], work: [], schedule: [] };
      const boss = {
        getQueue: async () => null,
        createQueue: async (name: string) => {
          calls.queue.push(name);
        },
        work: async (name: string) => {
          calls.work.push(name);
        },
        schedule: async (name: string, cron: string, _data: unknown, options: unknown) => {
          calls.schedule.push([name, cron, options]);
        },
      } as unknown as PgBoss;
      return { boss, calls };
    };

    const api = fake();
    await startRegisterJobs(api.boss, { pool: db.app }, 'api');
    expect(api.calls).toEqual({ queue: ['register.due'], work: [], schedule: [] });

    const worker = fake();
    await startRegisterJobs(worker.boss, { pool: db.app }, 'worker');
    expect(worker.calls.queue).toEqual(['register.due']);
    expect(worker.calls.work).toEqual(['register.due']);
    expect(worker.calls.schedule).toEqual([['register.due', '15 0 * * *', { tz: 'UTC' }]]);
  });
});
