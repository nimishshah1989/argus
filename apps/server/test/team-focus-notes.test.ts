import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { focusNotesReplySchema } from '@uptimo/shared';
import { A, M_USED, startFixture, type Fixture } from './plant-settings-fixture.js';

/**
 * Ticket TF-1 (ADR 0018): Team Focus notes are one `setting` row per action under `focus:<period>|<action key>`,
 * read per focus month and written one at a time by the analytics audience, each write audited.
 */

const URL = '/api/v1/analytics/team-focus/notes';
const PERIOD = '2026-12';

let f: Fixture;

const putNote = (body: object, token = f.tokens.supervisor!) => f.call('PUT', URL, token, body);
const getNotes = (period: string, token = f.tokens.head!) =>
  f.call('GET', `${URL}?period=${period}`, token);

const rowsOf = async (
  key: string,
): Promise<Array<{ id: string; value: Record<string, unknown> }>> =>
  (await f.admin.query('SELECT id, value FROM setting WHERE tenant_id = $1 AND key = $2', [A, key]))
    .rows;

const focusAudits = async (): Promise<Array<Record<string, unknown>>> =>
  (
    await f.admin.query(
      "SELECT * FROM audit_log WHERE entity = 'setting' AND action = 'focus.save' ORDER BY at",
    )
  ).rows;

beforeAll(async () => {
  f = await startFixture();
}, 180_000);

afterAll(async () => f.stop());

describe('Team Focus notes through HTTP', () => {
  it('a supervisor saves a note: the reply, the read, the row and its audit line agree', async () => {
    const action = `fc|${M_USED}`;
    const res = await putNote({
      period: PERIOD,
      action,
      status: 'prog',
      owner: 'Shift supervisor',
      note: 'Bearing ordered',
    });
    expect(res.statusCode).toBe(200);
    const reply = focusNotesReplySchema.parse(res.json());
    expect(reply.period).toBe(PERIOD);
    expect(reply.notes[action]).toMatchObject({
      status: 'prog',
      owner: 'Shift supervisor',
      note: 'Bearing ordered',
    });

    const read = await getNotes(PERIOD);
    expect(read.statusCode).toBe(200);
    expect(focusNotesReplySchema.parse(read.json()).notes[action]).toEqual(reply.notes[action]);

    const rows = await rowsOf(`focus:${PERIOD}|${action}`);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.value).toMatchObject({ status: 'prog', owner: 'Shift supervisor' });
    const line = (await focusAudits()).find((row) => row.entity_id === rows[0]!.id);
    expect(line).toMatchObject({
      entity: 'setting',
      before: null,
      after: expect.objectContaining({ status: 'prog', note: 'Bearing ordered' }),
    });
  });

  it('heads and admin read; an operator, a technician and the board login are refused both ways', async () => {
    for (const role of ['head', 'plant_head', 'admin', 'supervisor'])
      expect((await getNotes(PERIOD, f.tokens[role]!)).statusCode, role).toBe(200);
    const before = (await focusAudits()).length;
    for (const role of ['operator', 'technician', 'board']) {
      expect((await getNotes(PERIOD, f.tokens[role]!)).statusCode, role).toBe(403);
      const res = await putNote(
        { period: PERIOD, action: 'refused', status: 'done' },
        f.tokens[role]!,
      );
      expect(res.statusCode, role).toBe(403);
    }
    expect(await rowsOf(`focus:${PERIOD}|refused`)).toHaveLength(0);
    expect((await focusAudits()).length).toBe(before);
  });

  it('refuses an unknown status and a month that is not YYYY-MM with 422 naming the field', async () => {
    const bad = await putNote({ period: PERIOD, action: 'bad-status', status: 'started' });
    expect(bad.statusCode).toBe(422);
    expect(bad.json().error.field).toBe('status');
    expect(await rowsOf(`focus:${PERIOD}|bad-status`)).toHaveLength(0);

    const month = await getNotes('2026-13');
    expect(month.statusCode).toBe(422);
    expect(month.json().error.field).toBe('period');
  });
});
