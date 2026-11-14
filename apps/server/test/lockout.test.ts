import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_LOCKOUT_STEPS } from '@uptimo/shared';
import { A, PASSWORD, startFixture, type Fixture, type Res } from './plant-settings-fixture.js';

let f: Fixture;
beforeAll(async () => {
  f = await startFixture();
}, 180_000);
afterAll(async () => f.stop());

const LISTS = '/api/v1/settings/lists';
const personOf = async (username: string) =>
  (await f.admin.query('SELECT person_id FROM login WHERE username = $1', [username])).rows[0]
    .person_id as string;

const send = (
  token: string,
  url: string,
  payload: object,
  key: string = randomUUID(),
): Promise<Res> =>
  f.app.inject({
    method: 'POST',
    url,
    headers: {
      host: token === f.tokens['b-admin'] ? 'plant-b.localhost' : 'plant-a.localhost',
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
      'idempotency-key': key,
    },
    payload,
  });

async function flag(list: string, code: string, needsLockout: boolean, label = code) {
  const made = await f.call('POST', `${LISTS}/${list}`, f.tokens.head!, {
    code,
    label,
    needsLockout,
  });
  expect(made.statusCode, made.body).toBe(201);
  return made.json().id as string;
}

/** An "other work" ticket of the given work type, raised by the head. */
async function raiseWork(workType: string): Promise<string> {
  const res = await send(f.tokens.head!, '/api/v1/tickets', {
    kind: 'general',
    location: 'Boiler house',
    workType,
    problem: 'Panel humming',
  });
  expect(res.statusCode, res.body).toBe(201);
  return res.json().ticket.id as string;
}

const ticketOf = async (id: string) =>
  (await f.call('GET', `/api/v1/tickets/${id}`, f.tokens.head!)).json();

const start = (id: string, personId: string, token = f.tokens.technician!, key?: string) =>
  send(token, `/api/v1/tickets/${id}/start`, { personId }, key);

const confirm = (
  id: string,
  personId: string,
  stepCodes: string[],
  as: { token?: string; key?: string } = {},
) =>
  send(
    as.token ?? f.tokens.technician!,
    `/api/v1/tickets/${id}/lockout-confirm`,
    { personId, stepCodes },
    as.key,
  );

const DEFAULT_CODES = DEFAULT_LOCKOUT_STEPS.map((s) => s.code);

let tech: string;
beforeAll(async () => {
  tech = await personOf('plant-a-technician');
  await flag('work_type', 'Electrical', true);
  await flag('work_type', 'Civil', false);
});

describe('a flagged work type refuses Start until the lockout steps are confirmed', () => {
  it('refuses Start with a lockout_required code, shows the steps, then starts after the confirmation', async () => {
    const id = await raiseWork('Electrical');
    const before = await ticketOf(id);
    expect(before.ticket.lockout).toEqual({
      steps: DEFAULT_LOCKOUT_STEPS.map((s) => ({ ...s, labelGu: null, labelHi: null })),
      confirmed: null,
    });

    const refused = await start(id, tech);
    expect(refused.statusCode, refused.body).toBe(409);
    expect(refused.json().error.code).toBe('lockout_required');
    const unchanged = await ticketOf(id);
    expect(unchanged.ticket.status).toBe('open');
    expect(unchanged.events).toHaveLength(before.events.length);

    const confirmed = await confirm(id, tech, DEFAULT_CODES);
    expect(confirmed.statusCode, confirmed.body).toBe(200);
    expect(confirmed.json().ticket.lockout.confirmed).toMatchObject({ byPersonId: tech });
    expect((await start(id, tech)).statusCode).toBe(200);
    expect((await ticketOf(id)).ticket.status).toBe('working');
  });

  it('records who confirmed and when in the history, with the steps as worded then', async () => {
    const id = await raiseWork('Electrical');
    const t0 = Date.now();
    await confirm(id, tech, DEFAULT_CODES);
    const detail = await ticketOf(id);
    const entry = detail.events.find((e: { type: string }) => e.type === 'lockout_confirmed');
    expect(entry.actingPersonId).toBe(tech);
    expect(entry.text).toBe(DEFAULT_LOCKOUT_STEPS.map((s) => s.label).join('; '));
    expect(Math.abs(new Date(entry.at).getTime() - t0)).toBeLessThan(60_000);
    expect(detail.ticket.lockout.confirmed).toEqual({ at: entry.at, byPersonId: tech });
  });

  it("wants every step, and only this plant's steps, named", async () => {
    const id = await raiseWork('Electrical');
    for (const stepCodes of [
      DEFAULT_CODES.slice(1),
      [...DEFAULT_CODES, 'invented'],
      ['invented'],
    ]) {
      const res = await confirm(id, tech, stepCodes);
      expect(res.statusCode, JSON.stringify(stepCodes)).toBe(422);
    }
    expect((await ticketOf(id)).ticket.lockout.confirmed).toBeNull();
  });

  it('refuses a second confirmation, and one on a ticket that needs none', async () => {
    const id = await raiseWork('Electrical');
    expect((await confirm(id, tech, DEFAULT_CODES)).statusCode).toBe(200);
    expect((await confirm(id, tech, DEFAULT_CODES)).statusCode).toBe(409);
    const plain = await raiseWork('Civil');
    expect((await confirm(plain, tech, DEFAULT_CODES)).statusCode).toBe(409);
  });

  it('an operator may not confirm (only whoever may work a ticket)', async () => {
    const id = await raiseWork('Electrical');
    const res = await confirm(id, await personOf('plant-a-operator'), DEFAULT_CODES, {
      token: f.tokens.operator!,
    });
    expect(res.statusCode).toBe(403);
  });
});

