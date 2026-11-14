// Ticket 18: a past breakdown is counted once where reports read tickets: the day report and the stored figures.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { withTenant } from '@uptimo/db';
import { loadDayReport } from '../src/modules/reports/day-report.js';
import {
  TENANT,
  db,
  freshMachine,
  get,
  past,
  person,
  span,
  startPlant,
  stopPlant,
  tech,
} from './tickets-past-fixture.js';

beforeAll(startPlant, 120_000);
afterAll(stopPlant);

const dayJobs = (personId: string) =>
  withTenant(db.app, TENANT, async (client) => {
    const report = await loadDayReport(client, {
      tenantId: TENANT,
      personId,
      date: '2026-03-10',
      shift: null,
    });
    if (!report || report === 'no-shift') throw new Error('No day report');
    return report;
  });

describe('a past breakdown in the reports', () => {
  it('shows once in the day report of the person who reported it and of the one who fixed it, with no work minutes, and never for anyone else', async () => {
    const res = await past(
      tech(),
      span(freshMachine(), '04:00', '05:00', {
        reportedByPersonId: person(0),
        closedByPersonId: person(1),
      }),
    );
    expect(res.statusCode).toBe(201);
    const { id, ref } = res.json().ticket;
    for (const personId of [person(0), person(1)]) {
      const report = await dayJobs(personId);
      const jobs = report.jobs.filter((job) => job.ticketId === id);
      expect(jobs, `person ${personId}`).toHaveLength(1);
      expect(jobs[0]).toMatchObject({ ref, minutes: 0 });
      expect(report.totalMinutes).toBe(0);
    }
    expect((await dayJobs(person(2))).jobs.some((job) => job.ticketId === id)).toBe(false);
  });

  it('keeps the stored figures as entered when it is read again, however often', async () => {
    const res = await past(tech(), span(freshMachine(), '06:00', '07:30', {}));
    const id = res.json().ticket.id as string;
    const first = (await get(`/api/v1/tickets/${id}`, tech())).json().ticket.figures;
    const again = (await get(`/api/v1/tickets/${id}`, tech())).json().ticket.figures;
    expect(first).toMatchObject({ downtimeMin: 90 });
    expect(again).toEqual(first);
    const listed = (await get('/api/v1/tickets?status=closed', tech())).json().items;
    expect(listed.find((t: { id: string }) => t.id === id).figures).toMatchObject({
      downtimeMin: 90,
    });
  });
});
