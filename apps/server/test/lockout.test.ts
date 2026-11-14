import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_LOCKOUT_STEPS } from '@uptimo/shared';
import { PASSWORD, startFixture, type Fixture, type Res } from './plant-settings-fixture.js';

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

async function flag(list: string, code: string, needsLockout: boolean) {
  const made = await f.call('POST', `${LISTS}/${list}`, f.tokens.head!, {
    code,
    label: code,
    needsLockout,
  });
  expect(made.statusCode, made.body).toBe(201);
  return made.json().id as string;
}

/** An "other work" ticket of the given work type, raised by the head. */
async function raiseWork(workType: string, extra: object = {}): Promise<string> {
  const res = await send(f.tokens.head!, '/api/v1/tickets', {
    kind: 'general',
    location: 'Boiler house',
    workType,
    problem: 'Panel humming',
    ...extra,
  });
  expect(res.statusCode, res.body).toBe(201);
  return res.json().ticket.id as string;
}

const ticketOf = async (id: string) =>
  (await f.call('GET', `/api/v1/tickets/${id}`, f.tokens.head!)).json();
const lockoutOf = async (id: string) => (await ticketOf(id)).ticket.lockout;
const who = async (id: string) =>
  ((await lockoutOf(id))?.confirmations ?? []).map((c: { byPersonId: string }) => c.byPersonId);

const act = (
  action: string,
  id: string,
  personId: string,
  as: { token?: string; extra?: object; key?: string } = {},
) =>
  send(
    as.token ?? f.tokens.technician!,
    `/api/v1/tickets/${id}/${action}`,
    { personId, ...as.extra },
    as.key,
  );
const confirm = (
  id: string,
  personId: string,
  stepCodes: string[],
  as: { token?: string; key?: string } = {},
) => act('lockout-confirm', id, personId, { ...as, extra: { stepCodes } });

/** The session's own person confirms: no `personId` in the body. */
const confirmAsSelf = (id: string, stepCodes: string[], token = f.tokens.technician!) =>
  send(token, `/api/v1/tickets/${id}/lockout-confirm`, { stepCodes });

const DEFAULT_CODES = DEFAULT_LOCKOUT_STEPS.map((s) => s.code);

let tech: string;
let sup: string;
let head: string;
let admin: string;
beforeAll(async () => {
  tech = await personOf('plant-a-technician');
  sup = await personOf('plant-a-supervisor');
  head = await personOf('plant-a-head');
  admin = await personOf('plant-a-admin');
  await flag('work_type', 'Electrical', true);
  await flag('work_type', 'Civil', false);
});

/** Confirmed by the technician and started: a flagged ticket being worked. */
async function working(workType = 'Electrical'): Promise<string> {
  const id = await raiseWork(workType);
  expect((await confirm(id, tech, DEFAULT_CODES)).statusCode).toBe(200);
  expect((await act('start', id, tech)).statusCode).toBe(200);
  return id;
}

