import type { Pool } from 'pg';
import type { PgBoss } from 'pg-boss';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import type { AppConfig } from '../src/kernel/index.js';
import {
  processEscalationJob,
  type EscalationJob,
} from '../src/modules/accountability/escalation.js';
import { startTestDb, type TestDb } from './harness.js';
import { seedPlant, type Plant } from './reopened-plant.js';

const MIN = 60_000;

type App = Awaited<ReturnType<typeof buildApp>>;
let db: TestDb;
let admin: Pool;
let app: App;
let boss: PgBoss;
let A: Plant;
let NO_POLICY: Plant;
let OTHER: Plant;

beforeAll(async () => {
  db = await startTestDb();
  admin = db.admin;
  const config: AppConfig = { pool: db.app, logger: false, rateLimitMax: 100000 };
  app = await buildApp(config);
  boss = config.jobBoss!;
  A = await seedPlant({ app, admin }, 'reopen-a', { policies: true });
  NO_POLICY = await seedPlant({ app, admin }, 'reopen-n', { policies: false });
  OTHER = await seedPlant({ app, admin }, 'reopen-o', { policies: true });
}, 180_000);

afterAll(async () => {
  await app.close();
  await db.stop();
});

const work = (plant: Plant, ticketId: string, action: string, extra: object = {}) =>
  plant.as('lal', 'POST', `/api/v1/tickets/${ticketId}/${action}`, {
    payload: { personId: plant.people.lal, ...extra },
  });
const closeWithReport = (plant: Plant, ticketId: string) =>
  work(plant, ticketId, 'close', {
    kind: 'report',
    report: { correctiveAction: 'Fixed', failureComponent: 'E' },
  });
const dispute = (plant: Plant, ticketId: string, key?: string) =>
  plant.as('rina', 'POST', `/api/v1/tickets/${ticketId}/handback`, {
    payload: { personId: plant.people.rina, response: 'disputed', reason: 'Still stops' },
    key,
  });

/** A breakdown reported by Rina, worked by Lal, closed with a report (asks production) and disputed `times` times. */
async function reopened(plant: Plant, times: number): Promise<string> {
  const raised = await plant.as('rina', 'POST', '/api/v1/tickets', {
    payload: { machineId: plant.machines.shift(), problem: 'Spindle stops' },
  });
  expect(raised.statusCode, raised.body).toBe(201);
  const ticketId = raised.json().ticket.id as string;
  expect((await work(plant, ticketId, 'start')).statusCode).toBe(200);
  for (let round = 0; round < times; round += 1) {
    expect((await closeWithReport(plant, ticketId)).statusCode).toBe(200);
    expect((await dispute(plant, ticketId)).statusCode).toBe(200);
  }
  return ticketId;
}

type Step = { trigger: string; level: string; attempt: number; toldPersonIds: string[] };
const steps = async (plant: Plant, ticketId: string): Promise<Step[]> => {
  const reply = await plant.as('hema', 'GET', `/api/v1/tickets/${ticketId}`);
  return (reply.json().events as Array<{ type: string; escalation: Step | null }>)
    .filter((event) => event.type === 'escalate')
    .map((event) => event.escalation!);
};
const notices = async (ticketId: string) =>
  (
    await admin.query(
      "SELECT person_id FROM notification WHERE ticket_id = $1 AND kind = 'escalation.step'",
      [ticketId],
    )
  ).rows.map((row) => row.person_id as string);

/** The plant's reopened-twice rule, set to exactly this (each test states its own; none relies on another's). */
async function setRule(
  plant: Plant,
  rule: { on: boolean; delay?: string; repeat?: [string, string] },
) {
  const list = await plant.as('hema', 'GET', '/api/v1/escalation-rules');
  const found = (list.json().items as Array<{ id: string; trigger: string }>).find(
    (r) => r.trigger === 'reopened_twice',
  );
  expect(found, 'the plant has a reopened-twice rule').toBeDefined();
  const saved = await plant.as('hema', 'PUT', `/api/v1/escalation-rules/${found!.id}`, {
    payload: {
      active: rule.on,
      delayMinutes: rule.delay ?? '0',
      repeatMinutes: rule.repeat?.[0] ?? '',
      repeatCap: rule.repeat?.[1] ?? '',
    },
  });
  expect(saved.statusCode, saved.body).toBe(200);
}

