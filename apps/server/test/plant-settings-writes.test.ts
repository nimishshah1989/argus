import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  GROUP_A,
  ITEM_A,
  M_B,
  M_FREE,
  SEG_A,
  SHIFT_A,
  TERM_A,
  startFixture,
  type Fixture,
} from './plant-settings-fixture.js';

let f: Fixture;
beforeAll(async () => {
  f = await startFixture();
}, 180_000);
afterAll(async () => f.stop());

/** The audit lines a caller of the (future) audit screen would read: action, who, before and after. */
async function audits(entity: string, id: string) {
  const rows = await f.admin.query(
    `SELECT a.action, a.before, a.after, l.username FROM audit_log a
       LEFT JOIN login l ON l.id = a.login_id
      WHERE a.entity = $1 AND a.entity_id = $2 ORDER BY a.at, a.id`,
    [entity, id],
  );
  type Values = Record<string, unknown> | null;
  return rows.rows as Array<{ action: string; before: Values; after: Values; username: string }>;
}

const head = () => f.tokens.head!;

/** The plant's own today (these plants run on Asia/Kolkata) and day arithmetic: no date is typed into a test. */
const plantToday = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
const addDays = (day: string, n: number) =>
  new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const moves = async (id: string) =>
  (await f.call('GET', `/api/v1/machines/${id}/moves`, head())).json();

describe('machines', () => {
  it('creates, edits and lists a machine, each write audited with who and before/after', async () => {
    const made = await f.call('POST', '/api/v1/machines', head(), {
      code: 'VC-77',
      segmentId: SEG_A,
      groupId: GROUP_A,
      cell: 'Cell 2',
      category: 'VMC',
      criticality: 'C',
    });
    expect(made.statusCode).toBe(201);
    const machine = made.json();
    expect(machine).toMatchObject({
      code: 'VC-77',
      cell: 'Cell 2',
      criticality: 'C',
      status: 'active',
    });
    const edited = await f.call('PUT', `/api/v1/machines/${machine.id}`, f.tokens.admin!, {
      category: 'HMC',
    });
    expect(edited.json().category).toBe('HMC');
    const lines = await audits('machine', machine.id);
    expect(lines.map((l) => [l.action, l.username])).toEqual([
      ['machine.create', 'plant-a-head'],
      ['machine.update', 'plant-a-admin'],
    ]);
    expect(lines[1]!.before).toMatchObject({ category: 'VMC' });
    expect(lines[1]!.after).toMatchObject({ category: 'HMC' });
    const listed = (await f.call('GET', '/api/v1/machines', head())).json().items;
    expect(listed.find((m: { id: string }) => m.id === machine.id).category).toBe('HMC');
  });

  it('refuses a duplicate code, a bad value and an unknown field with the field named', async () => {
    const dup = await f.call('POST', '/api/v1/machines', head(), { code: 'VC-01' });
    expect(dup.statusCode).toBe(409);
    const bad = await f.call('POST', '/api/v1/machines', head(), { code: 'Z-1', status: 'broken' });
    expect(bad.statusCode).toBe(422);
    expect(bad.json().error.field).toBe('status');
    const extra = await f.call('PUT', `/api/v1/machines/${M_FREE}`, head(), { tenantId: 'x' });
    expect(extra.statusCode).toBe(422);
    const orphan = await f.call('PUT', `/api/v1/machines/${M_FREE}`, head(), { segmentId: null });
    expect(orphan.statusCode, 'a group without its segment').toBe(422);
  });

  it('criticality is edited through the machines API and audited with before and after', async () => {
    const edit = await f.call('PUT', `/api/v1/machines/${M_FREE}/criticality`, head(), {
      criticality: 'A',
    });
    expect(edit.statusCode).toBe(200);
    const row = (await f.call('GET', '/api/v1/machines', head()))
      .json()
      .items.find((m: { id: string }) => m.id === M_FREE);
    expect(row.criticality).toBe('A');
    const line = (await audits('machine', M_FREE)).find((l) => l.action === 'machine.criticality');
    expect(line).toMatchObject({
      username: 'plant-a-head',
      before: { criticality: 'B' },
      after: { criticality: 'A' },
    });
  });

  it('a screen cannot change criticality through the general edit (severity would not refresh)', async () => {
    const res = await f.call('PUT', `/api/v1/machines/${M_FREE}`, head(), { criticality: 'C' });
    expect(res.statusCode).toBe(422);
    expect(res.json().error.field).toBe('criticality');
  });
});

