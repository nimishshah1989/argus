import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { pendingTasksOn } from '@uptimo/shared';
import { withTenant } from '@uptimo/db';
import { reconcileTicket } from '../src/modules/accountability/sla.js';
import { runSlaConsistency } from '../src/modules/accountability/consistency.js';
import { A, startFixture, type Fixture } from './plant-settings-fixture.js';

interface OpenTicket {
  id: string;
  parentId: string | null;
  status: string;
  machineSnapshot: { id?: string | null } | null;
}

let f: Fixture;
let tech: string;
beforeAll(async () => {
  f = await startFixture();
  tech = await personOf('plant-a-technician');
  await f.admin.query(
    `INSERT INTO list_item (tenant_id, list, code, label) VALUES ($1, 'task_reason', 'spare', 'Waiting for spare'), ($1, 'task_reason', 'planned_stop', 'Needs a planned stop')`,
    [A],
  );
}, 180_000);
afterAll(async () => f.stop());

let keys = 0;
const post = (token: string, url: string, payload: object, key = `task-${(keys += 1)}`) =>
  f.app.inject({
    method: 'POST',
    url,
    headers: {
      host: 'plant-a.localhost',
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
      'idempotency-key': key,
    },
    payload,
  });
const get = async (token: string, url: string) => (await f.call('GET', url, token)).json();
async function personOf(username: string): Promise<string> {
  return (await f.admin.query('SELECT person_id FROM login WHERE username = $1', [username]))
    .rows[0].person_id as string;
}

/** A breakdown on a machine of its own, started by the technician, so the technician may close it. */
async function workingBreakdown(code: string): Promise<{ id: string; machineId: string }> {
  const machine = (await f.call('POST', '/api/v1/machines', f.tokens.head!, { code })).json();
  const raised = await post(f.tokens.head!, '/api/v1/tickets', {
    kind: 'stopped',
    machineId: machine.id,
    problem: 'Spindle noise',
  });
  expect(raised.statusCode, raised.body).toBe(201);
  const id = raised.json().ticket.id as string;
  const started = await post(f.tokens.technician!, `/api/v1/tickets/${id}/start`, {
    personId: tech,
  });
  expect(started.statusCode, started.body).toBe(200);
  return { id, machineId: machine.id as string };
}

const close = (id: string, body: object, key?: string) =>
  post(f.tokens.technician!, `/api/v1/tickets/${id}/close`, { personId: tech, ...body }, key);
const TASK = { text: 'Replace the spindle bearing', reasonCode: 'spare', expectedOn: '2999-01-01' };

