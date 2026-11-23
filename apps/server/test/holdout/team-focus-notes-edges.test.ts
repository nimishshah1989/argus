import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { focusNotesReplySchema } from '@uptimo/shared';
import { A, B, startFixture, type Fixture } from '../plant-settings-fixture.js';

/** TF-1 hidden (ADR 0018): overwrites, odd action keys, month and tenant isolation, limits and defaults. */

const URL = '/api/v1/analytics/team-focus/notes';
const PERIOD = '2026-12';

let f: Fixture;

const putNote = (body: object, token = f.tokens.supervisor!) => f.call('PUT', URL, token, body);
const notesOf = async (period: string, token = f.tokens.head!) => {
  const res = await f.call('GET', `${URL}?period=${period}`, token);
  expect(res.statusCode).toBe(200);
  return focusNotesReplySchema.parse(res.json()).notes;
};

const rowsOf = async (
  tenant: string,
  key: string,
): Promise<Array<{ id: string; value: Record<string, unknown> }>> =>
  (
    await f.admin.query('SELECT id, value FROM setting WHERE tenant_id = $1 AND key = $2', [
      tenant,
      key,
    ])
  ).rows;

const auditsOf = async (entityId: string): Promise<Array<Record<string, unknown>>> =>
  (
    await f.admin.query(
      "SELECT * FROM audit_log WHERE entity = 'setting' AND action = 'focus.save' AND entity_id = $1 ORDER BY at",
      [entityId],
    )
  ).rows;

const rawRow = (tenant: string, key: string, value: object): Promise<unknown> =>
  f.admin.query(
    `INSERT INTO setting (tenant_id, key, value) VALUES ($1, $2, $3::jsonb)
     ON CONFLICT (tenant_id, key) DO UPDATE SET value = EXCLUDED.value`,
    [tenant, key, JSON.stringify(value)],
  );

const STORED = { status: 'open', owner: '', note: '', at: '2026-11-20T04:30:00.000Z' };

beforeAll(async () => {
  f = await startFixture();
}, 180_000);

afterAll(async () => f.stop());