describe('a cell change writes one dated machine move', () => {
  it('records from, to and the effective date, and shows it on the moves read', async () => {
    expect(await moves(M_FREE)).toEqual([]);
    const firstDay = addDays(plantToday(), -13);
    const res = await f.call('PUT', `/api/v1/machines/${M_FREE}`, head(), {
      cell: 'Cell 4',
      effectiveFrom: firstDay,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().cell).toBe('Cell 4');
    expect(await moves(M_FREE)).toEqual([
      expect.objectContaining({
        fromCell: 'Cell 1',
        toCell: 'Cell 4',
        effectiveFrom: firstDay,
      }),
    ]);
    const line = (await audits('machine', M_FREE)).find((l) => l.after?.cell === 'Cell 4');
    expect(line).toMatchObject({
      action: 'machine.update',
      username: 'plant-a-head',
      before: { cell: 'Cell 1' },
    });
  });

  it('an edit that leaves the cell alone writes no move, and a move defaults to today', async () => {
    const before = (await moves(M_FREE)).length;
    await f.call('PUT', `/api/v1/machines/${M_FREE}`, head(), {
      category: 'Lathe',
      cell: 'Cell 4',
    });
    expect(await moves(M_FREE)).toHaveLength(before);
    await f.call('PUT', `/api/v1/machines/${M_FREE}`, head(), { cell: 'Cell 5' });
    const latest = (await moves(M_FREE))[0];
    expect(latest).toMatchObject({ fromCell: 'Cell 4', toCell: 'Cell 5' });
    expect(latest.effectiveFrom).toBe(
      new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }),
    );
  });

  it('refuses an effective date that is not a date', async () => {
    const res = await f.call('PUT', `/api/v1/machines/${M_FREE}`, head(), {
      cell: 'Cell 6',
      effectiveFrom: 'soon',
    });
    expect(res.statusCode).toBe(422);
    expect(
      (await f.call('GET', '/api/v1/machines', head()))
        .json()
        .items.find((m: { id: string }) => m.id === M_FREE).cell,
    ).toBe('Cell 5');
  });
});

describe('segments, groups and shifts', () => {
  it('hiding a group and a segment is visible in the config the board reads, and audited', async () => {
    const group = await f.call('PUT', `/api/v1/groups/${GROUP_A}`, head(), { hidden: true });
    expect(group.json().hidden).toBe(true);
    const seg = await f.call('PUT', `/api/v1/segments/${SEG_A}`, head(), { showOnBoard: false });
    expect(seg.json().showOnBoard).toBe(false);
    const config = (await f.call('GET', '/api/v1/config', f.tokens.operator!)).json();
    expect(config.groups.find((g: { id: string }) => g.id === GROUP_A).hidden).toBe(true);
    expect(config.segments.find((s: { id: string }) => s.id === SEG_A).show_on_board).toBe(false);
    expect((await audits('machine_group', GROUP_A)).pop()).toMatchObject({
      action: 'group.update',
      before: { hidden: false },
      after: { hidden: true },
    });
    expect((await audits('segment', SEG_A)).pop()).toMatchObject({
      action: 'segment.update',
      after: { showOnBoard: false },
    });
  });

  it('creates a segment and a group, refusing a repeated code', async () => {
    const seg = await f.call('POST', '/api/v1/segments', head(), {
      code: 'ROBOT',
      name: 'Robot',
      sort: 5,
    });
    expect(seg.statusCode).toBe(201);
    const group = await f.call('POST', '/api/v1/groups', head(), {
      segmentId: seg.json().id,
      code: 'ARM',
      name: 'Arms',
    });
    expect(group.statusCode).toBe(201);
    expect(group.json()).toMatchObject({ hidden: false, code: 'ARM' });
    expect(
      (await f.call('POST', '/api/v1/segments', head(), { code: 'ROBOT', name: 'Again' }))
        .statusCode,
    ).toBe(409);
    expect((await audits('segment', seg.json().id))[0]!.action).toBe('segment.create');
    expect((await audits('machine_group', group.json().id))[0]!.action).toBe('group.create');
  });

  it('creates a shift that crosses midnight and edits its name, keeping its code', async () => {
    const night = await f.call('POST', '/api/v1/shifts', head(), {
      code: 'NIGHT',
      name: 'Night',
      startsAt: '18:29',
      endsAt: '05:00',
    });
    expect(night.statusCode).toBe(201);
    expect(night.json()).toMatchObject({
      startsAt: '18:29',
      endsAt: '05:00',
      crossesMidnight: true,
    });
    const day = await f.call('PUT', `/api/v1/shifts/${SHIFT_A}`, head(), {
      name: 'Day shift',
      endsAt: '18:00',
    });
    expect(day.json()).toMatchObject({
      code: 'DAY',
      name: 'Day shift',
      endsAt: '18:00',
      crossesMidnight: false,
    });
    expect(
      (await f.call('PUT', `/api/v1/shifts/${SHIFT_A}`, head(), { code: 'RENAMED' })).statusCode,
    ).toBe(422);
    expect(
      (
        await f.call('POST', '/api/v1/shifts', head(), {
          code: 'BAD',
          name: 'Bad',
          startsAt: '08:00',
          endsAt: '08:00',
        })
      ).statusCode,
    ).toBe(422);
    expect((await audits('shift', SHIFT_A)).pop()).toMatchObject({
      action: 'shift.update',
      before: { name: 'Day' },
    });
  });
});