describe('a flagged work type refuses Start until the lockout steps are confirmed', () => {
  it('refuses Start with lockout_required and the steps, then starts after the confirmation', async () => {
    const id = await raiseWork('Electrical');
    const before = await ticketOf(id);
    expect(before.ticket.lockout).toEqual({
      steps: DEFAULT_LOCKOUT_STEPS.map((s) => ({ ...s, labelGu: null, labelHi: null })),
      confirmations: [],
    });

    const refused = await act('start', id, tech);
    expect(refused.statusCode, refused.body).toBe(409);
    expect(refused.json().error).toMatchObject({ code: 'lockout_required' });
    expect(refused.json().error.steps).toHaveLength(4);
    const unchanged = await ticketOf(id);
    expect(unchanged.ticket.status).toBe('open');
    expect(unchanged.events).toHaveLength(before.events.length);

    const confirmed = await confirm(id, tech, DEFAULT_CODES);
    expect(confirmed.statusCode, confirmed.body).toBe(200);
    expect(confirmed.json().ticket.lockout.confirmations).toEqual([
      expect.objectContaining({ byPersonId: tech }),
    ]);
    expect((await act('start', id, tech)).statusCode).toBe(200);
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
    expect(detail.ticket.lockout.confirmations).toEqual([{ at: entry.at, byPersonId: tech }]);
  });

  it('wants every step; a step that is no longer there is "steps_changed"; both answer with the current steps', async () => {
    const id = await raiseWork('Electrical');
    const partial = await confirm(id, tech, DEFAULT_CODES.slice(1));
    expect(partial.statusCode).toBe(422);
    expect(partial.json().error).toMatchObject({ code: 'validation', field: 'stepCodes' });
    expect(partial.json().error.steps).toHaveLength(4);
    const stale = await confirm(id, tech, [...DEFAULT_CODES, 'invented']);
    expect(stale.statusCode).toBe(422);
    expect(stale.json().error).toMatchObject({ code: 'steps_changed' });
    expect(stale.json().error.steps).toHaveLength(4);
    expect(await who(id)).toEqual([]);
  });

  it('refuses a second confirmation by the same person, and one on a ticket that needs none', async () => {
    const id = await raiseWork('Electrical');
    expect((await confirm(id, tech, DEFAULT_CODES)).statusCode).toBe(200);
    expect((await confirm(id, tech, DEFAULT_CODES)).statusCode).toBe(409);
    const plain = await raiseWork('Civil');
    expect((await confirm(plain, tech, DEFAULT_CODES)).statusCode).toBe(409);
  });

  it('an operator, who may not work a ticket, gets 403 on Start and on confirming, not a lockout answer', async () => {
    const id = await raiseWork('Electrical');
    const operator = await personOf('plant-a-operator');
    const as = { token: f.tokens.operator! };
    expect((await act('start', id, operator, as)).statusCode).toBe(403);
    expect((await confirm(id, operator, DEFAULT_CODES, as)).statusCode).toBe(403);
  });

  it('a Start dated before the confirmation is refused', async () => {
    const id = await raiseWork('Electrical');
    await confirm(id, tech, DEFAULT_CODES);
    const early = new Date(Date.now() - 60_000).toISOString();
    const res = await act('start', id, tech, { extra: { at: early } });
    expect(res.statusCode, res.body).toBe(422);
    expect(res.json().error.field).toBe('at');
    expect((await ticketOf(id)).ticket.status).toBe('open');
  });
});

describe('a ticket that needs no lockout starts as before', () => {
  it('starts at once, and its reply carries no lockout', async () => {
    const id = await raiseWork('Civil');
    expect(await lockoutOf(id)).toBeNull();
    const started = await act('start', id, tech);
    expect(started.statusCode).toBe(200);
    expect(started.json().ticket.lockout).toBeNull();
  });

  it('a work type the plant has not listed is never gated, and a listed one matches by name, not by spacing or capitals', async () => {
    const typed = await raiseWork('Origami');
    expect((await act('start', typed, tech)).statusCode).toBe(200);
    const spaced = await raiseWork('  electrical ');
    expect(await lockoutOf(spaced)).not.toBeNull();
    expect((await act('start', spaced, tech)).json().error.code).toBe('lockout_required');
  });

  it('a stopped-machine ticket is not gated: its category is only known at close', async () => {
    const machine = (
      await f.call('POST', '/api/v1/machines', f.tokens.head!, { code: 'LK-1' })
    ).json();
    const raised = await send(f.tokens.head!, '/api/v1/tickets', {
      kind: 'stopped',
      machineId: machine.id,
      problem: 'Stopped',
    });
    expect(raised.json().ticket.lockout).toBeNull();
    expect((await act('start', raised.json().ticket.id, tech)).statusCode).toBe(200);
  });
});

