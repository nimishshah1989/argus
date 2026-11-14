import { hash } from '@node-rs/argon2';
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

const TENANT = '35000000-0000-4000-8000-00000000000a';
const id = (n: number) => `35000000-0000-4000-8000-0000000002${n.toString(16).padStart(2, '0')}`;
const [REPORTER, LEAD, HEAD, PLANT_HEAD] = [id(1), id(2), id(3), id(4)];
const PASSWORD = 'correct-horse-battery';
const HOST = 'reopen-a.localhost';
const MIN = 60_000;

type App = Awaited<ReturnType<typeof buildApp>>;
let db: TestDb;
let admin: Pool;
let app: App;
let boss: PgBoss;
let keys = 0;
const tokens: Record<string, string> = {};
const freeMachines: string[] = [];

interface Req {
  method: 'GET' | 'POST' | 'PUT';
  url: string;
  token: string;
  payload?: object;
  key?: string;
}

function request({ method, url, token, payload, key }: Req) {
  keys += 1;
  return app.inject({
    method,
    url,
    headers: {
      host: HOST,
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      'idempotency-key': key ?? `reopen-${keys}`,
    },
    ...(payload ? { payload } : {}),
  });
}

const send = (method: Req['method'], url: string, token: string, payload?: object) =>
  request({ method, url, token, payload });