describe('the one contract the generated screen uses (PUT, active, strings)', () => {
  it('a form that sends every field back as text, unchanged, changes nothing and writes nothing', async () => {
    const machine = (await f.call('GET', '/api/v1/machines', head()))
      .json()
      .items.find((m: { id: string }) => m.id === M_FREE);
    const form = Object.fromEntries(
      Object.entries(machine).map(([k, v]) => [
        k,
        v === null ? '' : typeof v === 'boolean' ? v : String(v),
      ]),
    );
    delete form.id; // a form sends its listed fields and `active`, not the row's id
    const before = await f.admin.query('SELECT count(*)::int AS n FROM audit_log');
    const res = await f.call('PUT', `/api/v1/machines/${M_FREE}`, head(), form);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual(machine);
    const after = await f.admin.query('SELECT count(*)::int AS n FROM audit_log');
    expect(after.rows[0].n).toBe(before.rows[0].n);
  });

  it('numbers and switches sent as text are understood; a fixed code can be sent back but not changed', async () => {
    const res = await f.call('PUT', `/api/v1/segments/${SEG_A}`, head(), {
      code: 'CNC',
      name: 'CNC machines',
      sort: '7',
      showOnBoard: 'true',
      active: true,
    });
    expect(res.json()).toMatchObject({ name: 'CNC machines', sort: 7, showOnBoard: true });
    const rename = await f.call('PUT', `/api/v1/segments/${SEG_A}`, head(), { code: 'OTHER' });
    expect(rename.statusCode).toBe(422);
    expect(rename.json().error.field).toBe('code');
  });

  it('active switches a group to hidden and back', async () => {
    const group = await f.call('PUT', `/api/v1/groups/${GROUP_A}`, head(), { active: false });
    expect(group.json()).toMatchObject({ hidden: true, active: false });
    const back = await f.call('PUT', `/api/v1/groups/${GROUP_A}`, head(), { active: true });
    expect(back.json()).toMatchObject({ hidden: false, active: true });
  });

  it('switches a shift off and on, and the floor’s config stops offering it meanwhile', async () => {
    const codes = async () =>
      (await f.call('GET', '/api/v1/config', f.tokens.operator!))
        .json()
        .shifts.map((s: { id: string }) => s.id);
    expect(await codes()).toContain(SHIFT_A);
    const off = await f.call('PUT', `/api/v1/shifts/${SHIFT_A}`, head(), { active: false });
    expect(off.statusCode).toBe(200);
    expect(off.json()).toMatchObject({ active: false });
    expect(await codes()).not.toContain(SHIFT_A);
    const on = await f.call('PUT', `/api/v1/shifts/${SHIFT_A}`, head(), { active: true });
    expect(on.json()).toMatchObject({ active: true });
    expect(await codes()).toContain(SHIFT_A);
  });

  it('switches a segment off and on once no machine in it is in service; refuses while one is', async () => {
    const refused = await f.call('PUT', `/api/v1/segments/${SEG_A}`, head(), { active: false });
    expect(refused.statusCode).toBe(409);
    expect(refused.json().error.field).toBe('active');
    const made = await f.call('POST', '/api/v1/segments', head(), {
      code: 'SPARE',
      name: 'Spare segment',
    });
    const id = made.json().id as string;
    const segmentIds = async () =>
      (await f.call('GET', '/api/v1/config', f.tokens.operator!))
        .json()
        .segments.map((s: { id: string }) => s.id);
    expect(await segmentIds()).toContain(id);
    const off = await f.call('PUT', `/api/v1/segments/${id}`, head(), { active: false });
    expect(off.statusCode).toBe(200);
    expect(off.json()).toMatchObject({ active: false });
    expect(await segmentIds()).not.toContain(id);
    expect(
      (await f.call('PUT', `/api/v1/segments/${id}`, head(), { active: true })).json(),
    ).toMatchObject({
      active: true,
    });
  });

  it('keeps machines and groups out of a segment that is switched off', async () => {
    const made = await f.call('POST', '/api/v1/segments', head(), {
      code: 'CLOSED',
      name: 'Closed',
    });
    const closed = made.json().id as string;
    expect(
      (await f.call('PUT', `/api/v1/segments/${closed}`, head(), { active: false })).statusCode,
    ).toBe(200);

    const create = await f.call('POST', '/api/v1/machines', head(), {
      code: 'NEW-1',
      segmentId: closed,
    });
    expect(create.statusCode).toBe(422);
    expect(create.json().error.field).toBe('segmentId');
    const move = await f.call('PUT', `/api/v1/machines/${M_FREE}`, head(), { segmentId: closed });
    expect(move.statusCode).toBe(422);
    const group = await f.call('POST', '/api/v1/groups', head(), {
      segmentId: closed,
      code: 'G-OFF',
      name: 'Off',
    });
    expect(group.statusCode).toBe(422);

    // A scrapped machine of that segment cannot be put back in service while the segment is off.
    await f.call('PUT', `/api/v1/segments/${closed}`, head(), { active: true });
    const scrapped = await f.call('POST', '/api/v1/machines', head(), {
      code: 'OLD-1',
      segmentId: closed,
      status: 'scrapped',
    });
    expect(scrapped.statusCode).toBe(201);
    await f.call('PUT', `/api/v1/segments/${closed}`, head(), { active: false });
    const back = await f.call('PUT', `/api/v1/machines/${scrapped.json().id}`, head(), {
      active: true,
    });
    expect(back.statusCode).toBe(422);
    expect(back.json().error.field).toBe('segmentId');

    // Back on, the segment takes them again.
    await f.call('PUT', `/api/v1/segments/${closed}`, head(), { active: true });
    expect(
      (await f.call('POST', '/api/v1/machines', head(), { code: 'NEW-2', segmentId: closed }))
        .statusCode,
    ).toBe(201);
  });

  it('switches a glossary term off and on', async () => {
    const off = await f.call('PUT', `/api/v1/settings/glossary/${TERM_A}`, head(), {
      active: false,
    });
    expect(off.statusCode).toBe(200);
    expect(off.json()).toMatchObject({ active: false });
    const on = await f.call('PUT', `/api/v1/settings/glossary/${TERM_A}`, head(), { active: true });
    expect(on.json()).toMatchObject({ active: true });
  });
});

