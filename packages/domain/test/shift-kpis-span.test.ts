import { DEFAULT_PROFILE } from '@uptimo/shared';
import { describe, expect, it } from 'vitest';
import { runWith, type EngineData, type ReportRow, type TicketRow } from '../src/index.js';
import { COMPUTERS } from '../src/analytics/computers.js';
import { isPm, sourcedReports } from '../src/analytics/rows.js';
import { failureEvents, standardTotals } from '../src/analytics/standard-kpis.js';
import { ENGINE_DATA } from './answer-key/fixture.js';

/**
 * Shift KPIs over one span (ADR 0036, Remaining 3; #703): failures and PM hours count over the same span as the
 * working hours they are divided by. The answer-key fixture is 2026-only; one failure and one closed PM row are
 * cloned into 2025, before the as-of year to date, and must change nothing.
 */

const AS_OF = '2026-11-11';

function clone(row: ReportRow, date: string): ReportRow {
  return { ...row, id: `${row.id}-earlier`, date };
}

function withEarlierRows(date = '2025-06-02'): EngineData {
  const event = failureEvents(ENGINE_DATA).find((candidate) =>
    ENGINE_DATA.tickets.some((ticket) => ticket.id === candidate.report.ticketId),
  )!;
  // Its own ticket, so a drill list that reads it grows by one id.
  const ticket = { ...event.ticket, id: `${event.ticket.id}-earlier` } as TicketRow;
  const failure = { ...event.report, ticketId: ticket.id };
  const pm = sourcedReports(ENGINE_DATA).find(
    (row) => isPm(row) && row.ticket.status === 'closed',
  )!.report;
  return {
    ...ENGINE_DATA,
    tickets: [...ENGINE_DATA.tickets, ticket],
    reports: [...ENGINE_DATA.reports, clone(failure, date), clone(pm, date)],
  };
}

function figure(data: EngineData, key: string) {
  const compute = COMPUTERS[key];
  if (compute === undefined) throw new Error(`the engine knows no figure ${key}`);
  const result = runWith({ [key]: compute }, { data, asOf: AS_OF, profile: DEFAULT_PROFILE });
  const found = result.figures.find((candidate) => candidate.key === key);
  if (!found) throw new Error(`the engine knows no figure ${key}`);
  return found;
}

describe('Shift KPIs count over the working hours’ own span', () => {
  const base = standardTotals(ENGINE_DATA, DEFAULT_PROFILE, AS_OF);
  const earlier = withEarlierRows();

  it('leaves a failure and a PM row from before the year to date out of every total', () => {
    const totals = standardTotals(earlier, DEFAULT_PROFILE, AS_OF);
    expect(totals.failures).toBe(base.failures);
    expect(totals.breakdownHours).toBeCloseTo(base.breakdownHours, 10);
    expect(totals.pmHours).toBeCloseTo(base.pmHours, 10);
    expect(totals.mtbf).toBe(base.mtbf);
    expect(totals.availability).toBe(base.availability);
  });

  it('drills only the failures it counted, on the compare figure and the shift split', () => {
    expect(figure(earlier, 'shift-kpis.compare').drill.ids).toHaveLength(base.failures);
    expect(figure(earlier, 'shift-kpis.shift-split').drill.ids).toHaveLength(base.failures);
  });

  it('keeps the shift split’s plant row on the same count', () => {
    const value = figure(earlier, 'shift-kpis.shift-split').value as unknown as {
      shifts: Array<{ breakdowns: number }>;
    };
    expect(value.shifts.reduce((sum, row) => sum + row.breakdowns, 0)).toBe(base.failures);
  });
});