describe('a ticket that needs no lockout starts as before', () => {
  it('starts at once, and its reply carries no lockout', async () => {
    const id = await raiseWork('Civil');
    expect((await ticketOf(id)).ticket.lockout).toBeNull();
    const started = await start(id, tech);
    expect(started.statusCode).toBe(200);
    expect(started.json().ticket.lockout).toBeNull();
  });

  it('a stopped-machine ticket with no category yet is never gated', async () => {
    const machine = (
      await f.call('POST', '/api/v1/machines', f.tokens.head!, { code: 'LK-1' })
    ).json();
    const raised = await send(f.tokens.head!, '/api/v1/tickets', {
      kind: 'stopped',
      machineId: machine.id,
      problem: 'Stopped',
    });
    expect((await ticketOf(raised.json().ticket.id)).ticket.lockout).toBeNull();
    expect((await start(raised.json().ticket.id, tech)).statusCode).toBe(200);
  });
});

describe('the flag is read when Start is asked for', () => {
  it('a work type flagged after the ticket was raised gates it, and clearing the flag frees it', async () => {
    const itemId = await flag('work_type', 'Welding', false);
    const id = await raiseWork('Welding');
    const set = await f.call('PUT', `${LISTS}/work_type/${itemId}`, f.tokens.head!, {
      needsLockout: true,
    });
    expect(set.json().needsLockout).toBe(true);
    expect((await start(id, tech)).json().error?.code).toBe('lockout_required');
    const cleared = await f.call('PUT', `${LISTS}/work_type/${itemId}`, f.tokens.head!, {
      needsLockout: false,
    });
    expect(cleared.json().needsLockout).toBe(false);
    expect((await start(id, tech)).statusCode).toBe(200);
  });

  it("a flagged breakdown category on the ticket's stored report gates Start too", async () => {
    await flag('breakdown_category', 'E', true);
    const machine = (
      await f.call('POST', '/api/v1/machines', f.tokens.head!, { code: 'LK-2' })
    ).json();
    const raised = await send(f.tokens.head!, '/api/v1/tickets', {
      kind: 'stopped',
      machineId: machine.id,
      problem: 'Tripping',
    });
    const id = raised.json().ticket.id as string;
    await f.admin.query(
      `INSERT INTO breakdown_report (tenant_id, ticket_id, machine_id, date, shift_code, problem, breakdown_category)
       VALUES ($1, $2, $3, current_date, 'DAY', 'Tripping', 'E')`,
      [A, id, machine.id],
    );
    expect((await ticketOf(id)).ticket.lockout).not.toBeNull();
    expect((await start(id, tech)).json().error?.code).toBe('lockout_required');
    expect((await confirm(id, tech, DEFAULT_CODES)).statusCode).toBe(200);
    expect((await start(id, tech)).statusCode).toBe(200);
  });
});

