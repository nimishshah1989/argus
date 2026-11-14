import { randomUUID } from 'node:crypto';
import { PgBoss } from 'pg-boss';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import webpush from 'web-push';
import { withTenant } from '../src/kernel/index.js';
import {
  notify,
  processNotification,
  startNotifyJobs,
  sweepNotifications,
  type SendJob,
  type NotifyInput,
} from '../src/modules/notifications/index.js';
import { runRetentionJob } from '../src/retention.js';
import { APP_API_PASSWORD, startTestDb, type TestDb } from './harness.js';

const A = '32000000-0000-4000-8000-00000000000a';
const B = '32000000-0000-4000-8000-00000000000b';
const ASHA = '32000000-0000-4000-8000-0000000000a1';
const BINA = '32000000-0000-4000-8000-0000000000a2';
const OTHER = '32000000-0000-4000-8000-0000000000b1';
const ASHA_PHONE = '+91 90000 00001';
const T0 = new Date('2026-03-01T10:00:00Z');
const DAY = 86_400_000;
const SAME_ENDPOINT = 'https://fcm.googleapis.com/fcm/send/shared-by-two-plants';
const ASHA_PHONE_ENDPOINT = 'https://fcm.googleapis.com/fcm/send/asha-phone';
const ASHA_TABLET_ENDPOINT = 'https://fcm.googleapis.com/fcm/send/asha-tablet';

let db: TestDb;
let boss: PgBoss;
let ticketId = '';
const send = vi.spyOn(webpush, 'sendNotification');

function expired(status: number, endpoint: string): Error {
  return new webpush.WebPushError('push service said no', status, {}, '', endpoint);
}

async function subscribe(
  tenantId: string,
  personId: string,
  loginId: string,
  endpoint: string,
): Promise<void> {
  await db.admin.query(
    `INSERT INTO push_subscription (tenant_id, login_id, acting_person_id, endpoint, keys, role)
     VALUES ($1, $2, $3, $4, '{"p256dh":"k","auth":"a"}', 'technician')`,
    [tenantId, loginId, personId, endpoint],
  );
}

async function resetSubscriptions(): Promise<void> {
  await db.admin.query('DELETE FROM push_subscription');
  await subscribe(A, ASHA, ids.loginAsha, ASHA_PHONE_ENDPOINT);
  await subscribe(B, OTHER, ids.loginOther, SAME_ENDPOINT);
}

const ids = { loginAsha: randomUUID(), loginBina: randomUUID(), loginOther: randomUUID() };

function toAsha(dedupeKey: string, extra: Partial<NotifyInput> = {}): NotifyInput {
  return {
    tenantId: A,
    to: [ASHA],
    kind: 'breakdown.new',
    dedupeKey,
    ticketId,
    now: T0,
    ...extra,
  };
}

async function tell(input: NotifyInput) {
  return withTenant(db.app, input.tenantId, (client) => notify(client, boss, input));
}

/** The notify.send jobs waiting for a row, taken off the queue the way a worker would. */
const taken: SendJob[] = [];
async function queuedFor(notificationId: string): Promise<SendJob[]> {
  const jobs = await boss.fetch<SendJob>('notify.send', { batchSize: 100 });
  taken.push(...jobs.map((j) => j.data));
  return taken.filter((d) => d.notificationId === notificationId);
}

const work = (tenantId: string, notificationId: string, now: Date) =>
  processNotification({ pool: db.app, boss, now }, { tenantId, notificationId });

async function row(id: string) {
  const found = await db.admin.query('SELECT * FROM notification WHERE id = $1', [id]);
  return found.rows[0] as {
    status: string;
    attempts: number;
    last_error: string | null;
    next_attempt_at: Date | null;
  };
}

const rowCount = async (tenantId: string): Promise<number> =>
  Number(
    (await db.admin.query('SELECT count(*) FROM notification WHERE tenant_id = $1', [tenantId]))
      .rows[0].count,
  );