const queued = async (ticketId: string) =>
  (
    (
      await admin.query(
        "SELECT id, data FROM pgboss.job WHERE name = 'sla.escalate' AND state = 'created' AND data->>'ticketId' = $1",
        [ticketId],
      )
    ).rows as Array<{ id: string; data: EscalationJob }>
  ).filter((job) => job.data.trigger === 'reopened_twice');

/** Runs what is due by `at`, as the worker would; how many steps went out. */
async function runDue(ticketId: string, at: Date): Promise<number> {
  let sent = 0;
  for (const job of await queued(ticketId)) {
    if (job.data.dueAt > at.getTime()) continue;
    await admin.query("UPDATE pgboss.job SET state = 'active' WHERE id = $1", [job.id]);
    if (await processEscalationJob(job.data, { pool: db.app, now: () => at, boss })) sent += 1;
    await admin.query("UPDATE pgboss.job SET state = 'completed' WHERE id = $1", [job.id]);
  }
  return sent;
}

const HEAD = () => A.people.hema;

describe('the reopened-twice rule, switched off as seeded', () => {
  it('tells nobody, however many times production sends the fix back', async () => {
    const ticketId = await reopened(A, 3);
    expect(await steps(A, ticketId)).toEqual([]);
    expect(await notices(ticketId)).toEqual([]);
    expect(await queued(ticketId)).toEqual([]);
  });
});

describe('the reopened-twice rule, switched on', () => {
  it('the first dispute tells nobody; the second tells the head once, in the history', async () => {
    await setRule(A, { on: true });
    const ticketId = await reopened(A, 1);
    expect(await steps(A, ticketId)).toEqual([]);

    expect((await closeWithReport(A, ticketId)).statusCode).toBe(200);
    expect((await dispute(A, ticketId)).statusCode).toBe(200);

    const [step, ...more] = await steps(A, ticketId);
    expect(more).toEqual([]);
    expect(step).toMatchObject({ trigger: 'reopened_twice', level: 'L3', attempt: 1 });
    expect(step!.toldPersonIds).toEqual([HEAD()]);
    expect(await notices(ticketId)).toEqual([HEAD()]);
  });

  it('a replayed dispute does not start a second chain', async () => {
    await setRule(A, { on: true });
    const ticketId = await reopened(A, 1);
    expect((await closeWithReport(A, ticketId)).statusCode).toBe(200);
    const first = await dispute(A, ticketId, 'same-dispute');
    const replay = await dispute(A, ticketId, 'same-dispute');
    expect(replay.statusCode).toBe(200);
    expect(replay.json()).toEqual(first.json());
    expect(await steps(A, ticketId)).toHaveLength(1);
    expect(await notices(ticketId)).toEqual([HEAD()]);
  });

  it('a third dispute is a new chain of its own', async () => {
    await setRule(A, { on: true });
    const ticketId = await reopened(A, 3);
    expect((await steps(A, ticketId)).map((s) => s.attempt)).toEqual([1, 1]);
    expect(await notices(ticketId)).toEqual([HEAD(), HEAD()]);
  });

  it('a confirmed sign-off tells nobody', async () => {
    await setRule(A, { on: true });
    const ticketId = await reopened(A, 1);
    expect((await closeWithReport(A, ticketId)).statusCode).toBe(200);
    const confirmed = await A.as('rina', 'POST', `/api/v1/tickets/${ticketId}/handback`, {
      payload: { personId: A.people.rina, response: 'confirmed' },
    });
    expect(confirmed.statusCode).toBe(200);
    expect(await steps(A, ticketId)).toEqual([]);
  });
});

