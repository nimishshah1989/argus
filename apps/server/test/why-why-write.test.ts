import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { A, M_FREE, M_USED, startFixture, type Fixture } from './plant-settings-fixture.js';

// 41c-2 (R2/R3): one Why-Why is one append-only why_why ticket event. The author and plant date are the session's,
// never the body's; the read and the write are the analytics roles' only; the ticket must be a closed breakdown.

let f: Fixture;
let ticketId = '';
let headPerson = '';
let openTicketId = '';
let supportTicketId = '';

const WHYS = [
  'The spindle stopped',
  'The bearing was dry',
  'The oil line was blocked',
  'The filter was never changed',
  'The PM checklist missed the filter',
];
const CONCLUSION = 'The bearing was worn because the oil line was blocked.';

const put = (token: string, body: object, id = ticketId) =>
  f.call('PUT', `/api/v1/tickets/${id}/why-why`, token, body);
const get = (token: string, id = ticketId) => f.call('GET', `/api/v1/tickets/${id}/why-why`, token);
const personOf = async (role: string): Promise<string> =>
  (
    await f.admin.query('SELECT person_id FROM login WHERE tenant_id = $1 AND username = $2', [
      A,
      `plant-a-${role}`,
    ])
  ).rows[0].person_id as string;
const plantToday = (): string =>
  new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
const events = async () =>
  (
    await f.admin.query(
      "SELECT seq, payload FROM ticket_event WHERE tenant_id = $1 AND ticket_id = $2 AND type = 'why_why' ORDER BY seq",
      [A, ticketId],
    )
  ).rows as { seq: number; payload: Record<string, unknown> }[];

beforeAll(async () => {
  f = await startFixture();
  ticketId = (
    await f.admin.query("SELECT id FROM ticket WHERE tenant_id = $1 AND ref = 'BD-0001'", [A])
  ).rows[0].id as string;
  // A closed breakdown with a report: the platform's A6 candidate (13 hours, over the 12-hour profile threshold).
  await f.admin.query(
    `INSERT INTO breakdown_report (tenant_id, ticket_id, machine_id, date, shift_code, problem, downtime_min, breakdown_category)
     VALUES ($1, $2, $3, '2026-11-10', 'DAY', 'Spindle noise', 780, 'M')`,
    [A, ticketId, M_USED],
  );
  headPerson = await personOf('head');
  openTicketId = (
    await f.admin.query(
      `INSERT INTO ticket (tenant_id, ref, kind, status, machine_id, problem, reported_at, severity)
       VALUES ($1, 'BD-0002', 'stopped', 'open', $2, 'Still open', now(), 'S3') RETURNING id`,
      [A, M_FREE],
    )
  ).rows[0].id as string;
  supportTicketId = (
    await f.admin.query(
      `INSERT INTO ticket (tenant_id, ref, kind, status, machine_id, problem, reported_at, closed_at, severity)
       VALUES ($1, 'BD-0003', 'support', 'closed', $2, 'Not a breakdown', now(), now(), 'S3') RETURNING id`,
      [A, M_FREE],
    )
  ).rows[0].id as string;
}, 120_000);

afterAll(async () => {
  await f?.stop();
});