describe('a confirmation is used by one Start', () => {
  it('a pause and a resume do not ask again', async () => {
    const id = await raiseWork('Electrical');
    await confirm(id, tech, DEFAULT_CODES);
    await start(id, tech);
    const paused = await send(f.tokens.technician!, `/api/v1/tickets/${id}/pause`, {
      personId: tech,
      reasonCode: 'spare',
    });
    expect(paused.statusCode, paused.body).toBe(200);
    const resumed = await send(f.tokens.technician!, `/api/v1/tickets/${id}/resume`, {
      personId: tech,
    });
    expect(resumed.statusCode, resumed.body).toBe(200);
  });

  it('a ticket handed over, then picked up by someone else, asks that person to confirm', async () => {
    const id = await raiseWork('Electrical');
    await confirm(id, tech, DEFAULT_CODES);
    await start(id, tech);
    const to = await personOf('plant-a-supervisor');
    const moved = await send(f.tokens.technician!, `/api/v1/tickets/${id}/transfer`, {
      personId: tech,
      toPersonId: to,
      note: 'End of shift',
    });
    expect(moved.statusCode, moved.body).toBe(200);
    const pickup = await start(id, to, f.tokens.supervisor!);
    expect(pickup.statusCode, pickup.body).toBe(409);
    expect(pickup.json().error.code).toBe('lockout_required');
    expect((await confirm(id, to, DEFAULT_CODES, { token: f.tokens.supervisor! })).statusCode).toBe(
      200,
    );
    expect((await start(id, to, f.tokens.supervisor!)).statusCode).toBe(200);
  });

  it('a cancelled then restored ticket asks again', async () => {
    const id = await raiseWork('Electrical');
    await confirm(id, tech, DEFAULT_CODES);
    const cancel = await send(f.tokens.head!, `/api/v1/tickets/${id}/cancel`, {
      personId: await personOf('plant-a-head'),
      reason: 'Raised by mistake',
    });
    expect(cancel.statusCode, cancel.body).toBe(200);
    const restore = await send(f.tokens.admin!, `/api/v1/tickets/${id}/restore`, {
      personId: await personOf('plant-a-admin'),
      reason: 'It was real',
    });
    expect(restore.statusCode, restore.body).toBe(200);
    expect((await ticketOf(id)).ticket.lockout.confirmed).toBeNull();
    expect((await start(id, tech)).json().error?.code).toBe('lockout_required');
  });
});

describe('who may set the flag and edit the steps', () => {
  it('the head sets and clears the flag on a work type and a breakdown category, and it is audited', async () => {
    const id = await flag('work_type', 'Crane', false);
    for (const needsLockout of [true, false]) {
      const res = await f.call('PUT', `${LISTS}/work_type/${id}`, f.tokens.head!, { needsLockout });
      expect(res.json()).toMatchObject({ needsLockout });
    }
    const audit = await f.admin.query(
      "SELECT count(*)::int AS n FROM audit_log WHERE entity = 'list_item' AND entity_id = $1 AND action = 'list_item.update'",
      [id],
    );
    expect(audit.rows[0].n).toBe(2);
    const read = await f.call('GET', `${LISTS}/work_type`, f.tokens.admin!);
    expect(read.json().items.find((i: { id: string }) => i.id === id).needsLockout).toBe(false);
  });

  it('a technician cannot set the flag or edit the steps', async () => {
    const id = await flag('work_type', 'Pump', false);
    const set = await f.call('PUT', `${LISTS}/work_type/${id}`, f.tokens.technician!, {
      needsLockout: true,
    });
    expect(set.statusCode).toBe(403);
    const step = await f.call('POST', `${LISTS}/lockout_step`, f.tokens.technician!, {
      code: 'x',
      label: 'x',
    });
    expect(step.statusCode).toBe(403);
    const read = await f.call('GET', `${LISTS}/work_type`, f.tokens.head!);
    expect(read.json().items.find((i: { id: string }) => i.id === id).needsLockout).toBe(false);
  });

  it('any other list refuses the flag', async () => {
    const res = await f.call('POST', `${LISTS}/wait_reason`, f.tokens.head!, {
      code: 'lk-wait',
      label: 'Waiting',
      needsLockout: true,
    });
    expect(res.statusCode).toBe(422);
    expect(res.json().error.field).toBe('needsLockout');
  });

  it("the plant's own steps replace the defaults, are audited, and are what must be confirmed", async () => {
    const one = await f.call('POST', `${LISTS}/lockout_step`, f.tokens.head!, {
      code: 'isolate_all',
      label: 'Isolate every supply',
      labelGu: 'બધા સપ્લાય અલગ કરો',
      sort: '1',
    });
    expect(one.statusCode, one.body).toBe(201);
    const two = await f.call('POST', `${LISTS}/lockout_step`, f.tokens.head!, {
      code: 'verify',
      label: 'Verify dead',
      sort: '2',
    });
    const audit = await f.admin.query(
      "SELECT count(*)::int AS n FROM audit_log WHERE entity = 'list_item' AND action = 'list_item.create' AND entity_id = ANY($1)",
      [[one.json().id, two.json().id]],
    );
    expect(audit.rows[0].n).toBe(2);

    const id = await raiseWork('Electrical');
    expect((await ticketOf(id)).ticket.lockout.steps).toEqual([
      {
        code: 'isolate_all',
        label: 'Isolate every supply',
        labelGu: 'બધા સપ્લાય અલગ કરો',
        labelHi: null,
      },
      { code: 'verify', label: 'Verify dead', labelGu: null, labelHi: null },
    ]);
    expect((await confirm(id, tech, DEFAULT_CODES)).statusCode).toBe(422);
    expect((await confirm(id, tech, ['isolate_all', 'verify'])).statusCode).toBe(200);
    const entry = (await ticketOf(id)).events.find(
      (e: { type: string }) => e.type === 'lockout_confirmed',
    );
    expect(entry.text).toBe('Isolate every supply; Verify dead');

    for (const row of [one, two]) {
      await f.call('PUT', `${LISTS}/lockout_step/${row.json().id}`, f.tokens.head!, {
        active: false,
      });
    }
    const after = await raiseWork('Electrical');
    expect(
      (await ticketOf(after)).ticket.lockout.steps.map((s: { code: string }) => s.code),
    ).toEqual(DEFAULT_CODES);
  });
});