describe('repeats and stops', () => {
  const REPEAT: [string, string] = ['30', '2'];

  it('a repeat is sent while the ticket is still open, and stops when it is closed', async () => {
    await setRule(A, { on: true, repeat: REPEAT });
    const ticketId = await reopened(A, 2);
    const [next] = await queued(ticketId);
    expect(next, 'the repeat is queued').toBeDefined();
    const later = new Date(next!.data.dueAt + 1);
    expect(await runDue(ticketId, later)).toBe(1);
    expect((await steps(A, ticketId)).map((s) => s.attempt)).toEqual([1, 2]);

    expect((await closeWithReport(A, ticketId)).statusCode).toBe(200);
    expect(await queued(ticketId)).toHaveLength(1);
    expect(await runDue(ticketId, new Date(later.getTime() + 31 * MIN))).toBe(0);
    expect(await steps(A, ticketId)).toHaveLength(2);
  });

  it('cancelling the ticket stops the chain', async () => {
    await setRule(A, { on: true, repeat: REPEAT });
    const ticketId = await reopened(A, 2);
    expect(await queued(ticketId)).toHaveLength(1);
    expect((await work(A, ticketId, 'cancel', { reason: 'duplicate' })).statusCode).toBe(200);
    expect(await runDue(ticketId, new Date(Date.now() + 60 * MIN))).toBe(0);
    expect(await steps(A, ticketId)).toHaveLength(1);
  });

  it('a repeat stops when the rule is switched off', async () => {
    await setRule(A, { on: true, repeat: REPEAT });
    const ticketId = await reopened(A, 2);
    expect(await queued(ticketId)).toHaveLength(1);
    await setRule(A, { on: false, repeat: REPEAT });
    expect(await runDue(ticketId, new Date(Date.now() + 60 * MIN))).toBe(0);
    expect(await steps(A, ticketId)).toHaveLength(1);
  });

  it('the head can acknowledge it, which stops the repeats', async () => {
    await setRule(A, { on: true, repeat: REPEAT });
    const ticketId = await reopened(A, 2);
    expect(await queued(ticketId)).toHaveLength(1);
    const ack = await A.as('hema', 'POST', `/api/v1/tickets/${ticketId}/acknowledge-escalation`, {
      payload: { personId: A.people.hema },
    });
    expect(ack.statusCode, ack.body).toBe(200);
    expect(await runDue(ticketId, new Date(Date.now() + 60 * MIN))).toBe(0);
    expect(await steps(A, ticketId)).toHaveLength(1);
  });

  it('a technician cannot acknowledge the head-level chain', async () => {
    await setRule(A, { on: true, repeat: REPEAT });
    const ticketId = await reopened(A, 2);
    const ack = await A.as('lal', 'POST', `/api/v1/tickets/${ticketId}/acknowledge-escalation`, {
      payload: { personId: A.people.lal },
    });
    expect(ack.statusCode, ack.body).toBe(403);
    expect(await runDue(ticketId, new Date(Date.now() + 31 * MIN))).toBe(1);
    expect(await steps(A, ticketId)).toHaveLength(2);
  });
});

describe('a delay on the rule', () => {
  it('holds the first notice until the delay is over, and reads the rule as it is then', async () => {
    await setRule(A, { on: true, delay: '30' });
    const ticketId = await reopened(A, 2);
    expect(await steps(A, ticketId)).toEqual([]);
    const [waiting] = await queued(ticketId);
    expect(waiting, 'the first notice is queued').toBeDefined();
    const start = waiting!.data.episode;
    expect(waiting!.data.dueAt).toBe(start + 30 * MIN);

    expect(await runDue(ticketId, new Date(start + 29 * MIN))).toBe(0);
    await setRule(A, { on: true, delay: '60' });
    expect(await runDue(ticketId, new Date(start + 31 * MIN))).toBe(0);
    expect(await steps(A, ticketId)).toEqual([]);
    expect(await runDue(ticketId, new Date(start + 61 * MIN))).toBe(1);
    expect((await steps(A, ticketId)).map((s) => s.trigger)).toEqual(['reopened_twice']);
  });
});

describe('where it does not apply', () => {
  it('a plant with no SLA policies is not escalated, rule on or not', async () => {
    await setRule(NO_POLICY, { on: true });
    const ticketId = await reopened(NO_POLICY, 2);
    expect(await steps(NO_POLICY, ticketId)).toEqual([]);
    expect(await notices(ticketId)).toEqual([]);
    expect(await queued(ticketId)).toEqual([]);
  });

  it("another plant's rule is untouched: switched on in one plant, nothing is sent in the other", async () => {
    await setRule(A, { on: true });
    const ticketId = await reopened(OTHER, 2);
    expect(await steps(OTHER, ticketId)).toEqual([]);
    expect(await notices(ticketId)).toEqual([]);
    const own = await reopened(A, 2);
    expect(await steps(A, own)).toHaveLength(1);
    const told = (await notices(own)).sort();
    expect(told).toEqual([A.people.hema]);
    const rules = await OTHER.as('hema', 'GET', '/api/v1/escalation-rules');
    const reopenedRule = (rules.json().items as Array<{ trigger: string; active: boolean }>).find(
      (r) => r.trigger === 'reopened_twice',
    );
    expect(reopenedRule?.active).toBe(false);
  });
});