beforeAll(async () => {
  db = await startTestDb();
  admin = db.admin;
  const passwordHash = await hash(PASSWORD, {
    algorithm: 2,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
  await admin.query("INSERT INTO tenant (id, slug, name) VALUES ($1, 'reopen-a', 'Reopen A')", [
    TENANT,
  ]);
  const machines = Array.from(
    { length: 12 },
    (_, i) => `35000000-0000-4000-8000-0000000003${i.toString(16).padStart(2, '0')}`,
  );
  for (const [i, machine] of machines.entries()) {
    await admin.query(
      "INSERT INTO machine (id, tenant_id, code, criticality, cell) VALUES ($1, $2, $3, 'A', 'C1')",
      [machine, TENANT, `VC-RO-${i}`],
    );
  }
  freeMachines.push(...machines);
  await admin.query(
    `INSERT INTO person (id, tenant_id, name, team, kind) VALUES
      ($2, $1, 'Rina', 'production', 'production'), ($3, $1, 'Lal', 'maintenance', 'staff'),
      ($4, $1, 'Hema', 'maintenance', 'staff'), ($5, $1, 'Pravin', 'maintenance', 'staff')`,
    [TENANT, REPORTER, LEAD, HEAD, PLANT_HEAD],
  );
  await admin.query(
    `INSERT INTO login (tenant_id, person_id, username, password_hash, role, shared) VALUES
      ($1, $2, 'rina', $6, 'operator', false), ($1, $3, 'lal', $6, 'technician', false),
      ($1, $4, 'hema', $6, 'head', false), ($1, $5, 'pravin', $6, 'plant_head', false)`,
    [TENANT, REPORTER, LEAD, HEAD, PLANT_HEAD, passwordHash],
  );
  await admin.query(
    "INSERT INTO ref_counter (tenant_id, prefix, next_value) VALUES ($1, 'BD', 1)",
    [TENANT],
  );
  await admin.query(
    `INSERT INTO sla_policy (tenant_id, severity, ack_minutes, restore_minutes, handback_minutes) VALUES
      ($1, 'S1', 600, 2400, 600), ($1, 'S2', 900, 3600, 600), ($1, 'S3', 1200, 4800, 600), ($1, 'S4', 1800, 7200, 600)`,
    [TENANT],
  );
  const config: AppConfig = { pool: db.app, logger: false, rateLimitMax: 100000 };
  app = await buildApp(config);
  boss = config.jobBoss!;
  for (const name of ['rina', 'lal', 'hema', 'pravin']) {
    const res = await send('POST', '/api/v1/auth/login', '', {
      username: name,
      password: PASSWORD,
    });
    expect(res.statusCode, name).toBe(200);
    tokens[name] = res.json().token as string;
  }
}, 120_000);

afterAll(async () => {
  await app.close();
  await db.stop();
});

const work = (ticketId: string, action: string, extra: object = {}) =>
  send('POST', `/api/v1/tickets/${ticketId}/${action}`, tokens.lal!, { personId: LEAD, ...extra });
const closeWithReport = (ticketId: string) =>
  work(ticketId, 'close', { kind: 'report', report: { correctiveAction: 'Fixed' } });
const dispute = (ticketId: string, key?: string) =>
  request({
    method: 'POST',
    url: `/api/v1/tickets/${ticketId}/handback`,
    token: tokens.rina!,
    payload: { personId: REPORTER, response: 'disputed', reason: 'Still stops' },
    key,
  });

/** A breakdown reported by Rina, worked by Lal, closed with a report (asks production) and disputed `times` times. */
async function reopened(times: number): Promise<string> {
  const raised = await send('POST', '/api/v1/tickets', tokens.rina!, {
    machineId: freeMachines.shift(),
    problem: 'Spindle stops',
  });
  expect(raised.statusCode, raised.body).toBe(201);
  const ticketId = raised.json().ticket.id as string;
  expect((await work(ticketId, 'start')).statusCode).toBe(200);
  for (let round = 0; round < times; round += 1) {
    expect((await closeWithReport(ticketId)).statusCode).toBe(200);
    expect((await dispute(ticketId)).statusCode).toBe(200);
  }
  return ticketId;
}

type Step = { trigger: string; level: string; attempt: number; toldPersonIds: string[] };
const steps = async (ticketId: string): Promise<Step[]> => {
  const reply = await send('GET', `/api/v1/tickets/${ticketId}`, tokens.hema!);
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

async function ruleSwitch(patch: object): Promise<void> {
  const list = await send('GET', '/api/v1/escalation-rules', tokens.hema!);
  const rule = (list.json().items as Array<{ id: string; trigger: string }>).find(
    (r) => r.trigger === 'reopened_twice',
  )!;
  const saved = await send('PUT', `/api/v1/escalation-rules/${rule.id}`, tokens.hema!, patch);
  expect(saved.statusCode, saved.body).toBe(200);
}

async function runDue(ticketId: string, at: Date): Promise<number> {
  const { rows } = await admin.query(
    "SELECT id, data FROM pgboss.job WHERE name = 'sla.escalate' AND state = 'created' AND data->>'ticketId' = $1",
    [ticketId],
  );
  let sent = 0;
  for (const job of rows as Array<{ id: string; data: EscalationJob }>) {
    if (job.data.trigger !== 'reopened_twice' || job.data.dueAt > at.getTime()) continue;
    await admin.query("UPDATE pgboss.job SET state = 'active' WHERE id = $1", [job.id]);
    if (await processEscalationJob(job.data, { pool: db.app, now: () => at, boss })) sent += 1;
    await admin.query("UPDATE pgboss.job SET state = 'completed' WHERE id = $1", [job.id]);
  }
  return sent;
}

describe('the reopened-twice rule, switched off as seeded', () => {
  it('tells nobody, however many times production sends the fix back', async () => {
    const ticketId = await reopened(3);
    expect(await steps(ticketId)).toEqual([]);
    expect(await notices(ticketId)).toEqual([]);
  });
});

describe('the reopened-twice rule, switched on', () => {
  it('the first dispute tells nobody; the second tells the head once, in the history', async () => {
    await ruleSwitch({ active: true });
    const ticketId = await reopened(1);
    expect(await steps(ticketId)).toEqual([]);

    expect((await closeWithReport(ticketId)).statusCode).toBe(200);
    expect((await dispute(ticketId)).statusCode).toBe(200);

    const [step, ...more] = await steps(ticketId);
    expect(more).toEqual([]);
    expect(step).toMatchObject({ trigger: 'reopened_twice', level: 'L3', attempt: 1 });
    expect(step!.toldPersonIds).toEqual([HEAD]);
    expect(await notices(ticketId)).toEqual([HEAD]);
  });

  it('a replayed dispute does not start a second chain', async () => {
    const ticketId = await reopened(1);
    expect((await closeWithReport(ticketId)).statusCode).toBe(200);
    const first = await dispute(ticketId, 'same-dispute');
    const replay = await dispute(ticketId, 'same-dispute');
    expect(replay.statusCode).toBe(200);
    expect(replay.json()).toEqual(first.json());
    expect(await steps(ticketId)).toHaveLength(1);
    expect(await notices(ticketId)).toEqual([HEAD]);
  });

  it('a third dispute is a new chain of its own', async () => {
    const ticketId = await reopened(3);
    expect((await steps(ticketId)).map((s) => s.attempt)).toEqual([1, 1]);
    expect(await notices(ticketId)).toEqual([HEAD, HEAD]);
  });

  it('a confirmed sign-off tells nobody', async () => {
    const ticketId = await reopened(1);
    expect((await closeWithReport(ticketId)).statusCode).toBe(200);
    const confirmed = await send('POST', `/api/v1/tickets/${ticketId}/handback`, tokens.rina!, {
      personId: REPORTER,
      response: 'confirmed',
    });
    expect(confirmed.statusCode).toBe(200);
    expect(await steps(ticketId)).toEqual([]);
  });

  it('a repeat is sent while the ticket is still open, and stops when it is closed', async () => {
    await ruleSwitch({ repeatMinutes: '30', repeatCap: '2' });
    const ticketId = await reopened(2);
    const [queued] = (
      await admin.query(
        "SELECT data FROM pgboss.job WHERE name = 'sla.escalate' AND state = 'created' AND data->>'ticketId' = $1",
        [ticketId],
      )
    ).rows as Array<{ data: EscalationJob }>;
    expect(queued!.data.trigger).toBe('reopened_twice');
    const later = new Date(queued!.data.dueAt + 1);
    expect(await runDue(ticketId, later)).toBe(1);
    expect((await steps(ticketId)).map((s) => s.attempt)).toEqual([1, 2]);

    expect((await closeWithReport(ticketId)).statusCode).toBe(200);
    expect(await runDue(ticketId, new Date(later.getTime() + 31 * MIN))).toBe(0);
    expect(await steps(ticketId)).toHaveLength(2);
  });

  it('a repeat stops when the rule is switched off', async () => {
    const ticketId = await reopened(2);
    expect(await steps(ticketId)).toHaveLength(1);
    await ruleSwitch({ active: false });
    expect(await runDue(ticketId, new Date(Date.now() + 60 * MIN))).toBe(0);
    expect(await steps(ticketId)).toHaveLength(1);
    await ruleSwitch({ active: true });
  });

  it('the head can acknowledge it, which stops the repeats', async () => {
    const ticketId = await reopened(2);
    const ack = await send(
      'POST',
      `/api/v1/tickets/${ticketId}/acknowledge-escalation`,
      tokens.hema!,
      {
        personId: HEAD,
      },
    );
    expect(ack.statusCode, ack.body).toBe(200);
    expect(await runDue(ticketId, new Date(Date.now() + 60 * MIN))).toBe(0);
    expect(await steps(ticketId)).toHaveLength(1);
  });
});