beforeAll(async () => {
  const keys = webpush.generateVAPIDKeys();
  process.env.VAPID_PUBLIC_KEY = keys.publicKey;
  process.env.VAPID_PRIVATE_KEY = keys.privateKey;
  db = await startTestDb();
  for (const [id, slug] of [
    [A, 'alpha'],
    [B, 'bravo'],
  ] as const)
    await db.admin.query('INSERT INTO tenant (id, slug, name) VALUES ($1, $2, $2)', [id, slug]);
  await db.admin.query(
    `INSERT INTO person (id, tenant_id, name, phone) VALUES
       ($1, $4, 'Asha Testperson', $6), ($2, $4, 'Bina Testperson', '+91 90000 00002'),
       ($3, $5, 'Other Testperson', '+91 90000 00003')`,
    [ASHA, BINA, OTHER, A, B, ASHA_PHONE],
  );
  await db.admin.query(
    `INSERT INTO login (id, tenant_id, person_id, username, password_hash, role) VALUES
       ($1, $4, $5, 'asha', 'x', 'technician'), ($2, $4, $6, 'bina', 'x', 'technician'),
       ($3, $7, $8, 'other', 'x', 'technician')`,
    [ids.loginAsha, ids.loginBina, ids.loginOther, A, ASHA, BINA, B, OTHER],
  );
  ticketId = randomUUID();
  await db.admin.query(
    `INSERT INTO ticket (id, tenant_id, ref, kind, status, problem, reported_at, severity)
     VALUES ($1, $2, 'BD-NOTIFY', 'stopped', 'open', 'Notify test', $3, 'S1')`,
    [ticketId, A, T0],
  );
  const { container } = db;
  boss = new PgBoss({
    connectionString: `postgresql://app_api:${APP_API_PASSWORD}@${container.getHost()}:${container.getPort()}/${container.getDatabase()}`,
    migrate: false,
    schedule: false,
    supervise: false,
    openTelemetry: { enabled: false },
  });
  await boss.start();
  await startNotifyJobs(boss, { pool: db.app }, 'api');
}, 180_000);

afterEach(async () => {
  send.mockReset();
  send.mockResolvedValue({ statusCode: 201, body: '', headers: {} });
  await db.admin.query('DELETE FROM notification');
  await boss.deleteAllJobs('notify.send');
  taken.length = 0;
  await resetSubscriptions();
});

afterAll(async () => {
  await boss.stop();
  await db.stop();
});

describe('notify writes one row per recipient and channel', () => {
  it('records the same message once however often it is asked', async () => {
    const first = await tell(toAsha('breakdown:1'));
    const again = await tell(toAsha('breakdown:1'));
    expect(first.map((n) => n.created)).toEqual([true]);
    expect(again.map((n) => n.created)).toEqual([false]);
    expect(again[0]?.notificationId).toBe(first[0]?.notificationId);
    expect(await rowCount(A)).toBe(1);
  });

  it('gives each recipient and each channel its own row', async () => {
    const result = await tell(
      toAsha('breakdown:2', { to: [ASHA, BINA], channels: ['push', 'whatsapp'] }),
    );
    expect(result).toHaveLength(4);
    expect(new Set(result.map((n) => n.notificationId)).size).toBe(4);
    expect(await rowCount(A)).toBe(4);
    const replay = await tell(
      toAsha('breakdown:2', { to: [BINA, ASHA], channels: ['whatsapp', 'push'] }),
    );
    expect(replay.every((n) => !n.created)).toBe(true);
    expect(await rowCount(A)).toBe(4);
  });

  it('holds ids only: no name and no phone number', async () => {
    const [made] = await tell(toAsha('breakdown:3'));
    const stored = (
      await db.admin.query('SELECT * FROM notification WHERE id = $1', [made?.notificationId])
    ).rows[0];
    const text = JSON.stringify(stored);
    expect(text).toContain(ASHA);
    expect(text).toContain(ticketId);
    expect(text).not.toMatch(/Asha|Testperson|90000|BD-NOTIFY/);
  });

  it('refuses a key too long to be recorded, and a person of another plant', async () => {
    await expect(tell(toAsha('k'.repeat(200)))).rejects.toThrow(/too long/);
    await expect(tell(toAsha('breakdown:4', { to: [OTHER] }))).rejects.toThrow();
    expect(await rowCount(A)).toBe(0);
    expect(await rowCount(B)).toBe(0);
  });

  it('queues the first send with the row', async () => {
    const [made] = await tell(toAsha('breakdown:5'));
    expect(await queuedFor(made!.notificationId)).toEqual([
      { v: 1, tenantId: A, notificationId: made!.notificationId, attempt: 0 },
    ]);
  });

  it('records a person once however the id is spelled', async () => {
    await tell(toAsha('breakdown:6'));
    const again = await tell(toAsha('breakdown:6', { to: [ASHA.toUpperCase()] }));
    expect(again.map((n) => n.created)).toEqual([false]);
    expect(await rowCount(A)).toBe(1);
    await expect(tell(toAsha('breakdown:7', { to: ['not-a-person'] }))).rejects.toThrow(/person/);
  });
});