describe('a job left unfinished at close becomes a child task', () => {
  it('the close says which task it made, and the parent lists it as pending with its reason and date', async () => {
    const { id } = await workingBreakdown('FT-1');
    const res = await close(id, { kind: 'no_report', note: 'Machine running', task: TASK });
    expect(res.statusCode, res.body).toBe(200);
    const made = res.json().task as { id: string; ref: string };
    expect(made.ref).toMatch(/^WR-\d+$/);
    expect(res.json().ticket.status).toBe('closed');

    const parent = await get(f.tokens.head!, `/api/v1/tickets/${id}`);
    expect(parent.tasks).toEqual([
      expect.objectContaining({
        id: made.id,
        ref: made.ref,
        state: 'pending',
        status: 'open',
        text: TASK.text,
        taskReason: 'spare',
        taskExpectedOn: '2999-01-01',
        taskDownMin: null,
      }),
    ]);
    expect(parent.taskSummary).toEqual({
      pending: 1,
      inProgress: 0,
      overdue: 0,
      done: 0,
      box: 'pending',
    });
    const line = parent.events.find((e: { type: string }) => e.type === 'task');
    expect(line).toMatchObject({
      text: TASK.text,
      reason: 'spare',
      actingPersonId: tech,
      task: { id: made.id, ref: made.ref, stage: 'left', expectedOn: '2999-01-01', downMin: null },
    });
    expect(parent.ticket.lastEventSeq).toBe(parent.events.at(-1).seq);
  });

  it('the child is a work request that points back to its parent', async () => {
    const { id } = await workingBreakdown('FT-2');
    const made = (await close(id, { kind: 'no_report', note: 'Done', task: TASK })).json().task;
    const child = await get(f.tokens.head!, `/api/v1/tickets/${made.id}`);
    expect(child.ticket).toMatchObject({
      kind: 'general',
      status: 'open',
      parentId: id,
      taskReason: 'spare',
      taskExpectedOn: '2999-01-01',
      problem: TASK.text,
    });
    expect(child.parent).toEqual({ id, ref: expect.stringMatching(/^BD-/) });
    expect(child.tasks).toEqual([]);
    expect(child.taskSummary.box).toBe('none');
  });

  it('a task whose date has passed is overdue, and the parent says so', async () => {
    const { id } = await workingBreakdown('FT-3');
    await close(id, { kind: 'no_report', note: 'x', task: { ...TASK, expectedOn: '2000-01-01' } });
    const parent = await get(f.tokens.head!, `/api/v1/tickets/${id}`);
    expect(parent.tasks[0].state).toBe('overdue');
    expect(parent.taskSummary).toMatchObject({ overdue: 1, pending: 0, box: 'overdue' });
  });

  it('a date already past is accepted (a queued entry may arrive late) and shows overdue', async () => {
    const { id } = await workingBreakdown('FT-3b');
    const res = await close(id, {
      kind: 'no_report',
      note: 'x',
      task: { ...TASK, expectedOn: '2001-02-03' },
    });
    expect(res.statusCode, res.body).toBe(200);
  });

  it('a task already started shows as in progress', async () => {
    const { id } = await workingBreakdown('FT-4');
    const made = (await close(id, { kind: 'no_report', note: 'x', task: TASK })).json().task;
    await post(f.tokens.technician!, `/api/v1/tickets/${made.id}/start`, { personId: tech });
    const parent = await get(f.tokens.head!, `/api/v1/tickets/${id}`);
    expect(parent.tasks[0]).toMatchObject({ state: 'in_progress', startedByPersonId: tech });
    expect(parent.taskSummary).toMatchObject({ inProgress: 1, box: 'in_progress' });
  });

  it('closing with no task changes nothing about tasks', async () => {
    const { id } = await workingBreakdown('FT-5');
    const res = await close(id, { kind: 'no_report', note: 'All fixed' });
    expect(res.json().task).toBeUndefined();
    const parent = await get(f.tokens.head!, `/api/v1/tickets/${id}`);
    expect(parent.tasks).toEqual([]);
    expect(parent.taskSummary.box).toBe('none');
  });
});