describe('the flag is read when the command is asked for', () => {
  it('a work type flagged after the ticket was raised gates it, and clearing the flag frees it', async () => {
    const itemId = await flag('work_type', 'Welding', false);
    const id = await raiseWork('Welding');
    const set = await f.call('PUT', `${LISTS}/work_type/${itemId}`, f.tokens.head!, {
      needsLockout: true,
    });
    expect(set.json().needsLockout).toBe(true);
    expect((await act('start', id, tech)).json().error?.code).toBe('lockout_required');
    const cleared = await f.call('PUT', `${LISTS}/work_type/${itemId}`, f.tokens.head!, {
      needsLockout: false,
    });
    expect(cleared.json().needsLockout).toBe(false);
    expect((await act('start', id, tech)).statusCode).toBe(200);
  });

  it('raising with "start now" on a flagged work type leaves the ticket open and asks for the lockout', async () => {
    const raise = (workType: string) =>
      send(f.tokens.technician!, '/api/v1/tickets', {
        kind: 'general',
        location: 'Boiler house',
        workType,
        problem: 'Panel humming',
        startNow: true,
      });
    const res = await raise('Electrical');
    expect(res.statusCode, res.body).toBe(201);
    expect(res.json().ticket).toMatchObject({ status: 'open', selfStarted: false });
    expect(res.json().ticket.lockout).toMatchObject({ confirmations: [] });
    const types = (await ticketOf(res.json().ticket.id)).events.map(
      (e: { type: string }) => e.type,
    );
    expect(types).not.toContain('start');

    const plain = await raise('Civil');
    expect(plain.json().ticket).toMatchObject({ status: 'working', lockout: null });
  });
});

describe('every person confirms their own lock', () => {
  it('one person confirming does not let another start', async () => {
    const id = await raiseWork('Electrical');
    await confirm(id, tech, DEFAULT_CODES);
    const other = await act('start', id, sup, { token: f.tokens.supervisor! });
    expect(other.statusCode, other.body).toBe(409);
    expect(other.json().error.code).toBe('lockout_required');
    expect((await act('start', id, tech)).statusCode).toBe(200);
  });

  it('a joiner confirms on the working ticket, then joins', async () => {
    const id = await working();
    const as = { token: f.tokens.supervisor!, extra: { role: 'support' } };
    expect((await act('join', id, sup, as)).json().error.code).toBe('lockout_required');
    expect((await lockoutOf(id)).confirmations).toHaveLength(1);
    const own = await confirm(id, sup, DEFAULT_CODES, { token: f.tokens.supervisor! });
    expect(own.statusCode, own.body).toBe(200);
    expect(await who(id)).toEqual([tech, sup]);
    expect((await act('join', id, sup, as)).statusCode).toBe(200);
  });

  it('a person who leaves takes their lock off, and the others keep theirs', async () => {
    const id = await working();
    await confirm(id, sup, DEFAULT_CODES, { token: f.tokens.supervisor! });
    await act('join', id, sup, { token: f.tokens.supervisor!, extra: { role: 'support' } });
    const left = await act('leave', id, sup, {
      token: f.tokens.supervisor!,
      extra: { reason: 'Called away' },
    });
    expect(left.statusCode, left.body).toBe(200);
    expect(await who(id)).toEqual([tech]);
  });
});