describe('lists and the glossary', () => {
  const list = '/api/v1/settings/lists/wait_reason';

  it('adds, edits, switches off and on a list entry; each change audited; the code stays', async () => {
    const made = await f.call('POST', list, head(), {
      code: 'vendor',
      label: 'Sent to vendor',
      isVendor: 'true',
      pausesSla: true,
      sort: '2',
    });
    expect(made.statusCode).toBe(201);
    expect(made.json()).toMatchObject({
      code: 'vendor',
      isVendor: true,
      pausesSla: true,
      sort: 2,
      active: true,
    });
    const id = made.json().id as string;
    const edit = await f.call('PUT', `${list}/${id}`, head(), {
      code: 'vendor',
      label: 'Vendor',
      labelGu: 'વેન્ડર',
    });
    expect(edit.json()).toMatchObject({ label: 'Vendor', labelGu: 'વેન્ડર' });
    expect((await f.call('PUT', `${list}/${id}`, head(), { code: 'other' })).statusCode).toBe(422);
    const off = await f.call('PUT', `${list}/${id}`, head(), { active: false });
    expect(off.json().active).toBe(false);
    expect((await f.call('PUT', `${list}/${id}`, head(), { active: true })).json().active).toBe(
      true,
    );
    const lines = await audits('list_item', id);
    expect(lines.map((l) => l.action)).toEqual([
      'list_item.create',
      'list_item.update',
      'list_item.update',
      'list_item.update',
    ]);
    expect(lines[2]).toMatchObject({ before: { active: true }, after: { active: false } });
    expect(lines.every((l) => l.username === 'plant-a-head')).toBe(true);
  });

  it('a switched-off entry leaves the config the floor reads and stays in the settings list', async () => {
    await f.call('PUT', `${list}/${ITEM_A}`, head(), { active: false });
    const config = (await f.call('GET', '/api/v1/config', f.tokens.operator!)).json();
    expect(config.lists.wait_reason.find((i: { id: string }) => i.id === ITEM_A).active).toBe(
      false,
    );
    const listed = (await f.call('GET', list, head())).json().items;
    expect(listed.find((i: { id: string }) => i.id === ITEM_A)).toMatchObject({
      active: false,
      label: 'Waiting for spare',
    });
  });

  it('refuses a repeated code with 409 and a missing label with the field named', async () => {
    expect((await f.call('POST', list, head(), { code: 'spare', label: 'Again' })).statusCode).toBe(
      409,
    );
    const bad = await f.call('POST', list, head(), { code: 'x' });
    expect(bad.statusCode).toBe(422);
    expect(bad.json().error.field).toBe('label');
  });

  it('adds and edits a glossary term, audited', async () => {
    const made = await f.call('POST', '/api/v1/settings/glossary', head(), {
      source: 'તૂટ્યું',
      english: 'broke',
    });
    expect(made.statusCode).toBe(201);
    expect(made.json()).toMatchObject({ direction: 'gu', active: true });
    const edit = await f.call('PUT', `/api/v1/settings/glossary/${made.json().id}`, head(), {
      english: 'broken',
    });
    expect(edit.json().english).toBe('broken');
    expect((await audits('glossary_term', made.json().id)).map((l) => l.action)).toEqual([
      'glossary.create',
      'glossary.update',
    ]);
    const dup = await f.call('POST', '/api/v1/settings/glossary', head(), {
      source: 'તૂટ્યું',
      english: 'again',
    });
    expect(dup.statusCode).toBe(409);
  });
});

