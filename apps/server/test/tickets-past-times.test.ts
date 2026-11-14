// Ticket 18: the times of a past breakdown, and how it fits with the machine's other breakdowns.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { countAuditRows } from '../src/modules/ops/index.js';
import {
  TENANT,
  admin,
  at,
  freshMachine,
  get,
  insertTicket,
  past,
  span,
  startPlant,
  stopPlant,
  tech,
} from './tickets-past-fixture.js';

beforeAll(startPlant, 120_000);
afterAll(stopPlant);

describe('the times', () => {
  const refused = async (payload: Record<string, unknown>, field: string, status = 422) => {
    const before = await countAuditRows(admin, TENANT);
    const res = await past(tech(), payload);
    expect(res.statusCode).toBe(status);
    expect(res.json().error.field).toBe(field);
    expect(await countAuditRows(admin, TENANT)).toBe(before);
    const listed = await get(`/api/v1/tickets?machineId=${payload.machineId as string}`, tech());
    expect(listed.json().items).toHaveLength(0);
  };

  it('refuses work that starts before the report, naming workStartedAt', async () => {
    await refused(
      span(freshMachine(), '05:00', '07:00', { workStartedAt: at('04:30') }),
      'workStartedAt',
    );
  });

  it('refuses a machine that runs before the report, naming runningAt', async () => {
    await refused(span(freshMachine(), '05:00', '04:00'), 'runningAt');
  });

  it('refuses a machine that runs before work began, naming runningAt', async () => {
    await refused(
      span(freshMachine(), '05:00', '06:00', { workStartedAt: at('06:30') }),
      'runningAt',
    );
  });

  it('refuses a time in the future, naming that field', async () => {
    const future = new Date(Date.now() + 3600_000).toISOString();
    const base = { machineId: freshMachine(), problem: 'Spindle alarm' };
    await refused({ ...base, reportedAt: future, runningAt: future }, 'reportedAt');
    await refused(
      { ...base, reportedAt: at('04:00'), workStartedAt: future, runningAt: future },
      'workStartedAt',
    );
    await refused({ ...base, reportedAt: at('04:00'), runningAt: future }, 'runningAt');
  });

  it('accepts equal times', async () => {
    const res = await past(
      tech(),
      span(freshMachine(), '05:00', '05:00', { workStartedAt: at('05:00') }),
    );
    expect(res.statusCode).toBe(201);
    expect(
      (await get(`/api/v1/tickets/${res.json().ticket.id}`, tech())).json().ticket.figures
        .downtimeMin,
    ).toBe(0);
  });
});

describe("overlap with the machine's other breakdowns", () => {
  it('refuses a period that overlaps a closed one, however it overlaps', async () => {
    const m = freshMachine();
    expect((await past(tech(), span(m, '05:00', '07:00'))).statusCode).toBe(201);
    for (const [from, to] of [
      ['06:00', '08:00'],
      ['04:00', '05:30'],
      ['05:30', '06:30'],
      ['04:00', '08:00'],
    ] as const) {
      const res = await past(tech(), span(m, from, to));
      expect(res.statusCode, `${from}-${to}`).toBe(409);
      expect(res.json().error).toMatchObject({ code: 'conflict', field: 'reportedAt' });
    }
  });

  it('accepts periods before, after and touching the end of another', async () => {
    const m = freshMachine();
    expect((await past(tech(), span(m, '05:00', '07:00'))).statusCode).toBe(201);
    for (const [from, to] of [
      ['03:00', '04:00'],
      ['08:00', '09:00'],
      ['07:00', '08:00'],
      ['04:00', '05:00'],
    ] as const) {
      expect((await past(tech(), span(m, from, to))).statusCode, `${from}-${to}`).toBe(201);
    }
  });

  it('refuses an overlap with an imported ticket and with a live closed ticket', async () => {
    const m = freshMachine();
    await insertTicket(m, { status: 'closed', from: '05:00', to: '07:00', channel: 'import' });
    await insertTicket(m, { status: 'closed', from: '09:00', to: '10:00', channel: 'floor' });
    expect((await past(tech(), span(m, '06:00', '06:30'))).statusCode).toBe(409);
    expect((await past(tech(), span(m, '09:30', '09:45'))).statusCode).toBe(409);
    expect((await past(tech(), span(m, '07:00', '09:00'))).statusCode).toBe(201);
  });

  it('refuses an overlap with an open ticket, which has no end yet', async () => {
    const m = freshMachine();
    await insertTicket(m, { status: 'open', from: '09:00', channel: 'floor' });
    expect((await past(tech(), span(m, '08:00', '10:00'))).statusCode).toBe(409);
    expect((await past(tech(), span(m, '11:00', '12:00'))).statusCode).toBe(409);
    expect((await past(tech(), span(m, '05:00', '09:00'))).statusCode).toBe(201);
  });

  it('is not blocked by a cancelled ticket or by a general job, and takes a switched-off machine', async () => {
    const m = freshMachine();
    await insertTicket(m, { status: 'cancelled', from: '05:00', to: '07:00', channel: 'floor' });
    await admin.query("UPDATE machine SET status = 'scrapped' WHERE id = $1", [m]);
    expect((await past(tech(), span(m, '05:30', '06:30'))).statusCode).toBe(201);
  });
});
