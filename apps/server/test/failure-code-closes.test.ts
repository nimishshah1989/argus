// Ticket 47b: every close that records a breakdown report carries one code, resolved through the plant's
// `failure_code` list (code or alias, any case) and mirrored into `maint_code`; legacy rows count as one code on read.
import { randomUUID } from 'node:crypto';
import { withTenant } from '@uptimo/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { raisePlannedTicket } from '../src/modules/tickets/index.js';
import { loadEngineData } from '../src/modules/analytics/load.js';
import {
  A,
  M_USED,
  SEG_A,
  startFixture,
  type Fixture,
  type Res,
} from './plant-settings-fixture.js';

const HOST = 'plant-a.localhost';
const MACHINE = '10000000-0000-4000-8000-000000000101';

let f: Fixture;
let keyCounter = 0;

function post(url: string, token: string, payload: object): Promise<Res> {
  keyCounter += 1;
  return f.app.inject({
    method: 'POST',
    url,
    headers: {
      host: HOST,
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
      'idempotency-key': `fc-${keyCounter}`,
    },
    payload,
  });
}

/** A machine of its own per close, so a refused close is the only ticket in the way. */
async function newMachine(): Promise<string> {
  const id = randomUUID();
  await f.admin.query(
    "INSERT INTO machine (id, tenant_id, code, segment_id, cell) VALUES ($1, $2, $3, $4, 'Cell 1')",
    [id, A, `FC-${keyCounter++}`, SEG_A],
  );
  return id;
}

async function raised(kind: 'stopped' | 'support' = 'stopped'): Promise<string> {
  const res = await post('/api/v1/tickets', f.tokens.technician!, {
    machineId: await newMachine(),
    kind,
    problem: 'Spindle alarm',
  });
  expect(res.statusCode, res.body).toBe(201);
  const id = res.json().ticket.id as string;
  expect((await post(`/api/v1/tickets/${id}/start`, f.tokens.technician!, {})).statusCode).toBe(
    200,
  );
  return id;
}

const close = (id: string, payload: object, token = f.tokens.technician!) =>
  post(`/api/v1/tickets/${id}/close`, token, payload);

const detail = (id: string) => f.call('GET', `/api/v1/tickets/${id}`, f.tokens.head!);

const errorOf = (res: Res): Record<string, unknown> => res.json().error as Record<string, unknown>;

beforeAll(async () => {
  f = await startFixture();
  // The plant's list, as 47a seeds it: E carries Bhavin's old ELE, and MEC is not aliased (N12 owns it).
  await f.admin.query(
    `INSERT INTO list_item (tenant_id, list, code, label, aliases) VALUES
       ($1, 'failure_code', 'E', 'Electronics/Electrical', ARRAY['ele']),
       ($1, 'failure_code', 'M', 'Mechanical', '{}')`,
    [A],
  );
  await f.admin.query(
    "INSERT INTO machine (id, tenant_id, code, segment_id, cell) VALUES ($1, $2, 'FC-PAST', $3, 'Cell 1')",
    [MACHINE, A, SEG_A],
  );
}, 120_000);

afterAll(async () => f.stop());