describe('settings writes are audited', () => {
  it('the feature switches and the AI cap each leave a before/after line; an unchanged value leaves none', async () => {
    const put = (key: string, value: unknown, token = head()) =>
      f.call('PUT', `/api/v1/settings/${key}`, token, { value });
    expect((await put('features', { general: true, pause: false })).statusCode).toBe(200);
    expect((await put('features', { general: true, pause: false })).statusCode).toBe(200);
    expect((await put('ai.monthlyCapUsd', 5, f.tokens.admin!)).statusCode).toBe(200);
    expect((await put('ai.monthlyCapUsd', 5, head())).statusCode).toBe(403);
    const rows = await f.admin.query(
      "SELECT before, after, l.username FROM audit_log a JOIN login l ON l.id = a.login_id WHERE a.action = 'setting.update' ORDER BY a.at",
    );
    expect(rows.rows).toEqual([
      {
        before: { key: 'features', value: null },
        after: { key: 'features', value: { general: true, pause: false } },
        username: 'plant-a-head',
      },
      {
        before: { key: 'ai.monthlyCapUsd', value: null },
        after: { key: 'ai.monthlyCapUsd', value: 5 },
        username: 'plant-a-admin',
      },
    ]);
  });
});

/** A raise the way the floor phone sends it: JSON with a repeat-guard key. */
let keys = 0;
const raise = (token: string, payload: object) =>
  f.app.inject({
    method: 'POST',
    url: '/api/v1/tickets',
    headers: {
      host: 'plant-a.localhost',
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
      'idempotency-key': `review-${(keys += 1)}`,
    },
    payload,
  });
const newMachine = async (code: string, extra: object = {}) =>
  (await f.call('POST', '/api/v1/machines', head(), { code, cell: 'Cell 1', ...extra })).json();

describe('switching a machine off is blocked while it is needed', () => {
  it('answers 409 while a breakdown is open on it, and works once the ticket is closed', async () => {
    const machine = await newMachine('SW-1');
    await f.admin.query(
      "INSERT INTO ticket (tenant_id, ref, kind, status, machine_id, problem, reported_at, severity) VALUES ((SELECT tenant_id FROM machine WHERE id = $1), 'BD-0900', 'stopped', 'open', $1, 'Spindle', now(), 'S3')",
      [machine.id],
    );
    const blocked = await f.call('PUT', `/api/v1/machines/${machine.id}`, head(), {
      active: false,
    });
    expect(blocked.statusCode).toBe(409);
    expect(blocked.json().error).toMatchObject({ code: 'conflict', field: 'active' });
    const stillOn = (await f.call('GET', '/api/v1/config', f.tokens.operator!)).json().machines;
    expect(stillOn.map((m: { id: string }) => m.id)).toContain(machine.id);
    await f.admin.query("UPDATE ticket SET status = 'cancelled' WHERE machine_id = $1", [
      machine.id,
    ]);
    const off = await f.call('PUT', `/api/v1/machines/${machine.id}`, head(), { active: false });
    expect(off.statusCode).toBe(200);
  });

  it('a phone that still offers a switched-off machine cannot raise a ticket on it (422), and can once it is back on', async () => {
    const machine = await newMachine('SW-2');
    await f.call('PUT', `/api/v1/machines/${machine.id}`, head(), { active: false });
    const refused = await raise(f.tokens.operator!, { machineId: machine.id, problem: 'Noise' });
    expect(refused.statusCode).toBe(422);
    expect(refused.json().error).toMatchObject({ code: 'validation', field: 'machineId' });
    await f.call('PUT', `/api/v1/machines/${machine.id}`, head(), { active: true });
    const again = await raise(f.tokens.operator!, { machineId: machine.id, problem: 'Noise' });
    expect(again.statusCode).toBe(201);
  });
});

describe('a cell change keeps the history in order', () => {
  it('refuses a date that does not exist, a future date, and a date before the last move', async () => {
    const machine = await newMachine('MV-1');
    const put = (body: object) => f.call('PUT', `/api/v1/machines/${machine.id}`, head(), body);
    const today = plantToday();
    for (const bad of ['2026-02-30', '2026-13-01', '2026-00-10']) {
      const res = await put({ cell: 'Cell 2', effectiveFrom: bad });
      expect(res.statusCode, bad).toBe(422);
      expect(res.json().error.field).toBe('effectiveFrom');
    }
    const future = await put({ cell: 'Cell 2', effectiveFrom: addDays(today, 1) });
    expect(future.statusCode).toBe(422);
    const lastMove = addDays(today, -3);
    expect((await put({ cell: 'Cell 2', effectiveFrom: lastMove })).statusCode).toBe(200);
    const early = await put({ cell: 'Cell 3', effectiveFrom: addDays(today, -9) });
    expect(early.statusCode).toBe(422);
    expect(early.json().error.message).toContain(lastMove);
    expect((await put({ cell: 'Cell 3', effectiveFrom: lastMove })).statusCode).toBe(200);
    expect((await put({ cell: 'Cell 4', effectiveFrom: today })).statusCode).toBe(200);
    expect(await moves(machine.id)).toHaveLength(3);
  });

  it('two cell changes at the same moment each write their own move, one after the other', async () => {
    const machine = await newMachine('MV-2');
    const put = (cell: string) => f.call('PUT', `/api/v1/machines/${machine.id}`, head(), { cell });
    const [a, b] = await Promise.all([put('Cell 8'), put('Cell 9')]);
    expect([a.statusCode, b.statusCode]).toEqual([200, 200]);
    const list = (await moves(machine.id)) as Array<{ fromCell: string; toCell: string }>;
    expect(list).toHaveLength(2);
    const first = list.find((m) => m.fromCell === 'Cell 1')!;
    const second = list.find((m) => m.fromCell === first.toCell)!;
    expect(second).toBeDefined();
    const final = (await f.call('GET', '/api/v1/machines', head()))
      .json()
      .items.find((m: { id: string }) => m.id === machine.id);
    expect(final.cell).toBe(second.toCell);
  });
});