describe('Team Focus notes: the cases the visible tests leave open', () => {
  it('a second write keeps the one row and its id, and audits the change with before and after', async () => {
    const action = 'repeat|overwrite';
    expect(
      (await putNote({ period: PERIOD, action, status: 'prog', owner: 'Ravi', note: 'First' }))
        .statusCode,
    ).toBe(200);
    const [first] = await rowsOf(A, `focus:${PERIOD}|${action}`);
    const res = await putNote({ period: PERIOD, action, status: 'done', note: 'Second' });
    expect(res.statusCode).toBe(200);
    const rows = await rowsOf(A, `focus:${PERIOD}|${action}`);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.id).toBe(first!.id);
    // A left-out owner is saved empty, not kept from the last write.
    expect(focusNotesReplySchema.parse(res.json()).notes[action]).toMatchObject({
      status: 'done',
      owner: '',
      note: 'Second',
    });
    const lines = await auditsOf(first!.id);
    expect(lines).toHaveLength(2);
    expect(lines[1]).toMatchObject({
      before: expect.objectContaining({ status: 'prog', owner: 'Ravi', note: 'First' }),
      after: expect.objectContaining({ status: 'done', owner: '', note: 'Second' }),
    });
  });

  it('saves the database instant, and owner and note default to empty', async () => {
    const before = Date.now();
    const res = await putNote({ period: PERIOD, action: 'defaults', status: 'skip' });
    expect(res.statusCode).toBe(200);
    const note = focusNotesReplySchema.parse(res.json()).notes.defaults!;
    expect(note).toMatchObject({ status: 'skip', owner: '', note: '' });
    expect(Math.abs(Date.parse(note.at) - before)).toBeLessThan(60_000);
  });

  it('going back to open with nothing in it keeps the row (no delete)', async () => {
    const action = 'back-to-open';
    await putNote({ period: PERIOD, action, status: 'done', owner: 'Ravi' });
    const res = await putNote({ period: PERIOD, action, status: 'open' });
    expect(res.statusCode).toBe(200);
    expect(await rowsOf(A, `focus:${PERIOD}|${action}`)).toHaveLength(1);
    expect((await notesOf(PERIOD))[action]).toMatchObject({ status: 'open', owner: '', note: '' });
  });

  it('round-trips action keys holding |, %, _ and / exactly', async () => {
    const keys = ['spare|Bearing 6205/ZZ', 'data|cost', 'odd%key_with|two|pipes'];
    for (const action of keys)
      expect((await putNote({ period: PERIOD, action, status: 'prog' })).statusCode, action).toBe(
        200,
      );
    const notes = await notesOf(PERIOD);
    for (const action of keys) expect(notes[action], action).toMatchObject({ status: 'prog' });
    expect(await rowsOf(A, `focus:${PERIOD}|spare|Bearing 6205/ZZ`)).toHaveLength(1);
  });

  it('reads one month only: other months, near-miss keys and nudge rows stay out', async () => {
    await putNote({ period: '2027-01', action: 'next-month', status: 'prog' });
    await rawRow(A, 'focus:2026-12x|near-miss', STORED);
    await rawRow(A, 'focus:2026-12', STORED);
    await rawRow(A, 'focus:test', {});
    await rawRow(A, `nudge:focus:${PERIOD}|nudge`, STORED);
    const notes = await notesOf(PERIOD);
    expect(notes['next-month']).toBeUndefined();
    expect(Object.keys(notes).some((key) => /near-miss|nudge|^$/.test(key))).toBe(false);
    expect((await notesOf('2027-01'))['next-month']).toMatchObject({ status: 'prog' });
    expect(await notesOf('2025-01')).toEqual({});
  });

  it('reads back a stored note longer than the write limits without failing', async () => {
    await rawRow(A, `focus:${PERIOD}|legacy-long`, {
      ...STORED,
      owner: 'x'.repeat(120),
      note: 'y'.repeat(900),
    });
    expect((await notesOf(PERIOD))['legacy-long']!.note).toHaveLength(900);
  });

  it("keeps each plant's notes to itself, on the read and on the write", async () => {
    const action = 'tenant-split';
    await putNote({ period: PERIOD, action, status: 'prog', owner: 'Plant A owner' });
    expect((await notesOf(PERIOD, f.tokens['b-admin']!))[action]).toBeUndefined();
    const res = await putNote(
      { period: PERIOD, action, status: 'done', owner: 'Plant B owner' },
      f.tokens['b-admin']!,
    );
    expect(res.statusCode).toBe(200);
    expect((await rowsOf(A, `focus:${PERIOD}|${action}`))[0]!.value).toMatchObject({
      status: 'prog',
      owner: 'Plant A owner',
    });
    expect((await rowsOf(B, `focus:${PERIOD}|${action}`))[0]!.value).toMatchObject({
      status: 'done',
      owner: 'Plant B owner',
    });
    expect((await notesOf(PERIOD))[action]).toMatchObject({ owner: 'Plant A owner' });
  });

  it('refuses bodies past the limits or off the contract with 422 and writes nothing', async () => {
    const cases: Array<[object, string | undefined]> = [
      [{ period: PERIOD, action: 'limits', status: 'prog', owner: 'o'.repeat(81) }, 'owner'],
      [{ period: PERIOD, action: 'limits', status: 'prog', note: 'n'.repeat(501) }, 'note'],
      [{ period: PERIOD, action: '', status: 'prog' }, 'action'],
      [{ period: PERIOD, action: 'a'.repeat(201), status: 'prog' }, 'action'],
      [{ action: 'limits', status: 'prog' }, 'period'],
      [{ period: '2026-1', action: 'limits', status: 'prog' }, 'period'],
      [{ period: PERIOD, action: 'limits', status: 'prog', tenantId: B }, 'tenantId'],
    ];
    for (const [body, field] of cases) {
      const res = await putNote(body);
      expect(res.statusCode, JSON.stringify(body).slice(0, 80)).toBe(422);
      if (field) expect(res.json().error.field).toBe(field);
    }
    expect(await rowsOf(A, `focus:${PERIOD}|limits`)).toHaveLength(0);
    expect(await rowsOf(A, `focus:${PERIOD}|${'a'.repeat(201)}`)).toHaveLength(0);
  });

  it('refuses a read with no month', async () => {
    const res = await f.call('GET', URL, f.tokens.head!);
    expect(res.statusCode).toBe(422);
    expect(res.json().error.field).toBe('period');
  });
});