describe('a confirmation is cleared when the ticket stops being worked or changes hands', () => {
  it('a pause takes it off, and the resume needs a fresh confirmation', async () => {
    const id = await working();
    const paused = await act('pause', id, tech, { extra: { reasonCode: 'spare' } });
    expect(paused.statusCode, paused.body).toBe(200);
    expect(paused.json().ticket.lockout.confirmations).toEqual([]);
    const refused = await act('resume', id, tech);
    expect(refused.statusCode).toBe(409);
    expect(refused.json().error.code).toBe('lockout_required');
    expect((await confirm(id, tech, DEFAULT_CODES)).statusCode).toBe(200);
    expect((await act('resume', id, tech)).statusCode).toBe(200);
  });

  it('a ticket handed over and picked up by someone else asks that person to confirm', async () => {
    const id = await working();
    const moved = await act('transfer', id, tech, {
      extra: { toPersonId: sup, note: 'End of shift' },
    });
    expect(moved.statusCode, moved.body).toBe(200);
    expect(moved.json().ticket.lockout.confirmations).toEqual([]);
    const as = { token: f.tokens.supervisor! };
    expect((await act('start', id, sup, as)).json().error.code).toBe('lockout_required');
    expect((await confirm(id, sup, DEFAULT_CODES, as)).statusCode).toBe(200);
    expect((await act('start', id, sup, as)).statusCode).toBe(200);
  });

  it('a cancel then a restore to working clears the lock, shows it as needed, and takes a new one', async () => {
    const id = await working();
    const cancel = await send(f.tokens.head!, `/api/v1/tickets/${id}/cancel`, {
      personId: head,
      reason: 'Raised by mistake',
    });
    expect(cancel.statusCode, cancel.body).toBe(200);
    const restore = await send(f.tokens.admin!, `/api/v1/tickets/${id}/restore`, {
      personId: admin,
      reason: 'It was real',
    });
    expect(restore.statusCode, restore.body).toBe(200);
    expect(restore.json().ticket.status).toBe('working');
    expect(restore.json().ticket.lockout.confirmations).toEqual([]);
    expect((await confirm(id, tech, DEFAULT_CODES)).statusCode).toBe(200);
    expect(await who(id)).toEqual([tech]);
  });

  it('a fix that production disputes reopens the ticket with the lock off, and its stored category gates it', async () => {
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
    expect((await act('start', id, tech)).statusCode).toBe(200);
    const closed = await act('close', id, tech, {
      extra: {
        kind: 'report',
        report: { correctiveAction: 'Replaced contactor', breakdownCategory: 'E' },
      },
    });
    expect(closed.statusCode, closed.body).toBe(200);
    const disputed = await send(f.tokens.head!, `/api/v1/tickets/${id}/handback`, {
      personId: head,
      response: 'disputed',
      reason: 'Still trips',
    });
    expect(disputed.statusCode, disputed.body).toBe(200);
    expect(disputed.json().ticket.status).toBe('working');
    expect(disputed.json().ticket.lockout).toMatchObject({ confirmations: [] });
    expect((await confirm(id, tech, DEFAULT_CODES)).statusCode).toBe(200);
    expect(await who(id)).toEqual([tech]);
  });
});

describe('a resume needs everyone who will be working afterwards', () => {
  /** The technician leads and the supervisor is crew; the technician pauses, which takes both locks off. */
  async function pausedCrew(): Promise<string> {
    const id = await working();
    const supAs = { token: f.tokens.supervisor! };
    await confirm(id, sup, DEFAULT_CODES, supAs);
    expect((await act('join', id, sup, { ...supAs, extra: { role: 'support' } })).statusCode).toBe(
      200,
    );
    expect((await act('pause', id, tech, { extra: { reasonCode: 'spare' } })).statusCode).toBe(200);
    return id;
  }

  it('the lead alone confirming does not restart the crew member: the 409 names who is missing', async () => {
    const id = await pausedCrew();
    await confirm(id, tech, DEFAULT_CODES);
    const refused = await act('resume', id, tech);
    expect(refused.statusCode, refused.body).toBe(409);
    expect(refused.json().error).toMatchObject({ code: 'lockout_required', missing: [sup] });
    expect((await ticketOf(id)).ticket.status).toBe('waiting');
    await confirm(id, sup, DEFAULT_CODES, { token: f.tokens.supervisor! });
    expect((await act('resume', id, tech)).statusCode).toBe(200);
  });

  it('a crew member resuming does not restart the lead unconfirmed', async () => {
    const id = await pausedCrew();
    const supAs = { token: f.tokens.supervisor! };
    await confirm(id, sup, DEFAULT_CODES, supAs);
    const refused = await act('resume', id, sup, supAs);
    expect(refused.statusCode, refused.body).toBe(409);
    expect(refused.json().error).toMatchObject({ code: 'lockout_required', missing: [tech] });
    await confirm(id, tech, DEFAULT_CODES);
    expect((await act('resume', id, sup, supAs)).statusCode).toBe(200);
  });

  it('a crew member who has left does not block the resume', async () => {
    const id = await working();
    const supAs = { token: f.tokens.supervisor! };
    await confirm(id, sup, DEFAULT_CODES, supAs);
    await act('join', id, sup, { ...supAs, extra: { role: 'support' } });
    await act('leave', id, sup, { ...supAs, extra: { reason: 'Called away' } });
    await act('pause', id, tech, { extra: { reasonCode: 'spare' } });
    await confirm(id, tech, DEFAULT_CODES);
    expect((await act('resume', id, tech)).statusCode).toBe(200);
  });
});