describe('an admin corrects a cell move date within the plant bounds', () => {
  const day = (offset: number) => addDays(plantToday(), offset);
  const correct = (
    machineId: string,
    moveId: string,
    effectiveFrom: string,
    token = f.tokens.admin!,
  ) => f.call('PATCH', `/api/v1/machines/${machineId}/moves/${moveId}`, token, { effectiveFrom });
  /** A fresh machine with one move per offset (newest first on the read), so the bounds are real. */
  const history = async (code: string, offsets: number[] = [-10, -5, -2]) => {
    const machine = await newMachine(code);
    for (const [i, offset] of offsets.entries()) {
      const edited = await f.call('PUT', `/api/v1/machines/${machine.id}`, head(), {
        cell: `Cell ${i + 2}`,
        effectiveFrom: day(offset),
      });
      expect(edited.statusCode).toBe(200);
    }
    type Move = { id: string; effectiveFrom: string; fromCell: string; toCell: string };
    const list = (await moves(machine.id)) as Move[];
    return { machine, list, newest: list[0]!, middle: list[1]! };
  };
  const rowOf = async (id: string) =>
    (
      await f.admin.query('SELECT effective_from::text AS day FROM machine_move WHERE id = $1', [
        id,
      ])
    ).rows[0].day as string;

  it('admin corrects the date: the row and updated_at change, and the audit names machine, move and old → new', async () => {
    const { machine, middle } = await history('CM-1');
    const target = day(-8);
    await f.admin.query(
      "UPDATE machine_move SET updated_at = now() - interval '1 day' WHERE id = $1",
      [middle.id],
    );
    const stamp = async () =>
      (await f.admin.query('SELECT updated_at FROM machine_move WHERE id = $1', [middle.id]))
        .rows[0].updated_at as Date;
    const before = await stamp();
    const res = await correct(machine.id, middle.id, target);
    expect(res.statusCode, res.body).toBe(200);
    expect(res.json()).toEqual({
      move: {
        id: middle.id,
        machineId: machine.id,
        fromCell: middle.fromCell,
        toCell: middle.toCell,
        effectiveFrom: target,
      },
    });
    expect(await rowOf(middle.id)).toBe(target);
    expect((await stamp()).getTime()).toBeGreaterThan(before.getTime());
    const line = (await audits('machine', machine.id)).find(
      (l) => l.action === 'machine.move.correct',
    );
    expect(line).toMatchObject({
      username: 'plant-a-admin',
      before: {
        machineId: machine.id,
        moveId: middle.id,
        fromCell: middle.fromCell,
        toCell: middle.toCell,
        effectiveFrom: middle.effectiveFrom,
      },
      after: {
        machineId: machine.id,
        moveId: middle.id,
        fromCell: middle.fromCell,
        toCell: middle.toCell,
        effectiveFrom: target,
      },
    });
  });

  it('a head may correct a date too', async () => {
    const { machine, newest } = await history('CM-2', [-12, -6]);
    const res = await correct(machine.id, newest.id, day(-10), head());
    expect(res.statusCode).toBe(200);
    expect(res.json().move.effectiveFrom).toBe(day(-10));
  });

  it('an operator and a technician are refused', async () => {
    const { machine, newest } = await history('CM-3', [-4]);
    for (const token of [f.tokens.operator!, f.tokens.technician!]) {
      expect((await correct(machine.id, newest.id, day(-6), token)).statusCode).toBe(403);
    }
  });

  it("another tenant's move id is not found", async () => {
    const moved = await f.call('PUT', `/api/v1/machines/${M_B}`, f.tokens['b-admin']!, {
      cell: 'Cell 10',
      effectiveFrom: day(-3),
    });
    expect(moved.statusCode).toBe(200);
    const bMoves = (
      await f.call('GET', `/api/v1/machines/${M_B}/moves`, f.tokens['b-admin']!)
    ).json();
    const bMove = bMoves[0] as { id: string };
    expect((await correct(M_B, bMove.id, day(-4))).statusCode).toBe(404);
    const mine = await newMachine('CM-4');
    expect((await correct(mine.id, bMove.id, day(-4))).statusCode).toBe(404);
  });

  it('a future date is refused, naming effectiveFrom', async () => {
    const { machine, newest } = await history('CM-5', [-1]);
    const res = await correct(machine.id, newest.id, day(1));
    expect(res.statusCode).toBe(422);
    expect(res.json().error).toMatchObject({ code: 'validation', field: 'effectiveFrom' });
    expect(await rowOf(newest.id)).toBe(newest.effectiveFrom);
  });

  it('a date before the previous move, or after the next, is refused so the history keeps its order', async () => {
    const { machine, list, middle } = await history('CM-6');
    const early = await correct(machine.id, middle.id, addDays(list[2]!.effectiveFrom, -1));
    expect(early.statusCode).toBe(422);
    expect(early.json().error.field).toBe('effectiveFrom');
    const late = await correct(machine.id, middle.id, addDays(list[0]!.effectiveFrom, 1));
    expect(late.statusCode).toBe(422);
    expect(late.json().error.field).toBe('effectiveFrom');
    expect(await rowOf(middle.id)).toBe(middle.effectiveFrom);
  });

  it('a same-date correction answers 200 and writes no audit line', async () => {
    const { machine, newest } = await history('CM-7', [-3]);
    const before = (await audits('machine', machine.id)).length;
    const res = await correct(machine.id, newest.id, newest.effectiveFrom);
    expect(res.statusCode).toBe(200);
    expect(res.json().move.effectiveFrom).toBe(newest.effectiveFrom);
    expect((await audits('machine', machine.id)).length).toBe(before);
  });

  it('the analytics figures cell change log shows the corrected date', async () => {
    const { machine, newest } = await history('CM-8', [-6]);
    const target = day(-9);
    expect((await correct(machine.id, newest.id, target)).statusCode).toBe(200);
    const figures = (await f.call('GET', '/api/v1/analytics/figures', head())).json()
      .figures as Array<{
      key: string;
      value: { moves: Array<{ id: string; machineId: string; date: string }> };
    }>;
    const log = figures.find((figure) => figure.key === 'cell-change-log')!;
    expect(log.value.moves.find((move) => move.id === newest.id)).toMatchObject({
      machineId: machine.id,
      date: target,
    });
  });
});

