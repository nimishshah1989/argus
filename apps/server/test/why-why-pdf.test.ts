import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { pdfShows, pdfText } from './pdf-text.js';
import { A, M_FREE, M_USED, startFixture, type Fixture } from './plant-settings-fixture.js';

// 41c-2: a saved Why-Why prints as a server-image PDF (D25). The text layer carries the ticket's facts, the five
// whys, the conclusion, the author's coded name and the day it was completed.

const GUJ_WHY = 'સ્પિન્ડલ બેરિંગ બદલવું પડ્યું';
const GUJ_CONCLUSION = 'બેરિંગ ઘસાઈ ગયું હતું';
const WHYS = [
  GUJ_WHY,
  'The oil line was blocked',
  'The filter was due',
  'The PM missed it',
  'The oil was low',
];
const CONCLUSION = GUJ_CONCLUSION;

let f: Fixture;
let ticketId = '';
let withoutRecordId = '';
let openTicketId = '';
let headPerson = '';
let completedDate = '';

const save = (token: string, body: object, id: string) =>
  f.call('PUT', `/api/v1/tickets/${id}/why-why`, token, body);
const pdf = (token: string, id = ticketId) =>
  f.call('GET', `/api/v1/tickets/${id}/why-why.pdf`, token);
const flat = (text: string): string => text.replace(/\s+/g, '');
const personOf = async (role: string): Promise<string> =>
  (
    await f.admin.query('SELECT person_id FROM login WHERE tenant_id = $1 AND username = $2', [
      A,
      `plant-a-${role}`,
    ])
  ).rows[0].person_id as string;
const dmy = (date: string): string => {
  const [year, month, day] = date.split('-');
  return year && month && day ? `${day}-${month}-${year}` : date;
};

beforeAll(async () => {
  f = await startFixture();
  ticketId = (
    await f.admin.query("SELECT id FROM ticket WHERE tenant_id = $1 AND ref = 'BD-0001'", [A])
  ).rows[0].id as string;
  await f.admin.query(
    `INSERT INTO breakdown_report (tenant_id, ticket_id, machine_id, date, shift_code, problem, downtime_min, breakdown_category)
     VALUES ($1, $2, $3, '2026-11-10', 'DAY', 'Spindle noise', 780, 'M')`,
    [A, ticketId, M_USED],
  );
  headPerson = await personOf('head');
  const saved = await save(f.tokens.head!, { whys: WHYS, conclusion: CONCLUSION }, ticketId);
  expect(saved.statusCode, saved.body).toBe(201);
  completedDate = saved.json().completedDate as string;

  withoutRecordId = (
    await f.admin.query(
      `INSERT INTO ticket (tenant_id, ref, kind, status, machine_id, problem, reported_at, closed_at, severity)
       VALUES ($1, 'BD-0005', 'stopped', 'closed', $2, 'No record yet', now(), now(), 'S3') RETURNING id`,
      [A, M_FREE],
    )
  ).rows[0].id as string;
  await f.admin.query(
    `INSERT INTO breakdown_report (tenant_id, ticket_id, machine_id, date, shift_code, problem, downtime_min, breakdown_category)
     VALUES ($1, $2, $3, '2026-11-09', 'DAY', 'No record yet', 720, 'M')`,
    [A, withoutRecordId, M_FREE],
  );
  openTicketId = (
    await f.admin.query(
      `INSERT INTO ticket (tenant_id, ref, kind, status, machine_id, problem, reported_at, severity)
       VALUES ($1, 'BD-0006', 'stopped', 'open', $2, 'Still open', now(), 'S3') RETURNING id`,
      [A, M_FREE],
    )
  ).rows[0].id as string;
}, 120_000);

afterAll(async () => {
  await f?.stop();
});

describe('the Why-Why PDF', () => {
  it('renders the record: machine, date, hours, the five whys, conclusion, author name and completion date', async () => {
    const res = await pdf(f.tokens.head!);
    expect(res.statusCode, res.body).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
    expect(res.headers['content-disposition']).toBe(
      'inline; filename="WhyWhy_VC-02_10-11-2026.pdf"',
    );
    expect(res.rawPayload.subarray(0, 5).toString()).toBe('%PDF-');
    expect(res.rawPayload.length).toBeGreaterThan(5000);

    const text = flat(pdfText(res.rawPayload));
    for (const expected of [
      'VC-02',
      '10-11-2026',
      '13.00',
      ...WHYS.slice(1),
      // The author's name, not their code (ADR 0058).
      'plant-a head',
      dmy(completedDate),
    ]) {
      expect(text, expected).toContain(flat(expected));
    }
    expect(text).not.toContain(`P-${headPerson.slice(0, 8)}`);
    expect(text).toContain(flat('Spindle noise'));
    expect(pdfShows(res.rawPayload, `${WHYS[0]} ${CONCLUSION}`)).toBe(true);
  });

  it('refuses technician, operator and board with the named read refusal', async () => {
    for (const role of ['technician', 'operator', 'board']) {
      const res = await pdf(f.tokens[role]!);
      expect(res.statusCode, role).toBe(403);
      expect(res.json().error).toEqual({
        code: 'forbidden',
        message: 'You do not have permission to read a Why-Why',
      });
    }
  });

  it('answers not_found for an unknown ticket and for another plant', async () => {
    expect((await pdf(f.tokens.head!, '00000000-0000-0000-0000-000000000000')).statusCode).toBe(
      404,
    );
    const other = await pdf(f.tokens['b-admin']!, ticketId);
    expect(other.statusCode, other.body).toBe(404);
    expect(other.json().error.code).toBe('not_found');
  });

  it('refuses an open ticket and a ticket with no saved record', async () => {
    const open = await pdf(f.tokens.head!, openTicketId);
    expect(open.statusCode, open.body).toBe(409);
    expect(open.json().error.message).toBe('not-a-breakdown');

    const unsaved = await pdf(f.tokens.head!, withoutRecordId);
    expect(unsaved.statusCode, unsaved.body).toBe(409);
    expect(unsaved.json().error.code).toBe('conflict');
    expect(unsaved.json().error.message).toBe('This ticket has no saved Why-Why');
  });

  it('requires a signed-in caller', async () => {
    expect((await pdf('')).statusCode).toBe(401);
  });
});
