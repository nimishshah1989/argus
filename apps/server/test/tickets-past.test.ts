// Ticket 18: record a breakdown that already happened, as a closed ticket.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { LOGIN_ROLES } from '@uptimo/shared';
import { countAuditRows } from '../src/modules/ops/index.js';
import {
  OTHER_MACHINE,
  OTHER_PERSON,
  TENANT,
  admin,
  adminToken,
  at,
  freshMachine,
  get,
  otherToken,
  past,
  person,
  send,
  span,
  startPlant,
  stopPlant,
  tech,
  tokens,
} from './tickets-past-fixture.js';

beforeAll(startPlant, 120_000);
afterAll(stopPlant);

const ALLOWED = ['technician', 'supervisor', 'head', 'admin'];

describe('who may record a past breakdown', () => {
  it.each([...LOGIN_ROLES])('%s', async (role) => {
    const res = await past(tokens[role] as string, span(freshMachine(), '04:00', '05:00'));
    expect(res.statusCode).toBe(ALLOWED.includes(role) ? 201 : 403);
  });

  it('refuses an anonymous caller', async () => {
    const res = await send({
      url: '/api/v1/tickets/past',
      payload: span(freshMachine(), '04:00', '05:00'),
    });
    expect(res.statusCode).toBe(401);
  });

  it('needs an Idempotency-Key', async () => {
    const res = await send({
      url: '/api/v1/tickets/past',
      token: tech(),
      payload: span(freshMachine(), '04:00', '05:00'),
      key: null,
    });
    expect(res.statusCode).toBe(422);
  });
});

describe('one plant never sees another', () => {
  it("answers 404 for another plant's machine and person, and hides the ticket from the other plant", async () => {
    expect((await past(tech(), span(OTHER_MACHINE, '04:00', '05:00'))).statusCode).toBe(404);
    const stranger = await past(
      tech(),
      span(freshMachine(), '04:00', '05:00', { reportedByPersonId: OTHER_PERSON }),
    );
    expect(stranger.statusCode).toBe(404);
    expect(stranger.json().error.field).toBe('reportedByPersonId');
    const made = await past(tech(), span(freshMachine(), '04:00', '05:00'));
    const id = made.json().ticket.id as string;
    expect((await get(`/api/v1/tickets/${id}`, tech())).statusCode).toBe(200);
    expect((await get(`/api/v1/tickets/${id}`, otherToken, 'plant-two.localhost')).statusCode).toBe(
      404,
    );
  });

  it('answers 404 for an unknown person in the report', async () => {
    const res = await past(
      tech(),
      span(freshMachine(), '04:00', '05:00', { report: { doneByPersonIds: [OTHER_PERSON] } }),
    );
    expect(res.statusCode).toBe(404);
    expect(res.json().error.field).toBe('report.doneByPersonIds');
  });
});

