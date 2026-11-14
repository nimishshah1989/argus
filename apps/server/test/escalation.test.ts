import { randomUUID } from 'node:crypto';
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
import { withTenant } from '@uptimo/db';
import { ensureEscalationDefaults } from '../src/modules/accountability/index.js';
import { reconcileTicket } from '../src/modules/accountability/sla.js';
import {
  processSlaTimerJob,
  rearmTicket,
  type SlaTimerPayload,
  type SlaTimerProjection,
} from '../src/modules/accountability/repo/timers.js';
import { startTestDb, type TestDb } from './harness.js';

const PASSWORD = 'correct-horse-battery';
const MIN = 60_000;
const plus = (from: Date, minutes: number) => new Date(from.getTime() + minutes * MIN);

type App = Awaited<ReturnType<typeof buildApp>>;
let db: TestDb;
let admin: Pool;
let app: App;
let boss: PgBoss;
let key = 0;

interface Plant {
  id: string;
  host: string;
  tokens: Record<string, string>;
  people: Record<string, string>;
  machines: string[];
}

const PEOPLE: Array<[name: string, role: string, active: boolean]> = [
  ['asha', 'technician', true],
  ['bina', 'technician', true],
  ['sunil', 'supervisor', true],
  ['sunil2', 'supervisor', true],
  ['gone', 'supervisor', false],
  ['hema', 'head', true],
  ['pravin', 'plant_head', true],
  ['omkar', 'operator', true],
  ['root', 'admin', true],
  ['boris', 'board', true],
  // on the roster but with no login of their own: nobody to push
  ['nologin', '', true],
];

function call(
  plant: Plant,
  method: 'GET' | 'POST' | 'PUT',
  url: string,
  ...who: [as: string, body?: object]
) {
  const [as, body] = who;
  key += 1;
  return app.inject({
    method,
    url,
    headers: {
      host: plant.host,
      'content-type': 'application/json',
      ...(as ? { authorization: `Bearer ${plant.tokens[as]}` } : {}),
      'idempotency-key': `esc-${key}`,
    },
    ...(body ? { payload: body } : {}),
  });
}