describe('a confirmation must cover the steps as they are now', () => {
  it('a step added after someone confirmed makes their confirmation stale until they confirm again', async () => {
    const id = await raiseWork('Electrical');
    expect((await confirm(id, tech, DEFAULT_CODES)).statusCode).toBe(200);
    const added = await f.call('POST', `${LISTS}/lockout_step`, f.tokens.head!, {
      code: 'verify_zero',
      label: 'Verify zero energy',
      sort: '9',
    });
    expect(added.statusCode, added.body).toBe(201);
    expect((await lockoutOf(id)).confirmations).toEqual([]);
    const refused = await act('start', id, tech);
    expect(refused.json().error.code).toBe('lockout_required');
    expect((await confirm(id, tech, DEFAULT_CODES)).statusCode).toBe(422);
    expect((await confirm(id, tech, [...DEFAULT_CODES, 'verify_zero'])).statusCode).toBe(200);
    expect((await act('start', id, tech)).statusCode).toBe(200);
    await f.call('PUT', `${LISTS}/lockout_step/${added.json().id}`, f.tokens.head!, {
      active: false,
    });
  });
});

describe('who is confirming comes from the session', () => {
  it("a confirmation with no personId is the signed-in person's own", async () => {
    const id = await raiseWork('Electrical');
    const res = await confirmAsSelf(id, DEFAULT_CODES);
    expect(res.statusCode, res.body).toBe(200);
    expect(await who(id)).toEqual([tech]);
  });
});