describe('notify.send', () => {
  it('delivers the new-breakdown push and marks the row sent', async () => {
    const [made] = await tell(toAsha('breakdown:10'));
    const result = await work(A, made!.notificationId, T0);
    expect(result).toEqual({ outcome: 'sent', delivered: 1 });
    expect((await row(made!.notificationId)).status).toBe('sent');
    expect(send).toHaveBeenCalledTimes(1);
    const [sub, body] = send.mock.calls[0] as unknown as [{ endpoint: string }, string];
    expect(sub.endpoint).toBe(ASHA_PHONE_ENDPOINT);
    expect(JSON.parse(body)).toEqual({
      title: 'UPTIMO',
      body: 'New breakdown',
      kind: 'breakdown.new',
      ticketId,
    });
  });

  it('delivers the complaint-fixed push', async () => {
    const [made] = await tell(toAsha('fixed:1', { kind: 'complaint.fixed' }));
    await work(A, made!.notificationId, T0);
    expect(JSON.parse(send.mock.calls[0]?.[1] as string)).toMatchObject({
      body: 'Complaint fixed',
      ticketId,
    });
  });

  it('is a no-op once the row is sent', async () => {
    const [made] = await tell(toAsha('breakdown:11'));
    await work(A, made!.notificationId, T0);
    expect(await work(A, made!.notificationId, T0)).toEqual({ outcome: 'skipped', delivered: 0 });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('retries with a growing wait, then marks the row dead with the provider code', async () => {
    send.mockRejectedValue(expired(503, ASHA_PHONE_ENDPOINT));
    const [made] = await tell(toAsha('breakdown:12'));
    const id = made!.notificationId;
    let now = T0;
    const waits: number[] = [];
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      expect((await work(A, id, now)).outcome).toBe('retry');
      const after = await row(id);
      expect(after.status).toBe('pending');
      expect(after.attempts).toBe(attempt);
      waits.push(after.next_attempt_at!.getTime() - now.getTime());
      now = after.next_attempt_at!;
    }
    expect(waits.every((w, i) => i === 0 || w > waits[i - 1]!)).toBe(true);
    expect(waits[0]).toBeGreaterThan(0);
    expect((await work(A, id, now)).outcome).toBe('dead');
    expect(await row(id)).toMatchObject({ status: 'dead', attempts: 5, last_error: '503' });
    expect(send).toHaveBeenCalledTimes(5);
    expect((await work(A, id, new Date(now.getTime() + DAY))).outcome).toBe('skipped');
    expect(send).toHaveBeenCalledTimes(5);
  });

  it('queues each retry, and does nothing early', async () => {
    send.mockRejectedValueOnce(expired(500, ASHA_PHONE_ENDPOINT));
    const [made] = await tell(toAsha('breakdown:13'));
    const id = made!.notificationId;
    await boss.deleteAllJobs('notify.send');
    await work(A, id, T0);
    const due = (await row(id)).next_attempt_at!;
    expect(await queuedFor(id)).toEqual([{ v: 1, tenantId: A, notificationId: id, attempt: 1 }]);
    send.mockClear();
    expect((await work(A, id, new Date(due.getTime() - 1))).outcome).toBe('skipped');
    expect(send).not.toHaveBeenCalled();
    expect((await work(A, id, due)).outcome).toBe('sent');
  });

  it('does not lose a row whose job wakes before the clock says it is due', async () => {
    send.mockRejectedValueOnce(expired(500, ASHA_PHONE_ENDPOINT));
    const [made] = await tell(toAsha('skew:1'));
    const id = made!.notificationId;
    await work(A, id, T0);
    const due = (await row(id)).next_attempt_at!;
    await boss.deleteAllJobs('notify.send');
    expect((await work(A, id, new Date(due.getTime() - 1000))).outcome).toBe('skipped');
    expect((await row(id)).status).toBe('pending');
    expect(await queuedFor(id)).toEqual([{ v: 1, tenantId: A, notificationId: id, attempt: 1 }]);
    expect((await work(A, id, due)).outcome).toBe('sent');
  });

  it('tries a push test once: a failure is dead at once and nothing is queued', async () => {
    send.mockRejectedValue(expired(503, ASHA_PHONE_ENDPOINT));
    const [made] = await tell(toAsha('test:1', { kind: 'push.test' }));
    await boss.deleteAllJobs('notify.send');
    expect((await work(A, made!.notificationId, T0)).outcome).toBe('dead');
    expect(await row(made!.notificationId)).toMatchObject({ status: 'dead', last_error: '503' });
    expect(await queuedFor(made!.notificationId)).toEqual([]);
  });

  it('deletes an expired subscription and records the code', async () => {
    for (const code of [404, 410]) {
      await resetSubscriptions();
      send.mockRejectedValue(expired(code, ASHA_PHONE_ENDPOINT));
      const [made] = await tell(toAsha(`gone:${code}`));
      expect((await work(A, made!.notificationId, T0)).outcome).toBe('dead');
      expect(await row(made!.notificationId)).toMatchObject({
        status: 'dead',
        last_error: String(code),
      });
      const left = await db.admin.query('SELECT 1 FROM push_subscription WHERE tenant_id = $1', [
        A,
      ]);
      expect(left.rowCount).toBe(0);
    }
  });

  it('is sent when one phone is gone and another gets it; only the gone one is deleted', async () => {
    await subscribe(A, ASHA, ids.loginAsha, ASHA_TABLET_ENDPOINT);
    send.mockImplementation(async (sub) => {
      if ((sub as { endpoint: string }).endpoint === ASHA_PHONE_ENDPOINT)
        throw expired(410, ASHA_PHONE_ENDPOINT);
      return { statusCode: 201, body: '', headers: {} };
    });
    const [made] = await tell(toAsha('gone:mixed'));
    expect(await work(A, made!.notificationId, T0)).toEqual({ outcome: 'sent', delivered: 1 });
    const left = await db.admin.query(
      'SELECT endpoint FROM push_subscription WHERE tenant_id = $1',
      [A],
    );
    expect(left.rows).toEqual([{ endpoint: ASHA_TABLET_ENDPOINT }]);
  });

  it('marks the row dead at once when the person has no phone registered, or no sender exists', async () => {
    const [bina] = await tell(toAsha('nophone:1', { to: [BINA] }));
    expect((await work(A, bina!.notificationId, T0)).outcome).toBe('dead');
    expect((await row(bina!.notificationId)).last_error).toBe('no_subscription');
    const [chat] = await tell(toAsha('chat:1', { channels: ['whatsapp'] }));
    expect((await work(A, chat!.notificationId, T0)).outcome).toBe('dead');
    expect((await row(chat!.notificationId)).last_error).toBe('no_sender');
    expect(send).not.toHaveBeenCalled();
  });

  it('never sends to an address that is not a real push service', async () => {
    await db.admin.query(
      `INSERT INTO push_subscription (tenant_id, login_id, acting_person_id, endpoint, keys, role)
       VALUES ($1, $2, $3, 'http://169.254.169.254/latest/meta-data/', '{"p256dh":"a","auth":"b"}', 'technician')`,
      [A, ids.loginAsha, ASHA],
    );
    const [made] = await tell(toAsha('internal:1'));
    await work(A, made!.notificationId, T0);
    expect(send.mock.calls.map(([sub]) => (sub as { endpoint: string }).endpoint)).toEqual([
      ASHA_PHONE_ENDPOINT,
    ]);
  });
});

describe('plants stay apart', () => {
  it('never reads or writes another plant: a job naming the wrong plant finds nothing', async () => {
    await db.admin.query(
      `INSERT INTO push_subscription (tenant_id, login_id, acting_person_id, endpoint, keys, role)
       VALUES ($1, $2, $3, 'https://fcm.googleapis.com/fcm/send/other-plant', '{"p256dh":"a","auth":"b"}', 'technician')`,
      [B, ids.loginOther, OTHER],
    );
    const [mine] = await tell(toAsha('tenancy:1'));
    expect(await work(B, mine!.notificationId, T0)).toEqual({ outcome: 'skipped', delivered: 0 });
    expect((await row(mine!.notificationId)).status).toBe('pending');
    expect(send).not.toHaveBeenCalled();
    await work(A, mine!.notificationId, T0);
    const sentTo = send.mock.calls.map(([sub]) => (sub as { endpoint: string }).endpoint);
    expect(sentTo).toEqual([ASHA_PHONE_ENDPOINT]);
  });

  it('deletes an expired address in its own plant only, even when both plants hold the same address', async () => {
    await subscribe(A, ASHA, ids.loginAsha, SAME_ENDPOINT);
    send.mockImplementation(async (sub) => {
      if ((sub as { endpoint: string }).endpoint === SAME_ENDPOINT)
        throw expired(410, SAME_ENDPOINT);
      return { statusCode: 201, body: '', headers: {} };
    });
    const [made] = await tell(toAsha('tenancy:2'));
    await work(A, made!.notificationId, T0);
    const left = await db.admin.query(
      'SELECT tenant_id, endpoint FROM push_subscription ORDER BY tenant_id',
    );
    expect(left.rows).toEqual([
      { tenant_id: A, endpoint: ASHA_PHONE_ENDPOINT },
      { tenant_id: B, endpoint: SAME_ENDPOINT },
    ]);
  });
});

describe('notification.purge keeps rows 90 days', () => {
  async function aged(
    who: { tenantId: string; personId: string },
    key: string,
    days: number,
    settle = true,
  ): Promise<void> {
    const { tenantId, personId } = who;
    const made = await tell({
      tenantId,
      to: [personId],
      kind: 'breakdown.new',
      dedupeKey: key,
      now: T0,
    });
    if (settle) await work(tenantId, made[0]!.notificationId, T0);
    await db.admin.query('UPDATE notification SET created_at = $2 WHERE id = $1', [
      made[0]?.notificationId,
      new Date(T0.getTime() - days * DAY),
    ]);
  }

  it('removes older rows and keeps younger ones, for the named plant only', async () => {
    await aged({ tenantId: A, personId: ASHA }, 'purge:old', 91);
    await aged({ tenantId: A, personId: ASHA }, 'purge:young', 89);
    await aged({ tenantId: B, personId: OTHER }, 'purge:other-plant-old', 120);
    const first = await runRetentionJob(db.app, 'notification.purge', {
      now: T0,
      tenantId: A,
      allowFakeClock: true,
    });
    expect(first.affected).toBe(1);
    expect(await rowCount(A)).toBe(1);
    expect(await rowCount(B)).toBe(1);
    const all = await runRetentionJob(db.app, 'notification.purge', {
      now: T0,
      allowFakeClock: true,
    });
    expect(all.affected).toBe(1);
    expect(await rowCount(A)).toBe(1);
    expect(await rowCount(B)).toBe(0);
    const again = await runRetentionJob(db.app, 'notification.purge', {
      now: T0,
      allowFakeClock: true,
    });
    expect(again.affected).toBe(0);
  });

  it('never deletes a message still waiting to be sent', async () => {
    await aged({ tenantId: A, personId: ASHA }, 'purge:waiting', 120, false);
    const result = await runRetentionJob(db.app, 'notification.purge', {
      now: T0,
      allowFakeClock: true,
    });
    expect(result.affected).toBe(0);
    expect(await rowCount(A)).toBe(1);
  });
});

describe('notify.sweep finds messages whose job was lost', () => {
  const MIN = 60_000;
  const HOUR = 60 * MIN;

  it('queues a pending row that is long overdue and has no job, and it is then sent', async () => {
    const [lost] = await tell(toAsha('sweep:1'));
    const [fresh] = await tell(toAsha('sweep:2'));
    await boss.deleteAllJobs('notify.send');
    await db.admin.query('UPDATE notification SET next_attempt_at = $2 WHERE id = $1', [
      fresh!.notificationId,
      new Date(T0.getTime() + 55 * MIN),
    ]);
    const swept = await sweepNotifications({
      pool: db.app,
      boss,
      now: new Date(T0.getTime() + HOUR),
    });
    expect(swept).toEqual({ requeued: 1, dead: 0 });
    expect(await queuedFor(fresh!.notificationId)).toEqual([]);
    expect(await queuedFor(lost!.notificationId)).toEqual([
      { v: 1, tenantId: A, notificationId: lost!.notificationId, attempt: 0 },
    ]);
    expect((await work(A, lost!.notificationId, new Date(T0.getTime() + HOUR))).outcome).toBe(
      'sent',
    );
  });

  it('gives up on a row overdue for over a week and shows it dead, never silently', async () => {
    const [stuck] = await tell(toAsha('sweep:3'));
    await boss.deleteAllJobs('notify.send');
    const swept = await sweepNotifications({
      pool: db.app,
      boss,
      now: new Date(T0.getTime() + 8 * DAY),
    });
    expect(swept).toEqual({ requeued: 0, dead: 1 });
    expect(await row(stuck!.notificationId)).toMatchObject({ status: 'dead', last_error: 'stuck' });
    expect(await queuedFor(stuck!.notificationId)).toEqual([]);
  });

  it('leaves another plant alone: its overdue row is swept under its own plant', async () => {
    await tell({ tenantId: B, to: [OTHER], kind: 'breakdown.new', dedupeKey: 'sweep:b', now: T0 });
    await boss.deleteAllJobs('notify.send');
    const swept = await sweepNotifications({
      pool: db.app,
      boss,
      now: new Date(T0.getTime() + HOUR),
    });
    expect(swept.requeued).toBe(1);
    const jobs = await boss.fetch<SendJob>('notify.send', { batchSize: 10 });
    expect(jobs.map((j) => j.data.tenantId)).toEqual([B]);
  });
});

describe('the worker', () => {
  it('picks up a queued notification and sends it', async () => {
    const workerBoss = new PgBoss({
      connectionString: `postgresql://app_api:${APP_API_PASSWORD}@${db.container.getHost()}:${db.container.getPort()}/${db.container.getDatabase()}`,
      migrate: false,
      schedule: false,
      supervise: false,
      openTelemetry: { enabled: false },
    });
    await workerBoss.start();
    try {
      await startNotifyJobs(workerBoss, { pool: db.app, pollingIntervalSeconds: 0.5 }, 'all');
      const [made] = await tell({ ...toAsha('worker:1'), now: new Date() });
      await vi.waitFor(async () => expect((await row(made!.notificationId)).status).toBe('sent'), {
        timeout: 15_000,
        interval: 250,
      });
      expect(send).toHaveBeenCalledTimes(1);
    } finally {
      await workerBoss.stop();
    }
  }, 30_000);
});