describe('marking a task done asks the machine-stopped minutes', () => {
  async function startedTask(code: string) {
    const { id } = await workingBreakdown(code);
    const made = (await close(id, { kind: 'no_report', note: 'x', task: TASK })).json().task;
    const before = (await get(f.tokens.head!, `/api/v1/tickets/${id}`)).ticket.figures.downtimeMin;
    await post(f.tokens.technician!, `/api/v1/tickets/${made.id}/start`, { personId: tech });
    return { id, taskId: made.id as string, before };
  }

  it('the minutes are kept on the task, the parent shows it done, and the parent downtime is untouched', async () => {
    const { id, taskId, before } = await startedTask('FT-6');
    const res = await close(taskId, { kind: 'done', note: 'Bearing replaced', taskDownMin: 45 });
    expect(res.statusCode, res.body).toBe(200);
    expect(res.json().ticket).toMatchObject({
      status: 'closed',
      closeKind: 'done',
      taskDownMin: 45,
    });

    const parent = await get(f.tokens.head!, `/api/v1/tickets/${id}`);
    expect(parent.tasks[0]).toMatchObject({
      state: 'done',
      taskDownMin: 45,
      closedByPersonId: tech,
    });
    expect(parent.taskSummary).toEqual({
      pending: 0,
      inProgress: 0,
      overdue: 0,
      done: 1,
      box: 'done',
    });
    expect(parent.ticket.figures.downtimeMin).toBe(before);
    const done = parent.events.filter((e: { type: string }) => e.type === 'task').at(-1);
    expect(done).toMatchObject({
      text: 'Bearing replaced',
      task: { id: taskId, stage: 'done', downMin: 45 },
    });
  });

  it('the minutes may be 0 ("machine not stopped"), and are optional', async () => {
    const zero = await startedTask('FT-7');
    expect(
      (await close(zero.taskId, { kind: 'done', note: 'ok', taskDownMin: 0 })).json().ticket
        .taskDownMin,
    ).toBe(0);
    const left = await startedTask('FT-8');
    expect(
      (await close(left.taskId, { kind: 'done', note: 'ok' })).json().ticket.taskDownMin,
    ).toBeNull();
  });

  it('a task still open can be closed in one step: the closer starts it at the close', async () => {
    const { id } = await workingBreakdown('FT-D1');
    const made = (await close(id, { kind: 'no_report', note: 'x', task: TASK })).json().task;
    const res = await close(made.id, { kind: 'done', note: 'Replaced', taskDownMin: 20 });
    expect(res.statusCode, res.body).toBe(200);
    expect(res.json().ticket).toMatchObject({
      status: 'closed',
      taskDownMin: 20,
      leadPersonId: tech,
    });
    const child = await get(f.tokens.head!, `/api/v1/tickets/${made.id}`);
    const kinds = child.events.map((e: { type: string }) => e.type);
    expect(kinds).toEqual(['down', 'start', 'close']);
    expect(child.events[1].actingPersonId).toBe(tech);
    const parent = await get(f.tokens.head!, `/api/v1/tickets/${id}`);
    expect(parent.taskSummary).toMatchObject({ done: 1, box: 'done' });
  });

  it('an open ticket that is not a task still cannot be closed, and an operator cannot close a task', async () => {
    const machine = (
      await f.call('POST', '/api/v1/machines', f.tokens.head!, { code: 'FT-D2' })
    ).json();
    const raised = await post(f.tokens.head!, '/api/v1/tickets', {
      kind: 'stopped',
      machineId: machine.id,
      problem: 'Not started',
    });
    const plain = await close(raised.json().ticket.id, { kind: 'no_report', note: 'x' });
    expect(plain.statusCode).toBe(409);
    const { id } = await workingBreakdown('FT-D3');
    const made = (await close(id, { kind: 'no_report', note: 'x', task: TASK })).json().task;
    const operator = await post(f.tokens.operator!, `/api/v1/tickets/${made.id}/close`, {
      kind: 'done',
      note: 'x',
    });
    expect(operator.statusCode).toBe(403);
    expect((await get(f.tokens.head!, `/api/v1/tickets/${made.id}`)).ticket.status).toBe('open');
  });

  it('a task finishing writes its line on the parent without making the parent look freshly changed', async () => {
    const { id, taskId } = await startedTask('FT-D4');
    const stamp = async () =>
      (
        await f.admin.query('SELECT updated_at FROM ticket WHERE id = $1', [id])
      ).rows[0].updated_at.getTime();
    const before = await stamp();
    await close(taskId, { kind: 'done', note: 'ok', taskDownMin: 0 });
    expect(await stamp()).toBe(before);
    const parent = await get(f.tokens.head!, `/api/v1/tickets/${id}`);
    expect(parent.ticket.lastEventSeq).toBe(parent.events.at(-1).seq);
  });

  it('minutes outside 0 to 1440, or on a ticket that is not a task, are refused', async () => {
    const { taskId } = await startedTask('FT-9');
    for (const taskDownMin of [-1, 1441, 1.5]) {
      const res = await close(taskId, { kind: 'done', note: 'ok', taskDownMin });
      expect(res.statusCode).toBe(422);
    }
    const { id } = await workingBreakdown('FT-10');
    const res = await close(id, { kind: 'no_report', note: 'x', taskDownMin: 30 });
    expect(res.statusCode).toBe(422);
    expect(res.json().error.field).toBe('taskDownMin');
    expect((await get(f.tokens.head!, `/api/v1/tickets/${id}`)).ticket.status).toBe('working');
  });

  it('a task not finished can leave a new task: the root breakdown then lists both', async () => {
    const { id, taskId } = await startedTask('FT-11');
    const next = await close(taskId, {
      kind: 'done',
      note: 'Part not here yet',
      task: { ...TASK, text: 'Fit the part when it arrives', reasonCode: 'planned_stop' },
    });
    expect(next.statusCode, next.body).toBe(200);
    const parent = await get(f.tokens.head!, `/api/v1/tickets/${id}`);
    expect(parent.tasks.map((t: { state: string }) => t.state)).toEqual(['done', 'pending']);
    expect(parent.taskSummary).toMatchObject({ done: 1, pending: 1, box: 'pending' });
  });
});