async function seedPlant(slug: string, n: number, withPolicies = true): Promise<Plant> {
  const id = `9${n}000000-0000-0000-0000-000000000001`;
  const plant: Plant = { id, host: `${slug}.localhost`, tokens: {}, people: {}, machines: [] };
  const passwordHash = await hash(PASSWORD, {
    algorithm: 2,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
  await admin.query('INSERT INTO tenant (id, slug, name) VALUES ($1, $2, $2)', [id, slug]);
  await admin.query(
    `INSERT INTO shift (tenant_id, code, name, starts_at, ends_at, crosses_midnight)
     VALUES ($1, '1', 'All day', '00:00', '00:00', true)`,
    [id],
  );
  for (const [name, role, active] of PEOPLE) {
    plant.people[name] = randomUUID();
    await admin.query(
      "INSERT INTO person (id, tenant_id, name, team, active) VALUES ($1, $2, $3, 'maintenance', $4)",
      [plant.people[name], id, name, active],
    );
    if (!role) continue;
    await admin.query(
      `INSERT INTO login (tenant_id, person_id, username, password_hash, role, shared)
       VALUES ($1, $2, $3, $4, $5, false)`,
      [id, plant.people[name], name, passwordHash, role],
    );
  }
  await admin.query(
    `INSERT INTO login (tenant_id, username, password_hash, role, shared) VALUES ($1, 'shared', $2, 'technician', true)`,
    [id, passwordHash],
  );
  await admin.query(
    "INSERT INTO ref_counter (tenant_id, prefix, next_value) VALUES ($1, 'BD', 1)",
    [id],
  );
  await admin.query(
    "INSERT INTO list_item (tenant_id, list, code, label, is_vendor, pauses_sla) VALUES ($1, 'wait_reason', 'spare', 'Spare', false, true)",
    [id],
  );
  if (withPolicies)
    await admin.query(
      `INSERT INTO sla_policy (tenant_id, severity, ack_minutes, restore_minutes, pause_max_minutes, handback_minutes) VALUES
      ($1, 'S1', 5, 30, 20, 10), ($1, 'S2', 90, 360, 20, 10), ($1, 'S3', 120, 480, 20, 10), ($1, 'S4', 180, 720, 20, 10)`,
      [id],
    );
  for (let i = 0; i < 44; i += 1) {
    const machine = randomUUID();
    plant.machines.push(machine);
    await admin.query(
      "INSERT INTO machine (id, tenant_id, code, criticality) VALUES ($1, $2, $3, 'A')",
      [machine, id, `VC-${i}`],
    );
  }
  for (const [name, role, active] of PEOPLE) {
    if (!active || !role) continue;
    const res = await call(plant, 'POST', '/api/v1/auth/login', '', {
      username: name,
      password: PASSWORD,
    });
    expect(res.statusCode, `login ${name}`).toBe(200);
    plant.tokens[name] = res.json().token as string;
  }
  const shared = await call(plant, 'POST', '/api/v1/auth/login', '', {
    username: 'shared',
    password: PASSWORD,
  });
  plant.tokens.shared = shared.json().token as string;
  return plant;
}

let A: Plant;
let B: Plant;
let E: Plant;
let N: Plant;
let R: Plant;
let P: Plant;

beforeAll(async () => {
  db = await startTestDb();
  admin = db.admin;
  const config: AppConfig = { pool: db.app, logger: false, rateLimitMax: 100000 };
  app = await buildApp(config);
  boss = config.jobBoss!;
  A = await seedPlant('esc-a', 1);
  B = await seedPlant('esc-b', 2);
  E = await seedPlant('esc-e', 3);
  N = await seedPlant('esc-n', 4, false);
  R = await seedPlant('esc-r', 5);
  P = await seedPlant('esc-p', 6);
}, 180_000);

afterAll(async () => {
  await app.close();
  await db.stop();
});

async function raise(plant: Plant): Promise<{ id: string; at: Date }> {
  const machineId = plant.machines.shift();
  const res = await call(plant, 'POST', '/api/v1/tickets', 'omkar', {
    machineId,
    problem: 'Spindle',
  });
  expect(res.statusCode, res.body).toBe(201);
  const id = res.json().ticket.id as string;
  const at = (await admin.query('SELECT reported_at FROM ticket WHERE id = $1', [id])).rows[0]
    .reported_at as Date;
  return { id, at };
}

const command = (plant: Plant, id: string, action: string, ...who: [as: string, body?: object]) =>
  call(plant, 'POST', `/api/v1/tickets/${id}/${action}`, who[0], {
    personId: plant.people[who[0]],
    ...who[1],
  });

/** The clock's job fires at `at`; the worker runs whatever it queued. */
async function breach(plant: Plant, id: string, kind: string, at: Date): Promise<boolean> {
  const timer = (
    await admin.query('SELECT revision FROM sla_timer WHERE ticket_id = $1 AND kind = $2', [
      id,
      kind,
    ])
  ).rows[0];
  const payload = { tenantId: plant.id, ticketId: id, kind, revision: timer.revision };
  return processSlaTimerJob(payload as never, { pool: db.app, now: () => at, boss });
}

async function queuedSteps(
  id: string,
  trigger?: string,
): Promise<Array<{ id: string; data: EscalationJob }>> {
  const { rows } = await admin.query(
    "SELECT id, data FROM pgboss.job WHERE name = 'sla.escalate' AND state = 'created' AND data->>'ticketId' = $1 ORDER BY created_on",
    [id],
  );
  return rows.filter((row) => !trigger || row.data.trigger === trigger);
}

/** Runs every queued step that is due by `at`, as the worker would; how many sent. */
async function runDue(plant: Plant, id: string, at: Date, trigger = 'ack_missed'): Promise<number> {
  let sent = 0;
  for (const job of await queuedSteps(id)) {
    if (job.data.trigger !== trigger || job.data.dueAt > at.getTime()) continue;
    // a worker has the job active while it runs: a requeue then makes a new job, as in production
    await admin.query("UPDATE pgboss.job SET state = 'active' WHERE id = $1", [job.id]);
    const ran = await processEscalationJob(job.data, { pool: db.app, now: () => at, boss });
    await admin.query("UPDATE pgboss.job SET state = 'completed' WHERE id = $1", [job.id]);
    if (ran) sent += 1;
  }
  return sent;
}

type Step = {
  ruleId: string;
  trigger: string;
  level: string;
  attempt: number;
  channel: string;
  channelFallback?: string;
  noLadder?: boolean;
  toldCount: number;
  toldPersonIds: string[] | null;
};
const plantOf = async (id: string): Promise<Plant> => {
  const tenant = (await admin.query('SELECT tenant_id FROM ticket WHERE id = $1', [id])).rows[0];
  return [A, B, E, N, R, P].find((plant) => plant.id === tenant.tenant_id)!;
};
/** The steps of a ticket as the history reply shows them (who was told is read by the server from the notifications). */
const steps = async (id: string, trigger?: string): Promise<Step[]> => {
  const reply = await call(await plantOf(id), 'GET', `/api/v1/tickets/${id}`, 'hema');
  expect(reply.statusCode, reply.body).toBe(200);
  return (reply.json().events as Array<{ type: string; escalation: Step | null }>)
    .filter((event) => event.type === 'escalate')
    .map((event) => event.escalation!)
    .filter((step) => !trigger || step.trigger === trigger);
};

const notices = async (id: string) =>
  (
    await admin.query(
      "SELECT person_id, channel, status FROM notification WHERE ticket_id = $1 AND kind = 'escalation.step' ORDER BY created_at, person_id",
      [id],
    )
  ).rows as Array<{ person_id: string; channel: string; status: string }>;

const told = (plant: Plant, ...names: string[]) => names.map((n) => plant.people[n]).sort();

const rosterLine = (plant: Plant, name: string, level: string) =>
  admin.query(
    `INSERT INTO roster_entry (tenant_id, date, shift_id, person_id, level)
     SELECT $1, (now() AT TIME ZONE 'Asia/Kolkata')::date, s.id, $2, $3 FROM shift s WHERE s.tenant_id = $1`,
    [plant.id, plant.people[name], level],
  );

describe('missed acknowledge', () => {
  it('a plant that never opened the ladder still escalates: supervisors told once, in the history', async () => {
    expect(
      (await admin.query('SELECT 1 FROM escalation_rule WHERE tenant_id = $1', [A.id])).rowCount,
    ).toBe(0);
    const { id, at } = await raise(A);
    expect(
      (await admin.query('SELECT 1 FROM escalation_rule WHERE tenant_id = $1', [A.id])).rowCount,
    ).toBe(6);

    expect(await breach(A, id, 'ack', plus(at, 6))).toBe(true);

    const [step, ...more] = await steps(id);
    expect(more).toEqual([]);
    expect(step).toMatchObject({ trigger: 'ack_missed', level: 'L2', attempt: 1, channel: 'push' });
    // supervisors with a personal login who are still on: not the inactive one, not the head
    expect([...step!.toldPersonIds!].sort()).toEqual(told(A, 'sunil', 'sunil2'));
    expect((await notices(id)).map((n) => n.person_id).sort()).toEqual(told(A, 'sunil', 'sunil2'));

    const detail = (await call(A, 'GET', `/api/v1/tickets/${id}`, 'sunil')).json();
    const event = detail.events.find((e: { type: string }) => e.type === 'escalate');
    expect(event.escalation).toMatchObject({ level: 'L2', attempt: 1, trigger: 'ack_missed' });
    expect([...event.escalation.toldPersonIds].sort()).toEqual(told(A, 'sunil', 'sunil2'));
    expect(event.actingPersonId).toBeNull();
  });

  it('repeats every 30 minutes, three times, then stops', async () => {
    const { id, at } = await raise(A);
    await breach(A, id, 'ack', plus(at, 6));
    expect(await runDue(A, id, plus(at, 20))).toBe(0);
    expect(await runDue(A, id, plus(at, 6 + 30))).toBe(1);
    expect(await runDue(A, id, plus(at, 6 + 60))).toBe(1);
    expect(await runDue(A, id, plus(at, 6 + 90))).toBe(1);
    expect(await queuedSteps(id, 'ack_missed')).toEqual([]);
    expect((await steps(id, 'ack_missed')).map((s) => s.attempt)).toEqual([1, 2, 3, 4]);
    expect(await runDue(A, id, plus(at, 6 + 600))).toBe(0);
    expect(await notices(id)).toHaveLength(8);
  });

  it('a step that wakes before its time does nothing and stays queued', async () => {
    const { id, at } = await raise(A);
    await breach(A, id, 'ack', plus(at, 6));
    const next = (await queuedSteps(id)).find((job) => job.data.trigger === 'ack_missed');
    const early = await processEscalationJob(next!.data, {
      pool: db.app,
      now: () => plus(at, 10),
      boss,
    });
    expect(early).toBe(false);
    expect(await steps(id)).toHaveLength(1);
    expect((await queuedSteps(id)).filter((job) => job.data.trigger === 'ack_missed')).toHaveLength(
      1,
    );
  });

  it('stops the moment someone starts the ticket', async () => {
    const { id, at } = await raise(A);
    await breach(A, id, 'ack', plus(at, 6));
    expect((await command(A, id, 'start', 'asha')).statusCode).toBe(200);
    expect(await runDue(A, id, plus(at, 60))).toBe(0);
    expect(await steps(id)).toHaveLength(1);
  });

  it('stops the moment the rostered person acknowledges', async () => {
    const { id, at } = await raise(A);
    await breach(A, id, 'ack', plus(at, 6));
    await admin.query(
      `INSERT INTO roster_entry (tenant_id, date, shift_id, person_id, level)
       SELECT $1, (now() AT TIME ZONE 'Asia/Kolkata')::date, s.id, $2, 'L1' FROM shift s WHERE s.tenant_id = $1
       ON CONFLICT DO NOTHING`,
      [A.id, A.people.bina],
    );
    expect((await command(A, id, 'acknowledge', 'bina')).statusCode).toBe(200);
    expect(await runDue(A, id, plus(at, 60))).toBe(0);
    expect(await steps(id)).toHaveLength(1);
    await admin.query('DELETE FROM roster_entry WHERE tenant_id = $1', [A.id]);
  });

  it('nothing escalates when the ticket is acknowledged in time', async () => {
    const { id, at } = await raise(A);
    expect((await command(A, id, 'start', 'asha')).statusCode).toBe(200);
    await breach(A, id, 'ack', plus(at, 6));
    expect(await steps(id, 'ack_missed')).toEqual([]);
    expect(await runDue(A, id, plus(at, 60))).toBe(0);
  });
});

describe('who is told', () => {
  it('the people on the roster for the shift running, not every supervisor', async () => {
    await admin.query(
      `INSERT INTO roster_entry (tenant_id, date, shift_id, person_id, level)
       SELECT $1, (now() AT TIME ZONE 'Asia/Kolkata')::date, s.id, $2, 'L2' FROM shift s WHERE s.tenant_id = $1`,
      [A.id, A.people.sunil2],
    );
    const { id, at } = await raise(A);
    await breach(A, id, 'ack', plus(at, 6));
    expect((await steps(id))[0]!.toldPersonIds).toEqual(told(A, 'sunil2'));
    await admin.query('DELETE FROM roster_entry WHERE tenant_id = $1', [A.id]);
  });

  it('a rostered person who has been switched off is skipped, and the role answers instead', async () => {
    await admin.query(
      `INSERT INTO roster_entry (tenant_id, date, shift_id, person_id, level)
       SELECT $1, (now() AT TIME ZONE 'Asia/Kolkata')::date, s.id, $2, 'L2' FROM shift s WHERE s.tenant_id = $1`,
      [A.id, A.people.gone],
    );
    const { id, at } = await raise(A);
    await breach(A, id, 'ack', plus(at, 6));
    expect([...(await steps(id))[0]!.toldPersonIds!].sort()).toEqual(told(A, 'sunil', 'sunil2'));
    await admin.query('DELETE FROM roster_entry WHERE tenant_id = $1', [A.id]);
  });

  it("plant B's ladder and people never touch plant A's tickets, and a forged job is a no-op", async () => {
    const a = await raise(A);
    const b = await raise(B);
    await breach(A, a.id, 'ack', plus(a.at, 6));
    await breach(B, b.id, 'ack', plus(b.at, 6));
    const toldA = (await steps(a.id))[0]!.toldPersonIds;
    expect(toldA!.every((p) => Object.values(A.people).includes(p))).toBe(true);
    expect((await steps(b.id))[0]!.toldPersonIds).toEqual(
      expect.arrayContaining(told(B, 'sunil', 'sunil2')),
    );
    const bRule = (
      await admin.query(
        "SELECT id FROM escalation_rule WHERE tenant_id = $1 AND trigger = 'ack_missed'",
        [B.id],
      )
    ).rows[0].id as string;
    const forged: EscalationJob = {
      tenantId: A.id,
      ticketId: a.id,
      ruleId: bRule,
      trigger: 'ack_missed',
      episode: Date.now(),
      attempt: 1,
      dueAt: 0,
    };
    expect(
      await processEscalationJob(forged, { pool: db.app, now: () => plus(a.at, 7), boss }),
    ).toBe(false);
    expect(await steps(a.id)).toHaveLength(1);
  });
});

describe('missed restore and a critical machine still down', () => {
  it('missed restore tells the head', async () => {
    const { id, at } = await raise(A);
    expect(await breach(A, id, 'restore', plus(at, 31))).toBe(true);
    const [step] = await steps(id, 'restore_missed');
    expect(step).toMatchObject({ level: 'L3', attempt: 1 });
    expect(step!.toldPersonIds).toEqual(told(A, 'hema'));
  });

  it('a critical machine still down after 60 minutes tells the plant head, and stops when it runs again', async () => {
    const { id, at } = await raise(A);
    const [queued] = await queuedSteps(id);
    expect(queued!.data).toMatchObject({
      trigger: 'critical_still_down',
      dueAt: at.getTime() + 60 * MIN,
    });
    expect(await runDue(A, id, plus(at, 59), 'critical_still_down')).toBe(0);
    expect(await runDue(A, id, plus(at, 60), 'critical_still_down')).toBe(1);
    const [step] = await steps(id, 'critical_still_down');
    expect(step).toMatchObject({ level: 'L4', attempt: 1 });
    expect(step!.toldPersonIds).toEqual(told(A, 'pravin'));
    expect((await command(A, id, 'start', 'asha')).statusCode).toBe(200);
    expect((await command(A, id, 'machine-running', 'asha')).statusCode).toBe(200);
    expect(await runDue(A, id, plus(at, 120), 'critical_still_down')).toBe(0);
    expect(await steps(id, 'critical_still_down')).toHaveLength(1);
  });

  it('a ticket that is not a stopped machine is not "still down"', async () => {
    const machineId = A.machines.shift();
    const raised = await call(A, 'POST', '/api/v1/tickets', 'omkar', {
      machineId,
      problem: 'Noisy',
      kind: 'support',
    });
    expect(raised.statusCode, raised.body).toBe(201);
    expect(await queuedSteps(raised.json().ticket.id)).toEqual([]);
  });
});

describe('the ladder is the head’s to edit', () => {
  const rules = async (plant: Plant) =>
    (await call(plant, 'GET', '/api/v1/escalation-rules', 'hema')).json().items as Array<{
      id: string;
      trigger: string;
    }>;
  const edit = (plant: Plant, ruleId: string, body: object) =>
    call(plant, 'PUT', `/api/v1/escalation-rules/${ruleId}`, 'hema', body);
  const ruleFor = async (plant: Plant, trigger: string) =>
    (await rules(plant)).find((r) => r.trigger === trigger)!;

  it('an edited rule is honoured: another level, another delay, another channel', async () => {
    const rule = await ruleFor(E, 'ack_missed');
    const res = await edit(E, rule.id, {
      level: 'L3',
      notifyRole: 'head',
      delayMinutes: '10',
      repeatMinutes: '',
      repeatCap: '',
      channel: 'whatsapp',
    });
    expect(res.statusCode, res.body).toBe(200);
    const { id, at } = await raise(E);
    await breach(E, id, 'ack', plus(at, 6));
    expect(await steps(id)).toEqual([]);
    expect(await runDue(E, id, plus(at, 15))).toBe(0);
    expect(await runDue(E, id, plus(at, 16))).toBe(1);
    const [step] = await steps(id, 'ack_missed');
    // no WhatsApp sender exists yet: the step goes out as a push and the event says so, never silently dropped
    expect(step).toMatchObject({
      level: 'L3',
      channel: 'whatsapp',
      channelFallback: 'push',
      attempt: 1,
    });
    expect(step!.toldPersonIds).toEqual(told(E, 'hema'));
    expect(await notices(id)).toEqual([
      { person_id: E.people.hema, channel: 'push', status: 'pending' },
    ]);
    expect(await queuedSteps(id, 'ack_missed')).toEqual([]);
  });

  it('a named person who is switched off falls through to the roster, then to the heads and admins, and the event says no ladder', async () => {
    const rule = await ruleFor(E, 'restore_missed');
    expect((await edit(E, rule.id, { active: 'false' })).statusCode).toBe(200);
    const named = await call(E, 'POST', '/api/v1/escalation-rules', 'hema', {
      trigger: 'restore_missed',
      severityMin: 'S3',
      level: 'L3',
      notifyPersonId: E.people.pravin,
    });
    expect(named.statusCode, named.body).toBe(201);
    const first = await raise(E);
    await breach(E, first.id, 'restore', plus(first.at, 31));
    expect((await steps(first.id))[0]!.toldPersonIds).toEqual(told(E, 'pravin'));
    expect((await steps(first.id))[0]!.noLadder).toBeUndefined();

    await admin.query('UPDATE person SET active = false WHERE id = $1', [E.people.pravin]);
    await admin.query(
      `INSERT INTO roster_entry (tenant_id, date, shift_id, person_id, level)
       SELECT $1, (now() AT TIME ZONE 'Asia/Kolkata')::date, s.id, $2, 'L3' FROM shift s WHERE s.tenant_id = $1`,
      [E.id, E.people.sunil],
    );
    const rostered = await raise(E);
    await breach(E, rostered.id, 'restore', plus(rostered.at, 31));
    expect((await steps(rostered.id))[0]!.toldPersonIds).toEqual(told(E, 'sunil'));

    await admin.query('DELETE FROM roster_entry WHERE tenant_id = $1', [E.id]);
    const nobody = await raise(E);
    await breach(E, nobody.id, 'restore', plus(nobody.at, 31));
    const [step] = await steps(nobody.id);
    expect([...step!.toldPersonIds!].sort()).toEqual(told(E, 'hema', 'root'));
    expect(step).toMatchObject({ noLadder: true, toldCount: 2 });
    await admin.query('UPDATE person SET active = true WHERE id = $1', [E.people.pravin]);
  });

  it('a rule that is switched off never fires, and one switched off mid-chain stops', async () => {
    const pause = await ruleFor(E, 'pause_overrun');
    const critical = await ruleFor(E, 'critical_still_down');
    expect((await edit(E, pause.id, { active: 'false' })).statusCode).toBe(200);
    expect((await edit(E, critical.id, { active: 'false' })).statusCode).toBe(200);
    const { id, at } = await raise(E);
    expect(await queuedSteps(id)).toEqual([]);
    expect((await command(E, id, 'start', 'asha')).statusCode).toBe(200);
    expect((await command(E, id, 'pause', 'asha', { reasonCode: 'spare' })).statusCode).toBe(200);
    const pausedAt = (
      await admin.query("SELECT at FROM ticket_event WHERE ticket_id = $1 AND type = 'pause'", [id])
    ).rows[0].at as Date;
    expect(await breach(E, id, 'pause', plus(pausedAt, 21))).toBe(true);
    expect(await steps(id)).toEqual([]);
    expect(await runDue(E, id, plus(at, 200), 'critical_still_down')).toBe(0);

    // the same for a chain already running
    const rule = await ruleFor(E, 'ack_missed');
    expect(
      (
        await edit(E, rule.id, {
          level: 'L2',
          notifyRole: 'supervisor',
          delayMinutes: '0',
          repeatMinutes: '15',
          repeatCap: '3',
          channel: 'push',
        })
      ).statusCode,
    ).toBe(200);
    const chain = await raise(E);
    await breach(E, chain.id, 'ack', plus(chain.at, 6));
    expect(await steps(chain.id)).toHaveLength(1);
    expect((await edit(E, rule.id, { active: 'false' })).statusCode).toBe(200);
    expect(await runDue(E, chain.id, plus(chain.at, 100))).toBe(0);
    expect(await steps(chain.id)).toHaveLength(1);
  });
});

describe('acknowledge an escalation', () => {
  async function restoreMissed(plant: Plant) {
    const { id, at } = await raise(plant);
    await breach(plant, id, 'restore', plus(at, 31));
    return { id, at };
  }
  const ackEsc = (plant: Plant, id: string, as: string, personId = plant.people[as]) =>
    call(plant, 'POST', `/api/v1/tickets/${id}/acknowledge-escalation`, as, { personId });

  it('the head covers an L3 escalation and its repeats stop; nobody below may', async () => {
    const { id, at } = await restoreMissed(A);
    for (const who of ['omkar', 'asha', 'sunil']) {
      const res = await ackEsc(A, id, who);
      expect(res.statusCode, `${who}: ${res.body}`).toBe(403);
    }
    expect((await ackEsc(A, id, 'hema')).statusCode).toBe(200);
    expect(
      (await call(A, 'GET', `/api/v1/tickets/${id}`, 'hema'))
        .json()
        .events.map((e: { type: string }) => e.type),
    ).toContain('escalation_ack');
    expect(await runDue(A, id, plus(at, 31 + 30), 'restore_missed')).toBe(0);
    expect(await steps(id, 'restore_missed')).toHaveLength(1);
    expect((await ackEsc(A, id, 'hema')).statusCode).toBe(409);
  });

  it('an admin may acknowledge; a shared login acts as the person on the session, never the body', async () => {
    const { id } = await restoreMissed(A);
    expect((await ackEsc(A, id, 'shared', A.people.hema)).statusCode).toBe(403);
    expect((await ackEsc(A, id, 'hema', A.people.pravin)).statusCode).toBe(403);
    const res = await ackEsc(A, id, 'root');
    expect(res.statusCode, res.body).toBe(200);
    const row = (
      await admin.query(
        "SELECT acting_person_id FROM ticket_event WHERE ticket_id = $1 AND type = 'escalation_ack'",
        [id],
      )
    ).rows[0];
    expect(row.acting_person_id).toBe(A.people.root);
  });

  it('a ticket nobody escalated has nothing to acknowledge', async () => {
    const { id } = await raise(A);
    expect((await ackEsc(A, id, 'hema')).statusCode).toBe(409);
  });

  it('acknowledging one level leaves a higher chain running, and a new breach is a new chain', async () => {
    const { id, at } = await raise(A);
    await breach(A, id, 'ack', plus(at, 6));
    await breach(A, id, 'restore', plus(at, 31));
    expect((await ackEsc(A, id, 'sunil')).statusCode).toBe(200);
    expect(await runDue(A, id, plus(at, 31 + 30), 'restore_missed')).toBe(1);
    expect(await steps(id, 'ack_missed')).toHaveLength(1);
    expect(await steps(id, 'restore_missed')).toHaveLength(2);
  });
});

describe('a transferred ticket nobody picks up', () => {
  it('restarts the acknowledge clock and escalates when nobody takes it', async () => {
    const { id, at } = await raise(A);
    expect((await command(A, id, 'start', 'asha')).statusCode).toBe(200);
    const stopped = (
      await admin.query(
        "SELECT state, stop_reason FROM sla_timer WHERE ticket_id = $1 AND kind = 'ack'",
        [id],
      )
    ).rows[0];
    expect(stopped).toEqual({ state: 'stopped', stop_reason: 'started' });
    expect((await command(A, id, 'transfer', 'asha', { note: 'end of shift' })).statusCode).toBe(
      200,
    );
    const handedAt = (
      await admin.query("SELECT at FROM ticket_event WHERE ticket_id = $1 AND type = 'transfer'", [
        id,
      ])
    ).rows[0].at as Date;
    const timer = (
      await admin.query(
        "SELECT state, due_at, fired_at FROM sla_timer WHERE ticket_id = $1 AND kind = 'ack'",
        [id],
      )
    ).rows[0];
    expect(timer.state).toBe('running');
    expect(timer.fired_at).toBeNull();
    expect(new Date(timer.due_at).getTime()).toBe(handedAt.getTime() + 5 * MIN);

    expect(await breach(A, id, 'ack', plus(handedAt, 6))).toBe(true);
    const [step] = await steps(id, 'ack_missed');
    expect(step).toMatchObject({ level: 'L2', attempt: 1 });
    expect(at.getTime()).toBeLessThan(handedAt.getTime() + 1);
  });

  it('does not escalate once someone picks it up, even if the clock’s job still comes', async () => {
    const { id, at } = await raise(A);
    await command(A, id, 'start', 'asha');
    await command(A, id, 'transfer', 'asha', { note: 'end of shift' });
    expect((await command(A, id, 'start', 'bina')).statusCode).toBe(200);
    const timer = (
      await admin.query(
        "SELECT state, stop_reason FROM sla_timer WHERE ticket_id = $1 AND kind = 'ack'",
        [id],
      )
    ).rows[0];
    expect(timer).toEqual({ state: 'stopped', stop_reason: 'started' });
    // the straggler job of the stopped clock runs, and so does everything queued: nothing is told
    await breach(A, id, 'ack', plus(at, 600));
    expect(await runDue(A, id, plus(at, 600))).toBe(0);
    expect(await steps(id, 'ack_missed')).toEqual([]);
  });

  it('after a handover the next person may acknowledge again', async () => {
    const { id } = await raise(A);
    await command(A, id, 'start', 'asha');
    await rosterLine(A, 'bina', 'L1');
    expect((await command(A, id, 'acknowledge', 'bina')).statusCode).toBe(200);
    expect((await command(A, id, 'acknowledge', 'bina')).statusCode).toBe(409);
    await command(A, id, 'transfer', 'asha', { note: 'end of shift' });
    expect((await command(A, id, 'acknowledge', 'bina')).statusCode).toBe(200);
    await admin.query('DELETE FROM roster_entry WHERE tenant_id = $1', [A.id]);
  });

  it('the Acknowledge button comes back after a handover', async () => {
    const { id } = await raise(A);
    await command(A, id, 'start', 'asha');
    await rosterLine(A, 'bina', 'L1');
    const offered = async () =>
      (await call(A, 'GET', `/api/v1/tickets/${id}`, 'bina')).json().ticket.canAcknowledge;
    expect(await offered()).toBe(false);
    await command(A, id, 'transfer', 'asha', { note: 'end of shift' });
    expect(await offered()).toBe(true);
    await admin.query('DELETE FROM roster_entry WHERE tenant_id = $1', [A.id]);
  });

  it('a chain from before the handover ends when the new acknowledge window starts', async () => {
    const { id, at } = await raise(A);
    await breach(A, id, 'ack', plus(at, 6));
    await command(A, id, 'start', 'asha');
    await command(A, id, 'transfer', 'asha', { note: 'end of shift' });
    expect(await runDue(A, id, plus(at, 36))).toBe(0);
    expect(await steps(id, 'ack_missed')).toHaveLength(1);
  });
});

describe('a worker restart or a duplicate job', () => {
  it('never double-notifies the same step', async () => {
    const { id, at } = await raise(A);
    await breach(A, id, 'ack', plus(at, 6));
    const [job] = await queuedSteps(id, 'ack_missed');
    const run = () =>
      processEscalationJob(job!.data, { pool: db.app, now: () => plus(at, 36), boss });
    expect(await run()).toBe(true);
    expect(await run()).toBe(false);
    await Promise.all([run(), run()]);
    expect(await steps(id, 'ack_missed')).toHaveLength(2);
    expect(await notices(id)).toHaveLength(4);
    // the breach itself fires once: a second run of the clock's job does not start a second chain
    expect(await breach(A, id, 'ack', plus(at, 40))).toBe(false);
    expect(await steps(id, 'ack_missed')).toHaveLength(2);
  });
});

describe('sign-off unanswered and a pause that ran over', () => {
  const closeIt = (plant: Plant, id: string) =>
    command(plant, id, 'close', 'asha', { kind: 'report', report: { correctiveAction: 'Fixed' } });
  const signoffClock = async (id: string) =>
    (
      await admin.query("SELECT due_at FROM sla_timer WHERE ticket_id = $1 AND kind = 'handback'", [
        id,
      ])
    ).rows[0]?.due_at as Date | undefined;

  it('escalates when production never answers, and stops when it does', async () => {
    const { id } = await raise(A);
    await command(A, id, 'start', 'asha');
    expect((await closeIt(A, id)).statusCode).toBe(200);
    const due = (await signoffClock(id))!;
    expect(await breach(A, id, 'handback', plus(due, 1))).toBe(true);
    expect(await steps(id, 'handback_unanswered')).toHaveLength(1);
    expect((await command(A, id, 'handback', 'sunil', { response: 'confirmed' })).statusCode).toBe(
      200,
    );
    expect(await runDue(A, id, plus(due, 60), 'handback_unanswered')).toBe(0);
    expect(await steps(id, 'handback_unanswered')).toHaveLength(1);
  });

  it('does not escalate a sign-off that was answered in time', async () => {
    const { id } = await raise(A);
    await command(A, id, 'start', 'asha');
    await closeIt(A, id);
    const due = (await signoffClock(id))!;
    expect((await command(A, id, 'handback', 'sunil', { response: 'confirmed' })).statusCode).toBe(
      200,
    );
    expect(await queuedSteps(id, 'handback_unanswered')).toEqual([]);
    // even a straggler job for the stopped clock escalates nothing
    await breach(A, id, 'handback', plus(due, 1));
    expect(await steps(id, 'handback_unanswered')).toEqual([]);
  });

  it('a pause over its maximum tells the supervisors once', async () => {
    const { id } = await raise(A);
    await command(A, id, 'start', 'asha');
    expect((await command(A, id, 'pause', 'asha', { reasonCode: 'spare' })).statusCode).toBe(200);
    const pausedAt = (
      await admin.query("SELECT at FROM ticket_event WHERE ticket_id = $1 AND type = 'pause'", [id])
    ).rows[0].at as Date;
    expect(await breach(A, id, 'pause', plus(pausedAt, 21))).toBe(true);
    const [step] = await steps(id, 'pause_overrun');
    expect(step).toMatchObject({ level: 'L2', attempt: 1 });
    expect(await queuedSteps(id, 'pause_overrun')).toEqual([]);
  });

  it('a pause that ended before its job came escalates nothing', async () => {
    const { id } = await raise(A);
    await command(A, id, 'start', 'asha');
    await command(A, id, 'pause', 'asha', { reasonCode: 'spare' });
    const pausedAt = (
      await admin.query("SELECT at FROM ticket_event WHERE ticket_id = $1 AND type = 'pause'", [id])
    ).rows[0].at as Date;
    expect((await command(A, id, 'resume', 'asha')).statusCode).toBe(200);
    await breach(A, id, 'pause', plus(pausedAt, 21));
    expect(await steps(id, 'pause_overrun')).toEqual([]);
  });
});

describe('a pause breach owed when the next pause starts (the ladder)', () => {
  const projection = (patch: Partial<SlaTimerProjection>): SlaTimerProjection => ({
    kind: 'pause',
    state: 'running',
    breached: false,
    dueAt: new Date(),
    pausedAt: null,
    stoppedAt: null,
    stopReason: null,
    ...patch,
  });
  const rearm = (plant: Plant, id: string, timer: SlaTimerProjection, now: Date) =>
    withTenant(db.app, plant.id, (client) =>
      rearmTicket(client, boss, { tenantId: plant.id, ticketId: id, timers: [timer], now }),
    );
  const owedJobs = async (id: string) =>
    (
      await admin.query(
        "SELECT data FROM pgboss.job WHERE name = 'sla.timer' AND data->>'ticketId' = $1 AND data ? 'owedDueAt' AND state = 'created'",
        [id],
      )
    ).rows.map((row) => row.data as SlaTimerPayload);

  /** Pause 1 ran past its maximum and ended, then pause 2 began, with no job run in between. */
  async function twoPauses() {
    const { id } = await raise(A);
    await command(A, id, 'start', 'asha');
    expect((await command(A, id, 'pause', 'asha', { reasonCode: 'spare' })).statusCode).toBe(200);
    const pausedAt = (
      await admin.query("SELECT at FROM ticket_event WHERE ticket_id = $1 AND type = 'pause'", [id])
    ).rows[0].at as Date;
    const first = plus(pausedAt, 20);
    await rearm(
      A,
      id,
      projection({
        state: 'stopped',
        breached: true,
        dueAt: first,
        stoppedAt: plus(first, 5),
        stopReason: 'resumed',
      }),
      plus(first, 5),
    );
    await rearm(A, id, projection({ dueAt: plus(first, 35) }), plus(first, 6));
    return { id, first };
  }

  it('tells nobody about a pause that had already ended, and tells once about the pause that is running', async () => {
    const { id, first } = await twoPauses();
    const [owed] = await owedJobs(id);
    expect(owed).toMatchObject({ kind: 'pause', owedDueAt: first.getTime() });
    expect(await processSlaTimerJob(owed!, { pool: db.app, now: () => plus(first, 7), boss })).toBe(
      true,
    );
    // The ladder asks for a running clock, as it does for a pause that was resumed before its job came.
    expect(await steps(id, 'pause_overrun')).toEqual([]);
    expect(await breach(A, id, 'pause', plus(first, 36))).toBe(true);
    expect(await steps(id, 'pause_overrun')).toHaveLength(1);
  });

  it('a second delivery of the owed job changes nothing', async () => {
    const { id, first } = await twoPauses();
    const [owed] = await owedJobs(id);
    for (const minutes of [7, 9]) {
      expect(
        await processSlaTimerJob(owed!, { pool: db.app, now: () => plus(first, minutes), boss }),
      ).toBe(true);
    }
    expect(await steps(id, 'pause_overrun')).toEqual([]);
    expect(await notices(id)).toEqual([]);
    expect(await breach(A, id, 'pause', plus(first, 36))).toBe(true);
    expect(await steps(id, 'pause_overrun')).toHaveLength(1);
  });
});

describe('the history', () => {
  it('shows the escalation as the system’s event: no person, no login', async () => {
    const { id, at } = await raise(A);
    await breach(A, id, 'ack', plus(at, 6));
    const row = (
      await admin.query(
        "SELECT login_id, acting_person_id FROM ticket_event WHERE ticket_id = $1 AND type = 'escalate'",
        [id],
      )
    ).rows[0];
    expect(row).toEqual({ login_id: null, acting_person_id: null });
  });

  it('an escalation does not stop a person closing at a time before it', async () => {
    const { id, at } = await raise(A);
    await command(A, id, 'start', 'asha');
    await breach(A, id, 'restore', plus(at, 31));
    const closed = await command(A, id, 'close', 'asha', {
      kind: 'no_report',
      note: 'done',
      at: plus(at, 20).toISOString(),
    });
    expect(closed.statusCode, closed.body).toBe(200);
  });
});

describe('review fixes', () => {
  const ackEsc = (plant: Plant, id: string, as: string, host = plant) =>
    call(host, 'POST', `/api/v1/tickets/${id}/acknowledge-escalation`, as, {
      personId: plant.people[as],
    });
  const lockOf = (plant: Plant) => `escalation-seed:${plant.id}`;

  it('a plant that already has a ladder never waits on the seed lock', async () => {
    await raise(A);
    const holder = await admin.connect();
    await holder.query('SELECT pg_advisory_lock(hashtext($1))', [lockOf(A)]);
    try {
      const done = await Promise.race([
        withTenant(db.app, A.id, (client) =>
          ensureEscalationDefaults(client, { tenantId: A.id, loginId: null }),
        ).then(() => 'done'),
        new Promise((resolve) => setTimeout(() => resolve('blocked'), 3000)),
      ]);
      expect(done).toBe('done');
    } finally {
      await holder.query('SELECT pg_advisory_unlock_all()');
      holder.release();
    }
  });

  it('a plant without SLA policies never escalates, seeds nothing and arms nothing', async () => {
    const { id, at } = await raise(N);
    expect(await queuedSteps(id)).toEqual([]);
    await withTenant(db.app, N.id, (client) =>
      reconcileTicket(client, { tenantId: N.id, ticketId: id, now: plus(at, 90), boss }),
    );
    expect(await queuedSteps(id)).toEqual([]);
    expect(
      (await admin.query('SELECT 1 FROM escalation_rule WHERE tenant_id = $1', [N.id])).rowCount,
    ).toBe(0);
    // a forged step for such a plant does nothing either
    await withTenant(db.app, N.id, (client) =>
      ensureEscalationDefaults(client, { tenantId: N.id, loginId: null }),
    );
    const rule = (
      await admin.query(
        "SELECT id FROM escalation_rule WHERE tenant_id = $1 AND trigger = 'critical_still_down'",
        [N.id],
      )
    ).rows[0].id as string;
    const forged: EscalationJob = {
      tenantId: N.id,
      ticketId: id,
      ruleId: rule,
      trigger: 'critical_still_down',
      episode: at.getTime(),
      attempt: 1,
      dueAt: 0,
    };
    expect(
      await processEscalationJob(forged, { pool: db.app, now: () => plus(at, 90), boss }),
    ).toBe(false);
    expect(await steps(id)).toEqual([]);
  });

  it('a chain that meets a pause waits, and goes on when the ticket works again', async () => {
    const { id, at } = await raise(A);
    await command(A, id, 'start', 'asha');
    await breach(A, id, 'restore', plus(at, 31));
    expect(await steps(id, 'restore_missed')).toHaveLength(1);
    expect((await command(A, id, 'pause', 'asha', { reasonCode: 'spare' })).statusCode).toBe(200);
    expect(await runDue(A, id, plus(at, 61), 'restore_missed')).toBe(0);
    const waiting = await queuedSteps(id, 'restore_missed');
    expect(waiting).toHaveLength(1);
    expect(waiting[0]!.data).toMatchObject({ attempt: 2, dueAt: plus(at, 61 + 30).getTime() });
    expect((await command(A, id, 'resume', 'asha')).statusCode).toBe(200);
    expect(await runDue(A, id, plus(at, 61 + 30), 'restore_missed')).toBe(1);
    expect((await steps(id, 'restore_missed')).map((step) => step.attempt)).toEqual([1, 2]);
  });

  it('a closed or cancelled ticket stops its chain', async () => {
    const closed = await raise(A);
    await command(A, closed.id, 'start', 'asha');
    await breach(A, closed.id, 'restore', plus(closed.at, 31));
    expect(
      (await command(A, closed.id, 'close', 'asha', { kind: 'no_report', note: 'done' }))
        .statusCode,
    ).toBe(200);
    expect(await runDue(A, closed.id, plus(closed.at, 61), 'restore_missed')).toBe(0);
    const cancelled = await raise(A);
    await breach(A, cancelled.id, 'restore', plus(cancelled.at, 31));
    expect(
      (await command(A, cancelled.id, 'cancel', 'asha', { reason: 'duplicate' })).statusCode,
    ).toBe(200);
    expect(await runDue(A, cancelled.id, plus(cancelled.at, 61), 'restore_missed')).toBe(0);
    expect(await steps(cancelled.id, 'restore_missed')).toHaveLength(1);
  });

  it('survives a short database blip: the queue retries five times with a wait', async () => {
    const queue = await boss.getQueue('sla.escalate');
    expect(queue).toMatchObject({ retryLimit: 5, retryDelay: 30, retryBackoff: true });
  });

  it('who was told is read through the ticket reply; the board and another plant get nothing', async () => {
    const { id, at } = await raise(A);
    await breach(A, id, 'restore', plus(at, 31));
    expect((await steps(id))[0]).toMatchObject({ toldCount: 1, toldPersonIds: told(A, 'hema') });
    expect((await call(B, 'GET', `/api/v1/tickets/${id}`, 'hema')).statusCode).toBe(404);
    expect((await ackEsc(B, id, 'hema')).statusCode).toBe(404);
    expect((await ackEsc(A, id, 'boris')).statusCode).toBe(403);
  });

  it('the plant head acknowledges an L4 escalation', async () => {
    const { id, at } = await raise(A);
    await runDue(A, id, plus(at, 60), 'critical_still_down');
    expect((await steps(id, 'critical_still_down'))[0]).toMatchObject({ level: 'L4' });
    expect((await ackEsc(A, id, 'hema')).statusCode).toBe(403);
    expect((await ackEsc(A, id, 'pravin')).statusCode).toBe(200);
    expect(await runDue(A, id, plus(at, 120), 'critical_still_down')).toBe(0);
  });

  it('after the notifications are purged the history says so instead of "nobody told"', async () => {
    const { id, at } = await raise(A);
    await breach(A, id, 'restore', plus(at, 31));
    await admin.query('DELETE FROM notification WHERE ticket_id = $1', [id]);
    expect((await steps(id))[0]).toMatchObject({ toldCount: 1, toldPersonIds: null });
  });

  it('an admin may correct a closed ticket whose sign-off was escalated after the close', async () => {
    const { id } = await raise(A);
    await command(A, id, 'start', 'asha');
    expect(
      (
        await command(A, id, 'close', 'asha', {
          kind: 'report',
          report: { correctiveAction: 'Fixed' },
        })
      ).statusCode,
    ).toBe(200);
    const due = (
      await admin.query("SELECT due_at FROM sla_timer WHERE ticket_id = $1 AND kind = 'handback'", [
        id,
      ])
    ).rows[0].due_at as Date;
    await breach(A, id, 'handback', plus(due, 1));
    expect(await steps(id, 'handback_unanswered')).toHaveLength(1);
    const fixed = await command(A, id, 'correct', 'root', {
      reason: 'typo',
      changes: { problem: 'Spindle stops' },
    });
    expect(fixed.statusCode, fixed.body).toBe(200);
  });

  it('acknowledging an escalation on a cancelled ticket is refused', async () => {
    const { id, at } = await raise(A);
    await breach(A, id, 'restore', plus(at, 31));
    await command(A, id, 'cancel', 'asha', { reason: 'duplicate' });
    expect((await ackEsc(A, id, 'hema')).statusCode).toBe(409);
  });

  it('the roster names only people with a login of their own, as the role does', async () => {
    await rosterLine(A, 'nologin', 'L2');
    const { id, at } = await raise(A);
    await breach(A, id, 'ack', plus(at, 6));
    expect([...(await steps(id))[0]!.toldPersonIds!].sort()).toEqual(told(A, 'sunil', 'sunil2'));
    await admin.query('DELETE FROM roster_entry WHERE tenant_id = $1', [A.id]);
  });

  it('seeds the reopened-twice rule switched off: it cannot fire yet', async () => {
    const rules = (await call(A, 'GET', '/api/v1/escalation-rules', 'hema')).json().items as Array<{
      trigger: string;
      active: boolean;
    }>;
    expect(rules.filter((rule) => !rule.active).map((rule) => rule.trigger)).toEqual([
      'reopened_twice',
    ]);
  });

  it('saving a ladder rule re-arms the tickets already down, and a changed delay is honoured', async () => {
    const { id, at } = await raise(R);
    const rules = (await call(R, 'GET', '/api/v1/escalation-rules', 'hema')).json().items as Array<{
      id: string;
      trigger: string;
    }>;
    const critical = rules.find((rule) => rule.trigger === 'critical_still_down')!;
    const dueOf = async () => (await queuedSteps(id, 'critical_still_down'))[0]!.data.dueAt;
    expect(await dueOf()).toBe(plus(at, 60).getTime());
    const save = (delay: string) =>
      call(R, 'PUT', `/api/v1/escalation-rules/${critical.id}`, 'hema', { delayMinutes: delay });
    expect((await save('10')).statusCode).toBe(200);
    expect(await dueOf()).toBe(plus(at, 10).getTime());
    expect((await save('120')).statusCode).toBe(200);
    expect(await dueOf()).toBe(plus(at, 120).getTime());
    // a step that still wakes at the old time re-checks the delay and waits
    const old = {
      ...(await queuedSteps(id, 'critical_still_down'))[0]!.data,
      dueAt: plus(at, 60).getTime(),
    };
    expect(await processEscalationJob(old, { pool: db.app, now: () => plus(at, 61), boss })).toBe(
      false,
    );
    expect(await steps(id, 'critical_still_down')).toEqual([]);
    expect(await runDue(R, id, plus(at, 120), 'critical_still_down')).toBe(1);
  });

  it('a client key that looks like a step key is refused and cannot silence the step', async () => {
    const { id, at } = await raise(A);
    const [queued] = await queuedSteps(id, 'critical_still_down');
    const { ruleId, episode } = queued!.data;
    const forged = await app.inject({
      method: 'POST',
      url: `/api/v1/tickets/${id}/update`,
      headers: {
        host: A.host,
        'content-type': 'application/json',
        authorization: `Bearer ${A.tokens.asha}`,
        'idempotency-key': `esc:${ruleId}:${episode}:1`,
      },
      payload: { personId: A.people.asha, text: 'looking at it' },
    });
    expect(forged.statusCode, forged.body).toBe(422);
    expect(await runDue(A, id, plus(at, 60), 'critical_still_down')).toBe(1);
    expect(await steps(id, 'critical_still_down')).toHaveLength(1);
  });

  it('with nobody on the ladder the plant head, the heads and the admins are told', async () => {
    const rules = (await call(R, 'GET', '/api/v1/escalation-rules', 'hema')).json().items as Array<{
      id: string;
      trigger: string;
    }>;
    const restore = rules.find((rule) => rule.trigger === 'restore_missed')!;
    await call(R, 'PUT', `/api/v1/escalation-rules/${restore.id}`, 'hema', { active: 'false' });
    // a named person with no login of their own is nobody to push
    const named = await call(R, 'POST', '/api/v1/escalation-rules', 'hema', {
      trigger: 'restore_missed',
      severityMin: 'S3',
      level: 'L3',
      notifyPersonId: R.people.nologin,
    });
    expect(named.statusCode, named.body).toBe(201);
    const { id, at } = await raise(R);
    await breach(R, id, 'restore', plus(at, 31));
    const [step] = await steps(id, 'restore_missed');
    expect([...step!.toldPersonIds!].sort()).toEqual(told(R, 'hema', 'pravin', 'root'));
    expect(step).toMatchObject({ noLadder: true, toldCount: 3 });
  });

  it('a chain that meets a pause is not lost when its rule does not repeat', async () => {
    const rules = (await call(P, 'GET', '/api/v1/escalation-rules', 'hema')).json().items as Array<{
      id: string;
      trigger: string;
    }>;
    const restore = rules.find((rule) => rule.trigger === 'restore_missed')!;
    await call(P, 'PUT', `/api/v1/escalation-rules/${restore.id}`, 'hema', {
      active: 'true',
      delayMinutes: '10',
      repeatMinutes: '',
      repeatCap: '',
    });
    const second = await raise(P);
    await command(P, second.id, 'start', 'asha');
    await breach(P, second.id, 'restore', plus(second.at, 31));
    expect(await steps(second.id, 'restore_missed')).toEqual([]);
    expect((await command(P, second.id, 'pause', 'asha', { reasonCode: 'spare' })).statusCode).toBe(
      200,
    );
    expect(await runDue(P, second.id, plus(second.at, 41), 'restore_missed')).toBe(0);
    const waiting = await queuedSteps(second.id, 'restore_missed');
    expect(waiting).toHaveLength(1);
    expect(waiting[0]!.data.dueAt).toBe(plus(second.at, 41 + 15).getTime());
    expect((await command(P, second.id, 'resume', 'asha')).statusCode).toBe(200);
    expect(await runDue(P, second.id, plus(second.at, 41 + 15), 'restore_missed')).toBe(1);
  });
});