describe('what is recorded', () => {
  it('reads back as a closed breakdown with its report, times and figures', async () => {
    const m = freshMachine();
    const fields = {
      observedBy: 'Night operator',
      correctiveAction: 'Replaced the coolant pump',
      rootCause: 'Worn seal',
      breakdownCategory: 'M',
      maintCode: 'PM-7',
      spareUsed: 'Seal kit',
      handoverName: 'Test head',
    };
    const report = { ...fields, doneByPersonIds: [person(1)], supportedByPersonIds: [person(2)] };
    const res = await past(
      adminToken(),
      span(m, '04:00', '05:30', {
        workStartedAt: at('04:20'),
        reportedByPersonId: person(0),
        closedByPersonId: person(1),
        report,
      }),
    );
    expect(res.statusCode).toBe(201);
    const created = res.json().ticket;
    expect(created).toMatchObject({
      kind: 'stopped',
      status: 'closed',
      closeKind: 'report',
      raisedChannel: 'backfill',
      machineId: m,
    });
    expect(created.ref).toMatch(/^BD-\d+$/);

    const detail = (await get(`/api/v1/tickets/${created.id}`, tech())).json();
    expect(detail.ticket).toMatchObject({
      status: 'closed',
      closeKind: 'report',
      problem: 'Spindle alarm',
      closedByPersonId: person(1),
      reportedByPersonId: person(0),
    });
    expect(new Date(detail.ticket.startedAt).toISOString()).toBe(at('04:20'));
    expect(detail.events.map((e: { type: string }) => e.type)).toEqual(['down', 'close']);
    expect(detail.events.map((e: { at: string }) => new Date(e.at).toISOString())).toEqual([
      at('04:00'),
      at('05:30'),
    ]);
    expect(detail.ticket.figures).toMatchObject({
      downtimeMin: 90,
      responseMin: 20,
      repairMin: 70,
      activeMin: 0,
      waitMin: 0,
    });
    expect(detail.ticket.figures.overridden).toEqual(
      expect.arrayContaining(['downtimeMin', 'responseMin', 'repairMin']),
    );
    expect(detail.report).toMatchObject({
      ...fields,
      problem: 'Spindle alarm',
      downtimeMin: 90,
      responseMin: 20,
      repairMin: 70,
    });
    expect(detail.report.people).toEqual(
      expect.arrayContaining([
        { personId: person(1), role: 'done' },
        { personId: person(2), role: 'supported' },
      ]),
    );
  });

  it('leaves response and repair empty without a work start, with no made-up minutes', async () => {
    const res = await past(tech(), span(freshMachine(), '04:00', '05:00'));
    const detail = (await get(`/api/v1/tickets/${res.json().ticket.id}`, tech())).json();
    expect(detail.ticket.figures).toMatchObject({
      downtimeMin: 60,
      responseMin: null,
      activeMin: 0,
      waitMin: 0,
      vendorMin: 0,
      handoverWaitMin: 0,
    });
    expect(detail.ticket.figures.followMin).toBeNull();
    expect(Number.isNaN(detail.ticket.figures.repairMin)).toBe(false);
    expect(detail.ticket.startedAt).toBeNull();
    expect(detail.report.repairMin).toBeNull();
    expect(detail.report.downtimeMin).toBe(60);
  });

  it('lets the minutes typed on the form win over the ones the times give', async () => {
    const res = await past(
      tech(),
      span(freshMachine(), '04:00', '06:00', {
        workStartedAt: at('04:10'),
        report: { downtimeMin: 45, responseMin: 5, repairMin: 30 },
      }),
    );
    const detail = (await get(`/api/v1/tickets/${res.json().ticket.id}`, tech())).json();
    expect(detail.ticket.figures).toMatchObject({ downtimeMin: 45, responseMin: 5, repairMin: 30 });
    expect(detail.report).toMatchObject({ downtimeMin: 45, responseMin: 5, repairMin: 30 });
  });

  it('files the report under the shift and plant date of the stop unless the form says otherwise', async () => {
    const day = (await past(tech(), span(freshMachine(), '04:00', '05:00'))).json().ticket.id;
    expect((await get(`/api/v1/tickets/${day}`, tech())).json().report).toMatchObject({
      date: '2026-03-10',
      shiftCode: '1',
    });
    // 20:00 UTC is 01:30 the next morning at the plant: shift 2, whose production date is the day it started.
    const night = (await past(tech(), span(freshMachine(), '20:00', '21:00'))).json().ticket.id;
    expect((await get(`/api/v1/tickets/${night}`, tech())).json().report).toMatchObject({
      date: '2026-03-10',
      shiftCode: '2',
    });
    const given = (
      await past(
        tech(),
        span(freshMachine(), '20:00', '21:00', {
          report: { date: '2026-03-09', shiftCode: '1', problem: 'Own words' },
        }),
      )
    ).json().ticket.id;
    expect((await get(`/api/v1/tickets/${given}`, tech())).json().report).toMatchObject({
      date: '2026-03-09',
      shiftCode: '1',
      problem: 'Own words',
    });
  });

  it('asks for the shift when none covers the stop, and writes nothing', async () => {
    const m = freshMachine();
    // 00:30 UTC is 06:00 at the plant, between the two shifts.
    const payload = span(m, '00:30', '01:30');
    const before = await countAuditRows(admin, TENANT);
    const res = await past(tech(), payload);
    expect(res.statusCode).toBe(422);
    expect(res.json().error.field).toBe('report.shiftCode');
    expect((await get(`/api/v1/tickets?machineId=${m}`, tech())).json().items).toHaveLength(0);
    expect(await countAuditRows(admin, TENANT)).toBe(before);
    expect((await past(tech(), { ...payload, report: { shiftCode: '1' } })).statusCode).toBe(201);
  });

  it('a refusal does not use up a reference number', async () => {
    const first = await past(tech(), span(freshMachine(), '04:00', '05:00'));
    expect(first.statusCode).toBe(201);
    const n = Number(String(first.json().ticket.ref).split('-')[1]);
    // 00:30 UTC is 06:00 at the plant, between the two shifts: refused after the numbers are checked.
    expect((await past(tech(), span(freshMachine(), '00:30', '01:30'))).statusCode).toBe(422);
    const next = await past(tech(), span(freshMachine(), '04:00', '05:00'));
    expect(next.json().ticket.ref).toBe(`BD-${String(n + 1).padStart(4, '0')}`);
  });

  it('the down and close events say who entered the record, and who reported and fixed it', async () => {
    const m = freshMachine();
    const res = await past(
      tech(),
      span(m, '04:00', '05:00', { reportedByPersonId: person(0), closedByPersonId: person(1) }),
    );
    expect(res.statusCode).toBe(201);
    const login = (
      await admin.query("SELECT id FROM login WHERE tenant_id = $1 AND role = 'technician'", [
        TENANT,
      ])
    ).rows[0].id as string;
    const events = (await get(`/api/v1/tickets/${res.json().ticket.id}`, tech())).json().events;
    expect(events.map((e: { type: string }) => e.type)).toEqual(['down', 'close']);
    expect(events.map((e: { loginId: string }) => e.loginId)).toEqual([login, login]);
    expect(events.map((e: { actingPersonId: string }) => e.actingPersonId)).toEqual([
      person(0),
      person(1),
    ]);
  });

  it('records one audit line', async () => {
    const before = await countAuditRows(admin, TENANT);
    expect((await past(tech(), span(freshMachine(), '04:00', '05:00'))).statusCode).toBe(201);
    expect(await countAuditRows(admin, TENANT)).toBe(before + 1);
  });

  it('replays the first answer for a repeated key and creates no second ticket', async () => {
    const m = freshMachine();
    const first = await past(tech(), span(m, '04:00', '05:00'), 'replay-1');
    const again = await past(tech(), span(m, '04:00', '05:00'), 'replay-1');
    expect(first.statusCode).toBe(201);
    expect(again.json().ticket.id).toBe(first.json().ticket.id);
    expect((await get(`/api/v1/tickets?machineId=${m}`, tech())).json().items).toHaveLength(1);
  });

  it('turns up in the closed-ticket list and the machine filter', async () => {
    const m = freshMachine();
    const id = (await past(tech(), span(m, '04:00', '05:00'))).json().ticket.id;
    for (const query of [
      `status=closed&machineId=${m}`,
      `status=closed&kind=stopped&machineId=${m}`,
    ]) {
      const items = (await get(`/api/v1/tickets?${query}`, tech())).json().items as Array<{
        id: string;
      }>;
      expect(items.map((t) => t.id)).toEqual([id]);
    }
    expect(
      (await get(`/api/v1/tickets?status=open&machineId=${m}`, tech())).json().items,
    ).toHaveLength(0);
  });
});
