import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  GROUP_A,
  ITEM_A,
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
    const res = await f.call('PUT', `/api/v1/machines/${M_FREE}`, head(), {
      cell: 'Cell 4',
      effectiveFrom: '2026-11-01',
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().cell).toBe('Cell 4');
    expect(await moves(M_FREE)).toEqual([
      expect.objectContaining({
        fromCell: 'Cell 1',
        toCell: 'Cell 4',
        effectiveFrom: '2026-11-01',
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

  it('active switches the board flags for a segment and a group, and is refused where no switch exists yet', async () => {
    const group = await f.call('PUT', `/api/v1/groups/${GROUP_A}`, head(), { active: false });
    expect(group.json()).toMatchObject({ hidden: true, active: false });
    const back = await f.call('PUT', `/api/v1/groups/${GROUP_A}`, head(), { active: true });
    expect(back.json()).toMatchObject({ hidden: false, active: true });
    const shift = await f.call('PUT', `/api/v1/shifts/${SHIFT_A}`, head(), { active: false });
    expect(shift.statusCode).toBe(422);
    expect(shift.json().error.field).toBe('active');
    const term = await f.call('PUT', `/api/v1/settings/glossary/${TERM_A}`, head(), {
      active: false,
    });
    expect(term.statusCode).toBe(422);
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
