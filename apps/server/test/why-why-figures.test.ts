import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { withTenant } from '../src/kernel/index.js';
import { loadEngineData } from '../src/modules/analytics/load.js';
import { A, M_FREE, M_USED, startFixture, type Fixture } from './plant-settings-fixture.js';

// 41c-2: the analytics loader reads the latest why_why payload per ticket, so A6 turns that ticket Completed.

let f: Fixture;
let ticketId = '';
let otherTicketId = '';
let headPerson = '';

const WHYS = ['Machine stopped', 'No oil', 'Blocked line', 'Filter due', 'PM missed it'];
const saved = (conclusion: string) => ({ whys: WHYS, conclusion });
const put = (token: string, body: object, id: string) =>
  f.call('PUT', `/api/v1/tickets/${id}/why-why`, token, body);
const figures = async () =>
  (await f.call('GET', '/api/v1/analytics/figures', f.tokens.head!)).json();
const a6Rows = (reply: { figures: { key: string; value: unknown }[] }) => {
  const figure = reply.figures.find((row) => row.key === 'a6-why-why') as {
    value: { pages: { tables: { rows: string[][] }[] }[] };
  };
  return figure.value.pages[0]!.tables[0]!.rows;
};
const rowOf = (rows: string[][], machine: string) => rows.find((row) => row[0] === machine);
const plantToday = (): string =>
  new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

async function engineWhyWhy() {
  return withTenant(f.db.app, A, (tx) => loadEngineData(tx, A));
}

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
  headPerson = (
    await f.admin.query(
      "SELECT person_id FROM login WHERE tenant_id = $1 AND username = 'plant-a-head'",
      [A],
    )
  ).rows[0].person_id as string;
  otherTicketId = (
    await f.admin.query(
      `INSERT INTO ticket (tenant_id, ref, kind, status, machine_id, problem, reported_at, closed_at, severity)
       VALUES ($1, 'BD-0004', 'stopped', 'closed', $2, 'Second breakdown', now(), now(), 'S3') RETURNING id`,
      [A, M_FREE],
    )
  ).rows[0].id as string;
  await f.admin.query(
    `INSERT INTO breakdown_report (tenant_id, ticket_id, machine_id, date, shift_code, problem, downtime_min, breakdown_category)
     VALUES ($1, $2, $3, '2026-11-09', 'DAY', 'Second breakdown', 840, 'M')`,
    [A, otherTicketId, M_FREE],
  );
}, 120_000);

afterAll(async () => {
  await f?.stop();
});

describe('the Why-Why figures after a save', () => {
  it('shows the candidate Not Started, then Completed once its record is saved', async () => {
    const before = await figures();
    expect(rowOf(a6Rows(before), 'VC-02')).toEqual([
      'VC-02',
      '10-11-2026',
      'Spindle noise',
      '13.00',
      'Not Started',
      'Start Why-Why',
    ]);
    expect((await engineWhyWhy()).whyWhy).toEqual([]);

    const savedRecord = await put(f.tokens.head!, saved('The bearing was worn.'), ticketId);
    expect(savedRecord.statusCode, savedRecord.body).toBe(201);

    const after = await figures();
    expect(rowOf(a6Rows(after), 'VC-02')).toEqual([
      'VC-02',
      '10-11-2026',
      'Spindle noise',
      '13.00',
      'Completed',
      'View / EditPDF',
    ]);
    const a6 = after.figures.find((row: { key: string }) => row.key === 'a6-why-why');
    expect(a6.drill.ids).toContain(ticketId);
    expect(rowOf(a6Rows(after), 'VC-01')?.[4]).toBe('Not Started');
  });

  it('loads one row per ticket, the latest save, with the author as a person code', async () => {
    await put(f.tokens.head!, saved('A later conclusion.'), ticketId);
    const other = await put(f.tokens.head!, saved('The second machine.'), otherTicketId);
    expect(other.statusCode, other.body).toBe(201);

    const { whyWhy } = await engineWhyWhy();
    const mine = (whyWhy ?? []).filter((row) => row.ticketId === ticketId);
    expect(mine).toEqual([
      {
        ticketId,
        whys: WHYS,
        conclusion: 'A later conclusion.',
        completedBy: `P-${headPerson.slice(0, 8)}`,
        completedDate: plantToday(),
      },
    ]);
    expect((whyWhy ?? []).filter((row) => row.ticketId === otherTicketId)).toHaveLength(1);
  });
});