describe('saving a Why-Why', () => {
  it('answers null before a save, then the saved record; a second save appends and becomes the latest', async () => {
    const before = await get(f.tokens.head!);
    expect(before.statusCode, before.body).toBe(200);
    expect(before.json()).toBeNull();

    const saved = await put(f.tokens.head!, { whys: WHYS, conclusion: CONCLUSION });
    expect(saved.statusCode, saved.body).toBe(201);
    expect(saved.json()).toEqual({
      whys: WHYS,
      conclusion: CONCLUSION,
      completedBy: headPerson,
      completedDate: plantToday(),
    });
    expect(await events()).toHaveLength(1);

    const second = await put(f.tokens.head!, {
      whys: WHYS,
      conclusion: 'A second, later conclusion',
    });
    expect(second.statusCode, second.body).toBe(201);
    const latest = await get(f.tokens.head!);
    expect(latest.json().conclusion).toBe('A second, later conclusion');
    const rows = await events();
    expect(rows.map((row) => row.payload.conclusion)).toEqual([
      CONCLUSION,
      'A second, later conclusion',
    ]);
  });

  it('takes the author and the date from the session, never from the body', async () => {
    const spoofedBy = await put(f.tokens.head!, {
      whys: WHYS,
      conclusion: 'Body names the author',
      completedBy: randomUUID(),
    });
    expect(spoofedBy.statusCode, spoofedBy.body).toBe(422);
    expect(spoofedBy.json().error.code).toBe('validation');
    expect(spoofedBy.json().error.field).toBe('completedBy');

    const spoofedDate = await put(f.tokens.head!, {
      whys: WHYS,
      conclusion: 'Body names the date',
      completedDate: '2000-01-01',
    });
    expect(spoofedDate.statusCode, spoofedDate.body).toBe(422);
    expect(spoofedDate.json().error.field).toBe('completedDate');

    const latest = await get(f.tokens.head!);
    expect(latest.json().completedBy).toBe(headPerson);
    expect(latest.json().completedDate).toBe(plantToday());
  });

  it('refuses a missing, blank or over-long conclusion with 422', async () => {
    for (const body of [
      { whys: WHYS },
      { whys: WHYS, conclusion: '   ' },
      { whys: WHYS, conclusion: 'x'.repeat(2001) },
    ]) {
      const res = await put(f.tokens.head!, body);
      expect(res.statusCode, JSON.stringify(body)).toBe(422);
      expect(res.json().error.code).toBe('validation');
      expect(res.json().error.field).toBe('conclusion');
    }
  });

  it('keeps exactly five whys of at most 2,000 characters, and allows a blank why', async () => {
    for (const body of [
      { whys: WHYS.slice(0, 4), conclusion: CONCLUSION },
      { whys: [...WHYS, 'A sixth why'], conclusion: CONCLUSION },
      { whys: ['x'.repeat(2001), ...WHYS.slice(1)], conclusion: CONCLUSION },
    ]) {
      const res = await put(f.tokens.head!, body);
      expect(res.statusCode, JSON.stringify(body)).toBe(422);
      expect(res.json().error.code).toBe('validation');
      expect(res.json().error.field).toMatch(/^whys/);
    }
    const blank = await put(f.tokens.head!, {
      whys: ['', ' ', '', '', ''],
      conclusion: 'Blank whys are allowed',
    });
    expect(blank.statusCode, blank.body).toBe(201);
    expect((await get(f.tokens.head!)).json().whys).toEqual(['', ' ', '', '', '']);
  });

  it('lets a supervisor, head, plant head or admin save, and refuses the others by name', async () => {
    for (const role of ['technician', 'operator', 'board']) {
      const token = f.tokens[role]!;
      const write = await put(token, { whys: WHYS, conclusion: 'Not allowed' });
      expect(write.statusCode, role).toBe(403);
      expect(write.json().error).toEqual({
        code: 'forbidden',
        message: 'Only a supervisor, head, plant head or admin may save a Why-Why',
      });
      const read = await get(token);
      expect(read.statusCode, role).toBe(403);
      expect(read.json().error.message).toBe('You do not have permission to read a Why-Why');
    }
    for (const role of ['supervisor', 'plant_head', 'admin']) {
      const saved = await put(f.tokens[role]!, {
        whys: WHYS,
        conclusion: `Saved by the ${role}`,
      });
      expect(saved.statusCode, role).toBe(201);
      expect(saved.json().completedBy).toBe(await personOf(role));
    }
  });

  it('refuses a ticket that is not a closed breakdown with 409 not-a-breakdown', async () => {
    for (const id of [openTicketId, supportTicketId]) {
      for (const res of [
        await get(f.tokens.head!, id),
        await put(f.tokens.head!, { whys: WHYS, conclusion: CONCLUSION }, id),
      ]) {
        expect(res.statusCode, res.body).toBe(409);
        expect(res.json().error.code).toBe('conflict');
        expect(res.json().error.message).toBe('not-a-breakdown');
      }
    }
  });

  it("answers not_found for an unknown ticket and for another plant's ticket", async () => {
    const unknown = randomUUID();
    expect((await get(f.tokens.head!, unknown)).statusCode).toBe(404);
    const missing = await put(f.tokens.head!, { whys: WHYS, conclusion: CONCLUSION }, unknown);
    expect(missing.statusCode).toBe(404);
    expect(missing.json().error.code).toBe('not_found');

    for (const res of [
      await get(f.tokens['b-admin']!, ticketId),
      await put(f.tokens['b-admin']!, { whys: WHYS, conclusion: CONCLUSION }, ticketId),
    ]) {
      expect(res.statusCode, res.body).toBe(404);
      expect(res.json().error.code).toBe('not_found');
    }
  });

  it('requires a signed-in caller', async () => {
    expect((await get('')).statusCode).toBe(401);
    expect((await put('', { whys: WHYS, conclusion: CONCLUSION })).statusCode).toBe(401);
  });
});