describe('a live breakdown close records one code', () => {
  it('refuses a close with a report and no code, writing nothing', async () => {
    const id = await raised();
    const refused = await close(id, { kind: 'report', report: { correctiveAction: 'Fixed' } });
    expect(refused.statusCode).toBe(422);
    expect(errorOf(refused)).toMatchObject({
      code: 'validation',
      message: 'A failure code is required',
      field: 'failureComponent',
    });
    expect(
      (await f.admin.query('SELECT 1 FROM breakdown_report WHERE ticket_id = $1', [id])).rowCount,
    ).toBe(0);
    expect((await detail(id)).json().ticket.status).toBe('working');
  });

  it('accepts a client built before this ticket through maintCode, stored as the failure component', async () => {
    const id = await raised();
    const accepted = await close(id, {
      kind: 'report',
      report: { correctiveAction: 'Fixed', maintCode: 'E' },
    });
    expect(accepted.statusCode, accepted.body).toBe(200);
    expect((await detail(id)).json().report).toMatchObject({
      failureComponent: 'E',
      maintCode: 'E',
    });
  });

  it('resolves an alias in any letter case and mirrors the canonical code into maint_code', async () => {
    const id = await raised();
    const accepted = await close(id, {
      kind: 'report',
      report: { correctiveAction: 'Fixed', failureComponent: 'ELE' },
    });
    expect(accepted.statusCode, accepted.body).toBe(200);
    expect((await detail(id)).json().report).toMatchObject({
      failureComponent: 'E',
      maintCode: 'E',
    });
  });

  it('refuses a kind:report close with no report body on a live breakdown', async () => {
    const id = await raised();
    const refused = await close(id, { kind: 'report' });
    expect(refused.statusCode).toBe(422);
    expect(errorOf(refused)).toMatchObject({
      code: 'validation',
      message: 'A report is required to close a breakdown',
      field: 'report',
    });
    expect(
      (await f.admin.query('SELECT 1 FROM breakdown_report WHERE ticket_id = $1', [id])).rowCount,
    ).toBe(0);
  });

  it('refuses an unknown code with the pinned message and never writes', async () => {
    const id = await raised();
    const refused = await close(id, {
      kind: 'report',
      report: { correctiveAction: 'Fixed', failureComponent: 'NOPE' },
    });
    expect(refused.statusCode).toBe(422);
    expect(errorOf(refused)).toMatchObject({
      code: 'validation',
      message: 'That is not a failure code of this plant',
      field: 'failureComponent',
    });
    expect(
      (await f.admin.query('SELECT 1 FROM breakdown_report WHERE ticket_id = $1', [id])).rowCount,
    ).toBe(0);
  });

  it('keeps no_report and done closes exempt, and asks the late report for the code', async () => {
    const noReport = await raised();
    const exempt = await close(noReport, { kind: 'no_report' });
    expect(exempt.statusCode, exempt.body).toBe(200);
    expect((await detail(noReport)).json().report).toBeNull();

    const refused = await post(`/api/v1/tickets/${noReport}/report`, f.tokens.technician!, {
      report: {},
    });
    expect(refused.statusCode).toBe(422);
    expect(errorOf(refused)).toMatchObject({
      message: 'A failure code is required',
      field: 'failureComponent',
    });

    const late = await post(`/api/v1/tickets/${noReport}/report`, f.tokens.technician!, {
      report: { failureComponent: 'M' },
    });
    expect(late.statusCode, late.body).toBe(200);
    expect(late.json().ticket.closeKind).toBe('report');

    const done = await raised();
    expect((await close(done, { kind: 'done' })).statusCode).toBe(200);
  });

  it('leaves support tickets, planned work and past breakdowns uncoded', async () => {
    const support = await raised('support');
    expect((await close(support, { kind: 'report', report: {} })).statusCode).toBe(200);

    for (const channel of ['pm', 'inspection'] as const) {
      const machineId = await newMachine();
      const planned = await withTenant(f.db.app, A, (client) =>
        raisePlannedTicket(client, {
          tenantId: A,
          machineId,
          channel,
          problem: 'Planned service',
        }),
      );
      expect(
        (await post(`/api/v1/tickets/${planned.id}/start`, f.tokens.technician!, {})).statusCode,
      ).toBe(200);
      const closed = await close(planned.id, {
        kind: 'report',
        report: { correctiveAction: 'Done' },
      });
      expect(closed.statusCode, closed.body).toBe(200);
      expect((await detail(planned.id)).json().report.failureComponent).toBeNull();
    }

    const past = await post('/api/v1/tickets/past', f.tokens.technician!, {
      machineId: MACHINE,
      reportedAt: '2026-03-10T04:00:00.000Z',
      runningAt: '2026-03-10T05:00:00.000Z',
      problem: 'Old paper',
      report: { correctiveAction: 'Replaced the belt' },
    });
    expect(past.statusCode, past.body).toBe(201);
    expect(
      (await detail(past.json().ticket.id as string)).json().report.failureComponent,
    ).toBeNull();
  });
});

describe('one code on read, only in the analytics loader', () => {
  it('resolves a legacy alias but never erases MEC or a blank, and the report keeps what it recorded', async () => {
    const legacy = randomUUID();
    await f.admin.query(
      `INSERT INTO ticket (id, tenant_id, ref, kind, status, machine_id, problem, reported_at, closed_at, closed_by_person_id, close_kind, raised_channel, severity)
       VALUES ($1, $2, 'BD-9001', 'stopped', 'closed', $3, 'Legacy row', now(), now(), NULL, 'report', 'import', 'S3')`,
      [legacy, A, M_USED],
    );
    const ids = { ele: randomUUID(), mec: randomUUID(), blank: randomUUID() };
    for (const [key, code, problem] of [
      ['ele', 'ELE', 'Legacy ELE'],
      ['mec', 'MEC', 'Legacy MEC'],
      ['blank', null, 'Legacy blank'],
    ] as const) {
      await f.admin.query(
        `INSERT INTO breakdown_report (id, tenant_id, ticket_id, machine_id, date, shift_code, problem, downtime_min, maint_code)
         VALUES ($1, $2, $3, $4, '2026-03-10', '1', $5, 30, $6)`,
        [ids[key], A, key === 'ele' ? legacy : null, M_USED, problem, code],
      );
    }

    const shown = (await detail(legacy)).json().report;
    expect(shown.maintCode).toBe('ELE');

    const data = await withTenant(f.db.app, A, (tx) => loadEngineData(tx, A));
    const codes = new Map(data.reports.map((row) => [row.id, row.maintCode]));
    expect(codes.get(ids.ele)).toBe('E');
    expect(codes.get(ids.mec)).toBe('MEC');
    expect(codes.get(ids.blank)).toBeNull();
  });
});