describe('links and logins', () => {
  it('refuses a machine whose group belongs to another segment of the same plant', async () => {
    const other = (
      await f.call('POST', '/api/v1/segments', head(), { code: 'ODD', name: 'Odd' })
    ).json();
    const group = (
      await f.call('POST', '/api/v1/groups', head(), {
        segmentId: other.id,
        code: 'ODDG',
        name: 'Odd group',
      })
    ).json();
    const created = await f.call('POST', '/api/v1/machines', head(), {
      code: 'LK-1',
      segmentId: SEG_A,
      groupId: group.id,
    });
    expect(created.statusCode).toBe(422);
    expect(created.json().error.field).toBe('groupId');
    const m = await newMachine('LK-2', { segmentId: SEG_A });
    const moved = await f.call('PUT', `/api/v1/machines/${m.id}`, head(), { groupId: group.id });
    expect(moved.statusCode).toBe(422);
  });

  it('a shared login follows its role: a shared operator is refused, a shared head may write', async () => {
    const refused = await f.call('PUT', `/api/v1/segments/${SEG_A}`, f.tokens['shared-operator']!, {
      name: 'Shared',
    });
    expect(refused.statusCode).toBe(403);
    const allowed = await f.call('PUT', `/api/v1/segments/${SEG_A}`, f.tokens['shared-head']!, {
      name: 'CNC machines',
    });
    expect(allowed.statusCode).toBe(200);
  });

  it('a malformed id is not found, never a server error', async () => {
    for (const [method, url, body] of [
      ['PUT', '/api/v1/machines/not-an-id', { cell: 'x' }],
      ['GET', '/api/v1/machines/not-an-id/moves', undefined],
      ['PUT', '/api/v1/segments/12345', { name: 'x' }],
      ['PUT', '/api/v1/settings/lists/wait_reason/%20', { active: false }],
    ] as const) {
      expect((await f.call(method, url, head(), body)).statusCode, url).toBe(404);
    }
  });
});

