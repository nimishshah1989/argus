import { describe, expect, it } from 'vitest';
import type { Figures, Ticket } from '../../api.js';
import {
  cancelledLast24h,
  closedLast30Days,
  dayReportHref,
  monthlyTotals,
  todayDate,
  workingByPerson,
} from './views.js';

const NOW = new Date('2026-11-11T12:00:00.000Z').getTime();

function figures(overrides: Partial<Figures> = {}): Figures {
  return {
    responseMin: null,
    activeMin: 0,
    waitMin: 0,
    vendorMin: 0,
    handoverWaitMin: 0,
    downAccMin: 0,
    downtimeMin: null,
    followMin: null,
    repairMin: 0,
    perPerson: {},
    ...overrides,
  };
}

function ticket(overrides: Partial<Ticket> = {}): Ticket {
  return {
    id: 'ticket-1',
    ref: 'BD-0001',
    kind: 'stopped',
    status: 'closed',
    machineId: 'machine-1',
    machineSnapshot: { code: 'VC-1', category: 'VMC', cell: 'Cell-1' },
    problem: 'Spindle alarm',
    reportedAt: '2026-11-10T09:00:00.000Z',
    reportedByPersonId: 'person-1',
    location: null,
    workType: null,
    urgent: false,
    handedOver: false,
    startedAt: '2026-11-10T09:10:00.000Z',
    leadPersonId: 'person-1',
    waitReason: null,
    machineRunningAt: null,
    closedAt: '2026-11-10T11:00:00.000Z',
    closeKind: 'report',
    closeNote: null,
    figures: null,
    ...overrides,
  };
}

describe('window filtering', () => {
  it('keeps cancelled tickets from the last 24 hours only', () => {
    const fresh = ticket({ status: 'cancelled', closedAt: '2026-11-11T09:00:00.000Z' });
    const stale = ticket({ status: 'cancelled', closedAt: '2026-11-09T09:00:00.000Z' });
    expect(cancelledLast24h([fresh, stale], NOW)).toEqual([fresh]);
  });

  it('falls back to startedAt then reportedAt for a cancelled ticket', () => {
    const started = ticket({
      status: 'cancelled',
      closedAt: null,
      startedAt: '2026-11-11T10:00:00.000Z',
    });
    const reported = ticket({
      status: 'cancelled',
      closedAt: null,
      startedAt: null,
      reportedAt: '2026-11-11T11:00:00.000Z',
    });
    const stale = ticket({
      status: 'cancelled',
      closedAt: null,
      startedAt: null,
      reportedAt: '2026-11-01T11:00:00.000Z',
    });
    expect(cancelledLast24h([started, reported, stale], NOW)).toEqual([reported, started]);
  });

  it('keeps closed tickets from the last 30 days only', () => {
    const fresh = ticket({ closedAt: '2026-11-01T09:00:00.000Z' });
    const stale = ticket({ closedAt: '2026-09-01T09:00:00.000Z' });
    expect(closedLast30Days([fresh, stale], NOW)).toEqual([fresh]);
  });
});

describe('workingByPerson', () => {
  it('groups working tickets by lead with hands-on minutes', () => {
    const a = ticket({
      status: 'working',
      leadPersonId: 'person-1',
      figures: figures({ activeMin: 30 }),
    });
    const b = ticket({
      status: 'working',
      leadPersonId: 'person-1',
      figures: figures({ activeMin: 10 }),
    });
    const c = ticket({
      status: 'working',
      leadPersonId: 'person-2',
      figures: figures({ activeMin: 50 }),
    });
    const open = ticket({
      status: 'open',
      leadPersonId: null,
      figures: figures({ activeMin: 99 }),
    });
    expect(workingByPerson([a, b, c, open])).toEqual([
      { personId: 'person-2', tickets: [c], minutes: 50 },
      { personId: 'person-1', tickets: [a, b], minutes: 40 },
    ]);
  });
});

describe('monthlyTotals', () => {
  it('splits primary and support minutes per person and month', () => {
    const october = ticket({
      closedAt: '2026-10-05T10:00:00.000Z',
      leadPersonId: 'person-1',
      figures: figures({ activeMin: 30, perPerson: { 'person-1': 20, 'person-2': 10 } }),
    });
    const november = ticket({
      closedAt: '2026-11-05T10:00:00.000Z',
      leadPersonId: 'person-2',
      figures: figures({ activeMin: 90, perPerson: { 'person-2': 60, 'person-1': 30 } }),
    });
    const totals = monthlyTotals([october, november]);
    expect(totals.map((month) => month.month)).toEqual(['2026-11', '2026-10']);
    expect(totals[0]?.primary).toBe(60);
    expect(totals[0]?.support).toBe(30);
    expect(totals[1]?.rows).toEqual([
      { personId: 'person-1', primary: 20, support: 0 },
      { personId: 'person-2', primary: 0, support: 10 },
    ]);
  });

  it('falls back to the lead hands-on minutes when the list has no perPerson', () => {
    const closed = ticket({ leadPersonId: 'person-1', figures: figures({ activeMin: 45 }) });
    expect(monthlyTotals([closed])).toEqual([
      {
        month: '2026-11',
        rows: [{ personId: 'person-1', primary: 45, support: 0 }],
        primary: 45,
        support: 0,
      },
    ]);
  });

  it('ignores tickets that are not closed', () => {
    expect(monthlyTotals([ticket({ status: 'cancelled' })])).toEqual([]);
  });
});

describe('day report', () => {
  it('builds the dated download path', () => {
    expect(todayDate(new Date('2026-11-11T12:00:00'))).toBe('2026-11-11');
    expect(dayReportHref('2026-11-11')).toBe('/api/v1/reports/day.pdf?date=2026-11-11');
  });
});
