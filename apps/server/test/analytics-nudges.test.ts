import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { actionCenterBoardSchema } from '@uptimo/shared';
import type { NudgeAck } from '@uptimo/domain';
import { withTenant } from '../src/kernel/index.js';
import { plantToday } from '../src/modules/plant/index.js';
import { A, M_FREE, M_USED, startFixture, type Fixture } from './plant-settings-fixture.js';

/**
 * Ticket 44, packet 44c: the acknowledgements the Action Center persists and the routes the screen calls. The six
 * acks the frozen key carries are seeded as `setting` rows and the figure echoes them; a live plant's tiny freq
 * nudge proves the write, the role gate, the snooze length from the profile, the reopen, the conflicts and the 404s.
 */

interface Workbook {
  settings: { acAcks: Record<string, NudgeAck> };
}

const readJson = <T>(path: string): T =>
  JSON.parse(readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8')) as T;
/** The six acks are input data: `input.json`, never the answer key. */
const SIX = readJson<Workbook>('../../../fixtures/answer-key/input.json').settings.acAcks;
const DAY_MS = 86_400_000;
const NUDGE = 'nudge:';

let f: Fixture;
let today: string;

/** The live plant's one freq nudge: four breakdowns on one machine, all today (so no recurring-fault nudge). */
const FREQ_KEY = `freq|${M_USED}`;
const FREQ_ROW = `${NUDGE}${FREQ_KEY}`;

/** The plant date `days` before `day`: both are `YYYY-MM-DD`, so no zone is involved. */
function dayBefore(day: string, days: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

let nextRef = 9000;

/** One closed breakdown with its report: a live ticket (`raised_channel` defaults to `floor`). */
async function seedBreakdown(input: {
  machineId: string;
  day: string;
  code: string;
  minutes: number;
}): Promise<void> {
  nextRef += 1;
  const start = `${input.day}T08:00:00+05:30`;
  const ticket = (
    await f.admin.query(
      `INSERT INTO ticket (tenant_id, ref, kind, status, machine_id, problem, reported_at, closed_at, severity, downtime_min)
       VALUES ($1, $2, 'stopped', 'closed', $3, 'Breakdown', $4, $4, 'S3', $5) RETURNING id`,
      [A, `BD-${nextRef}`, input.machineId, start, input.minutes],
    )
  ).rows[0].id as string;
  await f.admin.query(
    `INSERT INTO breakdown_report (tenant_id, ticket_id, machine_id, date, shift_code, problem, downtime_min, maint_code)
     VALUES ($1, $2, $3, $4, 'DAY', 'Breakdown', $5, $6)`,
    [A, ticket, input.machineId, input.day, input.minutes, input.code],
  );
}

/** One stored ack as the platform keeps it: a `setting` row under `nudge:` and the full nudge key. */
async function putAck(key: string, ack: NudgeAck): Promise<void> {
  await f.admin.query(
    `INSERT INTO setting (tenant_id, key, value) VALUES ($1, $2, $3::jsonb)
     ON CONFLICT (tenant_id, key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [A, `${NUDGE}${key}`, JSON.stringify(ack)],
  );
}

const clearAck = (): Promise<unknown> =>
  f.admin.query('DELETE FROM setting WHERE tenant_id = $1 AND key = $2', [A, FREQ_ROW]);

const ackRows = async (): Promise<Array<{ id: string; value: NudgeAck }>> =>
  (
    await f.admin.query('SELECT id, value FROM setting WHERE tenant_id = $1 AND key = $2', [
      A,
      FREQ_ROW,
    ])
  ).rows;

const nudgeAudits = async (): Promise<Array<Record<string, unknown>>> =>
  (
    await f.admin.query(
      "SELECT * FROM audit_log WHERE entity = 'setting' AND action LIKE 'nudge.%' ORDER BY at, action",
    )
  ).rows;

/** The board as the route answers it, parsed against the published contract. */
async function board(token = f.tokens.head!) {
  const res = await f.call('GET', '/api/v1/analytics/action-center', token);
  expect(res.statusCode).toBe(200);
  return actionCenterBoardSchema.parse(res.json());
}

const findNudge = (boardValue: Awaited<ReturnType<typeof board>>, key = FREQ_KEY) => {
  const nudge = boardValue.nudges.find((candidate) => candidate.key === key);
  expect(nudge, key).toBeDefined();
  return nudge!;
};

const putNudge = (key: string, body: object, token = f.tokens.supervisor!) =>
  f.call('PUT', `/api/v1/analytics/action-center/nudges/${encodeURIComponent(key)}`, token, body);

const deleteNudge = (key: string, token = f.tokens.supervisor!) =>
  f.call('DELETE', `/api/v1/analytics/action-center/nudges/${encodeURIComponent(key)}`, token);

beforeAll(async () => {
  f = await startFixture();
  today = await withTenant(f.db.app, A, (tx) => plantToday(tx, A));
  for (const [key, ack] of Object.entries(SIX)) await putAck(key, ack);
  // The live freq nudge: one machine, one code, one plant day, so freq fires and recur/cell cannot.
  for (let index = 0; index < 4; index += 1)
    await seedBreakdown({ machineId: M_USED, day: today, code: 'BRG', minutes: 15 });
  // A quiet week against a heavy four weeks: two long reports in the previous window, one short one today.
  await seedBreakdown({
    machineId: M_FREE,
    day: dayBefore(today, 8),
    code: 'MOT',
    minutes: 21 * 60,
  });
  await seedBreakdown({
    machineId: M_FREE,
    day: dayBefore(today, 9),
    code: 'MOT',
    minutes: 21 * 60,
  });
  await seedBreakdown({ machineId: M_FREE, day: today, code: 'ELEC', minutes: 15 });
  // A Team Focus item row: the generic settings list must hide it too.
  await f.admin.query(
    "INSERT INTO setting (tenant_id, key, value) VALUES ($1, 'focus:test', '{}')",
    [A],
  );
}, 180_000);

afterAll(async () => f.stop());

describe('the Action Center acknowledgements through HTTP', () => {
  it('echoes the six stored acks in the figure it already returns for the key', async () => {
    await clearAck();
    const res = await f.call('GET', `/api/v1/analytics/figures?asOf=${today}`, f.tokens.head!);
    expect(res.statusCode).toBe(200);
    const figure = res.json().figures.find((one: { key: string }) => one.key === 'action-center');
    expect(figure.status).toBe('ready');
    expect(figure.value.extra.acks).toEqual(SIX);
  });

  it('reopens a nudge whose stored ack is older than its newest evidence', async () => {
    await clearAck();
    await putAck(FREQ_KEY, {
      status: 'ack',
      owner: '',
      due: '',
      note: '',
      at: new Date(Date.now() - 3 * DAY_MS).toISOString(),
    });
    const nudge = findNudge(await board());
    expect(nudge.status).toBe('open');
    expect(nudge.reopened).toBe(true);
    expect(nudge.ack).toMatchObject({ status: 'ack' });
  });

  it('a supervisor acks with owner, due and note: the row and its audit line exist', async () => {
    await clearAck();
    const res = await putNudge(FREQ_KEY, {
      status: 'ack',
      owner: 'Shift supervisor',
      due: today,
      note: 'Bearing checked',
    });
    expect(res.statusCode).toBe(200);
    const nudge = findNudge(actionCenterBoardSchema.parse(res.json()));
    expect(nudge.status).toBe('ack');
    expect(nudge.reopened).toBe(false);
    expect(nudge.ack).toMatchObject({
      status: 'ack',
      owner: 'Shift supervisor',
      due: today,
      note: 'Bearing checked',
    });
    const rows = await ackRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.value).toMatchObject({ owner: 'Shift supervisor', note: 'Bearing checked' });
    const ackAudit = (await nudgeAudits()).find(
      (row) => row.action === 'nudge.ack' && row.entity_id === rows[0]!.id,
    );
    expect(ackAudit).toMatchObject({
      entity: 'setting',
      before: null,
      after: expect.objectContaining({ status: 'ack', owner: 'Shift supervisor' }),
    });
  });

  it('refuses an operator and the board login, on the read and on the write', async () => {
    await clearAck();
    const before = (await nudgeAudits()).length;
    for (const role of ['operator', 'board']) {
      expect((await putNudge(FREQ_KEY, { status: 'ack' }, f.tokens[role]!)).statusCode, role).toBe(
        403,
      );
      expect((await deleteNudge(FREQ_KEY, f.tokens[role]!)).statusCode, role).toBe(403);
      expect(
        (await f.call('GET', '/api/v1/analytics/action-center', f.tokens[role]!)).statusCode,
        role,
      ).toBe(403);
    }
    expect(await ackRows()).toHaveLength(0);
    expect((await nudgeAudits()).length).toBe(before);
  });

  it("snoozes for the profile's snoozeDays, and a changed profile changes the next snooze", async () => {
    await clearAck();
    const profile = (await f.call('GET', '/api/v1/analytics-profile', f.tokens.head!)).json()
      .items[0] as { id: string; snoozeDays: number };
    expect(profile.snoozeDays).toBe(7);
    const first = await putNudge(FREQ_KEY, { status: 'snooze', note: 'Waiting for the part' });
    expect(first.statusCode).toBe(200);
    const snoozed = findNudge(actionCenterBoardSchema.parse(first.json()));
    expect(snoozed.status).toBe('snoozed');
    expect(snoozed.ack?.until).toBeDefined();
    expect(new Date(snoozed.ack!.until!).getTime() - new Date(snoozed.ack!.at).getTime()).toBe(
      7 * DAY_MS,
    );

    const changed = await f.call('PUT', `/api/v1/analytics-profile/${profile.id}`, f.tokens.head!, {
      snoozeDays: '3',
    });
    expect(changed.statusCode).toBe(200);
    expect((await board()).snoozeDays).toBe(3);
    await clearAck();
    const second = await putNudge(FREQ_KEY, { status: 'snooze' });
    const shorter = findNudge(actionCenterBoardSchema.parse(second.json()));
    expect(new Date(shorter.ack!.until!).getTime() - new Date(shorter.ack!.at).getTime()).toBe(
      3 * DAY_MS,
    );
    await f.call('PUT', `/api/v1/analytics-profile/${profile.id}`, f.tokens.head!, {
      snoozeDays: '7',
    });
  });

  it('reopen deletes the row: the nudge is open, its ack is gone from the engine and the change is audited', async () => {
    await clearAck();
    expect((await putNudge(FREQ_KEY, { status: 'ack' })).statusCode).toBe(200);
    const reopened = await deleteNudge(FREQ_KEY);
    expect(reopened.statusCode).toBe(200);
    const nudge = findNudge(actionCenterBoardSchema.parse(reopened.json()));
    expect(nudge.status).toBe('open');
    expect(nudge.ack).toBeNull();
    expect(await ackRows()).toHaveLength(0);
    expect((await nudgeAudits()).find((row) => row.action === 'nudge.reopen')).toMatchObject({
      before: expect.objectContaining({ status: 'ack' }),
      after: null,
    });
    const figures = await f.call('GET', `/api/v1/analytics/figures?asOf=${today}`, f.tokens.head!);
    const value = figures
      .json()
      .figures.find((one: { key: string }) => one.key === 'action-center').value;
    expect(value.extra.acks).not.toHaveProperty(FREQ_KEY);
    expect(value.extra.acks).toEqual(SIX);
  });

  it('keeps one row when a second ack replaces a stale one, and records the change', async () => {
    await clearAck();
    // The first ack is stale (newer evidence reopened the nudge), so the second write is allowed.
    await putAck(FREQ_KEY, {
      status: 'ack',
      owner: '',
      due: '',
      note: 'first',
      at: new Date(Date.now() - 3 * DAY_MS).toISOString(),
    });
    const [before] = await ackRows();
    expect(await ackRows()).toHaveLength(1);
    expect((await putNudge(FREQ_KEY, { status: 'ack', note: 'second' })).statusCode).toBe(200);
    const rows = await ackRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.id).toBe(before!.id);
    expect(rows[0]!.value.note).toBe('second');
    const line = (await nudgeAudits()).find(
      (row) => row.action === 'nudge.ack' && row.entity_id === rows[0]!.id,
    );
    expect(line).toMatchObject({
      before: expect.objectContaining({ note: 'first' }),
      after: expect.objectContaining({ note: 'second' }),
    });
  });

  it('resolves a nudge, then refuses a non-open one with 409', async () => {
    await clearAck();
    const resolved = await putNudge(FREQ_KEY, { status: 'resolved', note: 'Fixed' });
    expect(resolved.statusCode).toBe(200);
    const nudge = findNudge(actionCenterBoardSchema.parse(resolved.json()));
    expect(nudge.status).toBe('resolved');
    const [row] = await ackRows();
    expect(row!.value.status).toBe('done');
    expect(
      (await nudgeAudits()).find(
        (line) => line.action === 'nudge.resolve' && line.entity_id === row!.id,
      ),
    ).toBeDefined();
    const again = await putNudge(FREQ_KEY, { status: 'ack' });
    expect(again.statusCode).toBe(409);
    expect(again.json().error.code).toBe('conflict');
  });

  it('refuses a too-long note with 422 and writes nothing', async () => {
    await clearAck();
    const res = await putNudge(FREQ_KEY, { status: 'ack', note: 'x'.repeat(501) });
    expect(res.statusCode).toBe(422);
    expect(res.json().error.field).toBe('note');
    expect(await ackRows()).toHaveLength(0);
  });

  it("answers 404 for a made-up key, a stale key and another tenant's key", async () => {
    await clearAck();
    const madeUp = 'freq|00000000-0000-0000-0000-000000000000';
    expect((await putNudge(madeUp, { status: 'ack' })).statusCode).toBe(404);
    expect((await deleteNudge(madeUp)).statusCode).toBe(404);
    // A key from the six that no longer fires in this tiny plant is stale, not current.
    expect((await putNudge('freq|VC-16', { status: 'ack' })).statusCode).toBe(404);
    // Plant B cannot write plant A's nudge, and its board does not hold it.
    expect((await putNudge(FREQ_KEY, { status: 'ack' }, f.tokens['b-admin']!)).statusCode).toBe(
      404,
    );
    expect(await ackRows()).toHaveLength(0);
  });

  it('refuses the good-news (info) nudge with 409, on a write and on a reopen', async () => {
    const good = (await board()).nudges.find((nudge) => nudge.rule === 'good');
    expect(good, 'the quiet-week nudge').toBeDefined();
    expect(good!.sev).toBe('info');
    const write = await putNudge(good!.key, { status: 'ack' });
    expect(write.statusCode).toBe(409);
    expect((await deleteNudge(good!.key)).statusCode).toBe(409);
  });

  it('hides nudge: and focus: item rows from the generic settings list', async () => {
    const res = await f.call('GET', '/api/v1/settings', f.tokens.head!);
    expect(res.statusCode).toBe(200);
    const keys = (res.json() as Array<{ key: string }>).map((row) => row.key);
    expect(keys.some((key) => key.startsWith(NUDGE))).toBe(false);
    expect(keys.some((key) => key.startsWith('focus:'))).toBe(false);
    expect(keys).toContain('analytics.profile');
  });
});