describe('a machine is not switched off, restored onto or corrected onto while it is needed', () => {
  const person = async (username: string) =>
    (await f.admin.query('SELECT person_id FROM login WHERE username = $1', [username])).rows[0]
      .person_id as string;
  const command = (token: string, id: string, action: string, body: object) =>
    f.app.inject({
      method: 'POST',
      url: `/api/v1/tickets/${id}/${action}`,
      headers: {
        host: 'plant-a.localhost',
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
        'idempotency-key': `review-${(keys += 1)}`,
      },
      payload: body,
    });
  const switchOff = (machineId: string) =>
    f.call('PUT', `/api/v1/machines/${machineId}`, head(), { active: false });

  it('answers 409 for an open, a working and a waiting ticket, all made through the API', async () => {
    const tech = await person('plant-a-technician');
    await f.call('PUT', '/api/v1/settings/features', head(), {
      value: { general: true, pause: true },
    });
    await f.call('POST', '/api/v1/settings/lists/wait_reason', head(), {
      code: 'wait-x',
      label: 'Wait X',
    });
    for (const stage of ['open', 'working', 'waiting']) {
      const machine = await newMachine(`ST-${stage}`);
      const raised = await raise(f.tokens.operator!, { machineId: machine.id, problem: 'Noise' });
      expect(raised.statusCode, stage).toBe(201);
      const id = raised.json().ticket.id as string;
      if (stage !== 'open') {
        expect(
          (await command(f.tokens.technician!, id, 'start', { personId: tech })).statusCode,
        ).toBe(200);
      }
      if (stage === 'waiting') {
        const paused = await command(f.tokens.technician!, id, 'pause', {
          personId: tech,
          reasonCode: 'wait-x',
        });
        expect(paused.statusCode).toBe(200);
      }
      const blocked = await switchOff(machine.id);
      expect(blocked.statusCode, stage).toBe(409);
      expect(blocked.json().error).toMatchObject({ code: 'conflict', field: 'active' });
    }
  });

  it('answers 409 for an open general work request that names the machine too', async () => {
    const machine = await newMachine('ST-general');
    const raised = await raise(f.tokens.operator!, {
      kind: 'general',
      machineId: machine.id,
      problem: 'Clean the guard',
      location: 'Cell 1',
      workType: 'cleaning',
    });
    expect(raised.statusCode, raised.body).toBe(201);
    const blocked = await switchOff(machine.id);
    expect(blocked.statusCode).toBe(409);
    expect(blocked.json().error.field).toBe('active');
  });

  it('refuses to restore a cancelled ticket onto a machine switched off meanwhile, and restores once it is back on', async () => {
    const tech = await person('plant-a-technician');
    const admin = await person('plant-a-admin');
    const machine = await newMachine('RS-1');
    const id = (await raise(f.tokens.operator!, { machineId: machine.id, problem: 'Belt' })).json()
      .ticket.id as string;
    expect(
      (
        await command(f.tokens.technician!, id, 'cancel', {
          personId: tech,
          reason: 'Raised by mistake',
        })
      ).statusCode,
    ).toBe(200);
    expect((await switchOff(machine.id)).statusCode).toBe(200);
    const refused = await command(f.tokens.admin!, id, 'restore', {
      personId: admin,
      reason: 'It was real',
    });
    expect(refused.statusCode).toBe(422);
    expect(refused.json().error.message).toBe('This machine is switched off');
    await f.call('PUT', `/api/v1/machines/${machine.id}`, head(), { active: true });
    expect(
      (await command(f.tokens.admin!, id, 'restore', { personId: admin, reason: 'It was real' }))
        .statusCode,
    ).toBe(200);
  });

  it('refuses to correct an active ticket onto a machine that is switched off', async () => {
    const live = await newMachine('CR-1');
    const off = await newMachine('CR-2');
    expect((await switchOff(off.id)).statusCode).toBe(200);
    const id = (await raise(f.tokens.operator!, { machineId: live.id, problem: 'Chuck' })).json()
      .ticket.id as string;
    const refused = await command(f.tokens.admin!, id, 'correct', {
      reason: 'Wrong machine',
      changes: { machineId: off.id },
    });
    expect(refused.statusCode).toBe(422);
    expect(refused.json().error).toMatchObject({
      field: 'changes.machineId',
      message: 'This machine is switched off',
    });
  });
});

describe('what a generated form sends on create and on a bad id', () => {
  it('an empty text on create is a field that was not sent: its default applies', async () => {
    const machine = await f.call('POST', '/api/v1/machines', head(), {
      code: 'BL-1',
      criticality: '',
      year: '',
      category: '',
      segmentId: '',
    });
    expect(machine.statusCode).toBe(201);
    expect(machine.json()).toMatchObject({
      criticality: 'B',
      year: null,
      category: null,
      segmentId: null,
    });
    const entry = await f.call('POST', '/api/v1/settings/lists/work_type', head(), {
      code: 'bl',
      label: 'Blank',
      sort: '',
      isVendor: '',
      active: '',
    });
    expect(entry.statusCode).toBe(201);
    expect(entry.json()).toMatchObject({ sort: 0, isVendor: false, active: true });
    const term = await f.call('POST', '/api/v1/settings/glossary', head(), {
      source: 'ખાલી',
      english: 'blank',
      direction: '',
    });
    expect(term.json().direction).toBe('gu');
  });

  it('an empty required field is missing, named by its field', async () => {
    const res = await f.call('POST', '/api/v1/machines', head(), { code: '' });
    expect(res.statusCode).toBe(422);
    expect(res.json().error.field).toBe('code');
  });

  it('a repeated glossary term names its own field, not a code', async () => {
    const dup = await f.call('POST', '/api/v1/settings/glossary', head(), {
      source: 'ખરાબ',
      english: 'again',
    });
    expect(dup.statusCode).toBe(409);
    expect(dup.json().error.field).toBe('source');
  });

  it('a bad id is 404 whatever the body says', async () => {
    for (const path of [
      'shifts',
      'segments',
      'groups',
      'machines',
      'settings/glossary',
      'settings/lists/wait_reason',
    ]) {
      const res = await f.call('PUT', `/api/v1/${path}/not-an-id`, head(), {
        name: 123,
        code: 99,
        nonsense: true,
      });
      expect(res.statusCode, path).toBe(404);
    }
  });
});