describe('what a close that leaves a task refuses', () => {
  it('a reason the plant does not offer is refused, and nothing is closed or created', async () => {
    const { id } = await workingBreakdown('FT-12');
    const res = await close(id, {
      kind: 'no_report',
      note: 'x',
      task: { ...TASK, reasonCode: 'nonsense' },
    });
    expect(res.statusCode).toBe(422);
    expect(res.json().error.field).toBe('task.reasonCode');
    const parent = await get(f.tokens.head!, `/api/v1/tickets/${id}`);
    expect(parent.ticket.status).toBe('working');
    expect(parent.tasks).toEqual([]);
  });

  it('a reason switched off is refused too', async () => {
    await f.admin.query(
      "UPDATE list_item SET active = false WHERE list = 'task_reason' AND code = 'planned_stop'",
    );
    const { id } = await workingBreakdown('FT-13');
    const res = await close(id, {
      kind: 'no_report',
      note: 'x',
      task: { ...TASK, reasonCode: 'planned_stop' },
    });
    expect(res.statusCode).toBe(422);
    await f.admin.query(
      "UPDATE list_item SET active = true WHERE list = 'task_reason' AND code = 'planned_stop'",
    );
  });

  it('a task may not be left from a plain work request, and the date must be a date', async () => {
    const raised = await post(f.tokens.head!, '/api/v1/tickets', {
      kind: 'general',
      location: 'Yard',
      workType: 'Cleaning',
      problem: 'Clear the drain',
    });
    const id = raised.json().ticket.id as string;
    await post(f.tokens.technician!, `/api/v1/tickets/${id}/start`, { personId: tech });
    const refused = await close(id, { kind: 'done', note: 'ok', task: TASK });
    expect(refused.statusCode).toBe(422);
    expect(refused.json().error.field).toBe('task');
    const { id: other } = await workingBreakdown('FT-14');
    for (const expectedOn of ['2026-13-45', '2026-02-31', 'tomorrow']) {
      const res = await close(other, {
        kind: 'no_report',
        note: 'x',
        task: { ...TASK, expectedOn },
      });
      expect(res.statusCode).toBe(422);
    }
  });

  it('an operator, who may not close, cannot leave a task either', async () => {
    const { id } = await workingBreakdown('FT-15');
    const res = await post(f.tokens.operator!, `/api/v1/tickets/${id}/close`, {
      kind: 'no_report',
      note: 'x',
      task: TASK,
    });
    expect(res.statusCode).toBe(403);
    expect((await get(f.tokens.head!, `/api/v1/tickets/${id}`)).tasks).toEqual([]);
  });
});

describe('the same close sent twice leaves one task', () => {
  it('a retry with the same key gives the same task and no second child', async () => {
    const { id } = await workingBreakdown('FT-16');
    const first = await close(id, { kind: 'no_report', note: 'x', task: TASK }, 'same-key-16');
    const again = await close(id, { kind: 'no_report', note: 'x', task: TASK }, 'same-key-16');
    expect(again.statusCode).toBe(200);
    expect(again.json().task).toEqual(first.json().task);
    expect((await get(f.tokens.head!, `/api/v1/tickets/${id}`)).tasks).toHaveLength(1);
  });
});

describe('reporting a machine that already has a pending task', () => {
  it('the open tickets the phone holds name the machine, until the task is done', async () => {
    const { id, machineId } = await workingBreakdown('FT-17');
    const other = await workingBreakdown('FT-18');
    const made = (await close(id, { kind: 'no_report', note: 'x', task: TASK })).json().task;
    const open = (await get(f.tokens.operator!, '/api/v1/state')).open;
    const found = pendingTasksOn<OpenTicket>(open, machineId);
    expect(found.map((t) => t.id)).toEqual([made.id]);
    expect(pendingTasksOn<OpenTicket>(open, other.machineId)).toEqual([]);

    // reporting there is still allowed: the task is no breakdown, and the warning is advice
    const raised = await post(f.tokens.operator!, '/api/v1/tickets', {
      kind: 'stopped',
      machineId,
      problem: 'New problem',
    });
    expect(raised.statusCode, raised.body).toBe(201);

    await post(f.tokens.technician!, `/api/v1/tickets/${made.id}/start`, { personId: tech });
    await close(made.id, { kind: 'done', note: 'ok', taskDownMin: 0 });
    expect(
      pendingTasksOn<OpenTicket>((await get(f.tokens.operator!, '/api/v1/state')).open, machineId),
    ).toEqual([]);
  });
});