describe('who is credited on a shared phone, and across plants', () => {
  async function sharedTechnicianToken(): Promise<string> {
    await f.admin.query(
      `INSERT INTO login (tenant_id, person_id, username, password_hash, role, shared)
       SELECT l.tenant_id, l.person_id, 'plant-a-shared-tech', l.password_hash, 'technician', true FROM login l
        WHERE l.username = 'plant-a-technician'`,
    );
    const res = await f.app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { host: 'plant-a.localhost', 'content-type': 'application/json' },
      payload: { username: 'plant-a-shared-tech', password: PASSWORD, actingPersonId: tech },
    });
    expect(res.statusCode, res.body).toBe(200);
    return res.json().token as string;
  }

  it('the confirmation is credited to the person chosen on the shared phone', async () => {
    const phone = await sharedTechnicianToken();
    const chosen = await personOf('plant-a-supervisor');
    const id = await raiseWork('Electrical');
    const res = await confirm(id, chosen, DEFAULT_CODES, { token: phone });
    expect(res.statusCode, res.body).toBe(200);
    expect(res.json().ticket.lockout.confirmed.byPersonId).toBe(chosen);
    const entry = (await ticketOf(id)).events.find(
      (e: { type: string }) => e.type === 'lockout_confirmed',
    );
    expect(entry.actingPersonId).toBe(chosen);
  });

  it('a personal login cannot credit the confirmation to someone else', async () => {
    const id = await raiseWork('Electrical');
    const res = await confirm(id, await personOf('plant-a-supervisor'), DEFAULT_CODES);
    expect(res.statusCode).toBe(403);
    expect((await ticketOf(id)).ticket.lockout.confirmed).toBeNull();
  });

  it("another plant cannot see or confirm this plant's ticket, and its own steps stay its own", async () => {
    const id = await raiseWork('Electrical');
    const res = await confirm(id, await personOf('plant-b-admin'), DEFAULT_CODES, {
      token: f.tokens['b-admin']!,
    });
    expect(res.statusCode).toBe(404);
    expect((await ticketOf(id)).ticket.lockout.confirmed).toBeNull();
    const b = await f.call('GET', `${LISTS}/work_type`, f.tokens['b-admin']!);
    expect(b.json().items).toEqual([]);
  });
});

describe('a replayed command', () => {
  it('a repeated confirmation and a repeated Start (same key) write one history entry each', async () => {
    const id = await raiseWork('Electrical');
    const key = randomUUID();
    const first = await confirm(id, tech, DEFAULT_CODES, { key });
    const again = await confirm(id, tech, DEFAULT_CODES, { key });
    expect(again.statusCode).toBe(200);
    expect(again.json()).toEqual(first.json());
    const startKey = randomUUID();
    expect((await start(id, tech, f.tokens.technician!, startKey)).statusCode).toBe(200);
    expect((await start(id, tech, f.tokens.technician!, startKey)).statusCode).toBe(200);
    const types = (await ticketOf(id)).events.map((e: { type: string }) => e.type);
    expect(types.filter((t: string) => t === 'lockout_confirmed')).toHaveLength(1);
    expect(types.filter((t: string) => t === 'start')).toHaveLength(1);
  });
});