describe('who may set the flag and edit the steps', () => {
  it('the head sets and clears the flag on a work type, and it is audited', async () => {
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

  it('the head finds the four starting steps as ordinary rows, edits one, and the edit is audited and never overwritten', async () => {
    const read = async () =>
      (await f.call('GET', `${LISTS}/lockout_step`, f.tokens.head!)).json().items as {
        id: string;
        code: string;
        label: string;
        active: boolean;
      }[];
    const items = (await read()).filter((i) => i.active);
    expect(items.map((i) => i.code)).toEqual(DEFAULT_CODES);
    const first = items[0]!;
    const edit = await f.call('PUT', `${LISTS}/lockout_step/${first.id}`, f.tokens.head!, {
      label: 'Isolate every supply',
      labelGu: 'બધા સપ્લાય અલગ કરો',
    });
    expect(edit.statusCode, edit.body).toBe(200);
    const audit = await f.admin.query(
      "SELECT count(*)::int AS n FROM audit_log WHERE entity_id = $1 AND action = 'list_item.update'",
      [first.id],
    );
    expect(audit.rows[0].n).toBe(1);

    const id = await raiseWork('Electrical');
    const steps = (await lockoutOf(id)).steps;
    expect(steps[0]).toEqual({
      code: 'isolate',
      label: 'Isolate every supply',
      labelGu: 'બધા સપ્લાય અલગ કરો',
      labelHi: null,
    });
    expect((await read())[0]!.label).toBe('Isolate every supply');
    await f.call('PUT', `${LISTS}/lockout_step/${first.id}`, f.tokens.head!, {
      label: DEFAULT_LOCKOUT_STEPS[0].label,
    });
  });

  it('a step switched off after the steps were shown makes the old list "steps_changed"', async () => {
    const id = await raiseWork('Electrical');
    const shown = (await lockoutOf(id)).steps as { code: string }[];
    const last = (await f.call('GET', `${LISTS}/lockout_step`, f.tokens.head!))
      .json()
      .items.find((i: { code: string }) => i.code === 'tell_nearby');
    await f.call('PUT', `${LISTS}/lockout_step/${last.id}`, f.tokens.head!, { active: false });
    const res = await confirm(
      id,
      tech,
      shown.map((s) => s.code),
    );
    expect(res.statusCode).toBe(422);
    expect(res.json().error.code).toBe('steps_changed');
    expect(res.json().error.steps).toHaveLength(3);
    expect((await confirm(id, tech, DEFAULT_CODES.slice(0, 3))).statusCode).toBe(200);
    await f.call('PUT', `${LISTS}/lockout_step/${last.id}`, f.tokens.head!, { active: true });
  });

  it('with every step switched off a flagged ticket cannot be started or confirmed: it fails closed', async () => {
    const items = (await f.call('GET', `${LISTS}/lockout_step`, f.tokens.head!))
      .json()
      .items.filter((i: { active: boolean }) => i.active) as { id: string }[];
    for (const item of items) {
      await f.call('PUT', `${LISTS}/lockout_step/${item.id}`, f.tokens.head!, { active: false });
    }
    const id = await raiseWork('Electrical');
    const start = await act('start', id, tech);
    expect(start.statusCode).toBe(409);
    expect(start.json().error.code).toBe('lockout_steps_missing');
    const sent = await confirm(id, tech, DEFAULT_CODES);
    expect(sent.json().error.code).toBe('lockout_steps_missing');
    const plain = await raiseWork('Civil');
    expect((await act('start', plain, tech)).statusCode).toBe(200);
    for (const item of items) {
      await f.call('PUT', `${LISTS}/lockout_step/${item.id}`, f.tokens.head!, { active: true });
    }
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

  it('the confirmation is credited to the person signed in on the shared phone, and nobody else', async () => {
    const phone = await sharedTechnicianToken();
    const id = await raiseWork('Electrical');
    const other = await confirm(id, sup, DEFAULT_CODES, { token: phone });
    expect(other.statusCode, other.body).toBe(403);
    expect(await who(id)).toEqual([]);
    const res = await confirm(id, tech, DEFAULT_CODES, { token: phone });
    expect(res.statusCode, res.body).toBe(200);
    expect(await who(id)).toEqual([tech]);
    const entry = (await ticketOf(id)).events.find(
      (e: { type: string }) => e.type === 'lockout_confirmed',
    );
    expect(entry.actingPersonId).toBe(tech);
  });

  it('a personal login cannot credit the confirmation to someone else', async () => {
    const id = await raiseWork('Electrical');
    const res = await confirm(id, sup, DEFAULT_CODES);
    expect(res.statusCode).toBe(403);
    expect(await who(id)).toEqual([]);
  });

  it("another plant cannot see or confirm this plant's ticket, and has steps of its own", async () => {
    const id = await raiseWork('Electrical');
    const other = await personOf('plant-b-admin');
    const res = await confirm(id, other, DEFAULT_CODES, { token: f.tokens['b-admin']! });
    expect(res.statusCode).toBe(404);
    expect(await who(id)).toEqual([]);
    const b = await f.call('GET', `${LISTS}/lockout_step`, f.tokens['b-admin']!);
    expect(b.json().items.map((i: { code: string }) => i.code)).toEqual(DEFAULT_CODES);
    const bWork = await f.call('GET', `${LISTS}/work_type`, f.tokens['b-admin']!);
    expect(bWork.json().items).toEqual([]);
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
    expect((await act('start', id, tech, { key: startKey })).statusCode).toBe(200);
    expect((await act('start', id, tech, { key: startKey })).statusCode).toBe(200);
    const types = (await ticketOf(id)).events.map((e: { type: string }) => e.type);
    expect(types.filter((t: string) => t === 'lockout_confirmed')).toHaveLength(1);
    expect(types.filter((t: string) => t === 'start')).toHaveLength(1);
  });
});