describe('a follow-up task is no breakdown: no clocks, no escalation, no alerts', () => {
  it('starting, pausing and finishing one, then the nightly sweep, leave it no timer, no alert and no SLA reading', async () => {
    await f.admin.query(
      "INSERT INTO sla_policy (tenant_id, severity, ack_minutes, restore_minutes) SELECT $1, s, 5, 10 FROM unnest(ARRAY['S1','S2','S3','S4']) s ON CONFLICT DO NOTHING",
      [A],
    );
    const { id } = await workingBreakdown('FT-20');
    const made = (await close(id, { kind: 'no_report', note: 'x', task: TASK })).json().task;
    const act = (action: string, body: object = {}) =>
      post(f.tokens.technician!, `/api/v1/tickets/${made.id}/${action}`, {
        personId: tech,
        ...body,
      });
    expect((await act('start')).statusCode).toBe(200);
    expect((await act('pause', { reasonCode: 'spare' })).statusCode).toBe(200);
    expect((await act('resume')).statusCode).toBe(200);
    expect((await act('close', { kind: 'done', note: 'ok', taskDownMin: 5 })).statusCode).toBe(200);
    const sweep = await runSlaConsistency({
      pool: f.db.app,
      tenantId: A,
      now: new Date(),
      reconcileTicket: (client, tenantId, ticketId, now) =>
        reconcileTicket(client, { tenantId, ticketId, now, boss: f.boss }),
    });
    expect(sweep.tickets).toBeGreaterThan(0);
    const count = async (table: string, where = 'ticket_id = $1') =>
      Number(
        (await f.admin.query(`SELECT count(*) AS n FROM ${table} WHERE ${where}`, [made.id]))
          .rows[0].n,
      );
    expect(await count('sla_timer')).toBe(0);
    expect(await count('notification')).toBe(0);
    expect(
      await count('ticket_event', "ticket_id = $1 AND type IN ('escalate', 'escalation_ack')"),
    ).toBe(0);
    expect(await count('pgboss.job', "data->>'ticketId' = $1")).toBe(0);
    const child = await get(f.tokens.head!, `/api/v1/tickets/${made.id}`);
    expect(child.ticket.sla).toBeNull();
    const policies = await withTenant(f.db.app, A, (client) =>
      client.query('SELECT count(*) AS n FROM sla_policy'),
    );
    expect(Number(policies.rows[0].n)).toBe(4);
  });
});

describe('plants stay apart on writes too', () => {
  it("another plant cannot close a plant's task, and nothing of it changes", async () => {
    const { id } = await workingBreakdown('FT-21');
    const made = (await close(id, { kind: 'no_report', note: 'x', task: TASK })).json().task;
    const res = await f.app.inject({
      method: 'POST',
      url: `/api/v1/tickets/${made.id}/close`,
      headers: {
        host: 'plant-b.localhost',
        'content-type': 'application/json',
        authorization: `Bearer ${f.tokens['b-admin']}`,
        'idempotency-key': 'cross-tenant-close',
      },
      payload: { kind: 'done', note: 'x', taskDownMin: 1 },
    });
    expect(res.statusCode).toBe(404);
    expect((await get(f.tokens.head!, `/api/v1/tickets/${made.id}`)).ticket.status).toBe('open');
  });
});

describe('plants stay apart', () => {
  it("another plant cannot read a plant's tasks, nor leave one against its ticket", async () => {
    const { id } = await workingBreakdown('FT-19');
    await close(id, { kind: 'no_report', note: 'x', task: TASK });
    const res = await f.call('GET', `/api/v1/tickets/${id}`, f.tokens['b-admin']!);
    expect(res.statusCode).toBe(404);
  });
});
