import { DEFAULT_PROFILE } from '@uptimo/shared';
import { describe, expect, it } from 'vitest';
import { dataFrom } from '../../src/analytics/as-of.js';
import { run, type EngineData, type ReportRow, type TicketRow } from '../../src/index.js';
import { ENGINE_DATA } from '../answer-key/fixture.js';
import { HISTORY, withFrom } from '../history-fixture.js';

/** Ticket 621, hidden: the edges of the data-from cut (ADR 0027). */

const AS_OF = '2026-11-11';
const T = ENGINE_DATA.tickets[0] as TicketRow;
const R = ENGINE_DATA.reports[0] as ReportRow;
const ticket = (id: string, reportedAt: string): TicketRow => ({ ...T, id, ref: id, reportedAt });
const report = (id: string, ticketId: string | null, date: string): ReportRow => ({
  ...R,
  id,
  ticketId,
  date,
});

/** Asia/Kolkata is UTC+5:30: 18:29Z on 31 Dec is 23:59 that day, 18:30Z is 00:00 on 1 Jan. */
const SMALL: EngineData = {
  ...ENGINE_DATA,
  tickets: [
    ticket('before', '2025-12-31T18:29:00.000Z'),
    ticket('on', '2025-12-31T18:30:00.000Z'),
    ticket('after', '2026-03-02T05:00:00.000Z'),
  ],
  tasks: [
    {
      ...ticket('task-old', '2025-11-01T05:00:00.000Z'),
      parentId: 'before',
      reason: null,
      expectedOn: null,
    },
    {
      ...ticket('task-new', '2026-02-01T05:00:00.000Z'),
      parentId: 'on',
      reason: null,
      expectedOn: null,
    },
  ],
  reports: [
    report('r-before', 'before', '2026-01-01'),
    report('r-on', 'on', '2026-01-01'),
    report('r-old-free', null, '2025-12-31'),
    report('r-new-free', null, '2026-01-01'),
  ],
  plantEvents: [
    { ticketId: 'before', lines: [] },
    { ticketId: 'after', lines: [] },
  ],
  whyWhy: [
    { ...whyWhyRow(), ticketId: 'before' },
    { ...whyWhyRow(), ticketId: 'on' },
  ],
};

function whyWhyRow() {
  return {
    ticketId: '',
    whys: ['a', 'b', 'c', 'd', 'e'] as const,
    conclusion: 'c',
    completedBy: 'P1',
    completedDate: '2026-01-02',
  };
}

describe('dataFrom, hidden edges', () => {
  const cut = dataFrom(SMALL, '2026-01-01');

  it('cuts by the plant day in the plant time zone, not the UTC day', () => {
    expect(cut.tickets.map((t) => t.id)).toEqual(['on', 'after']);
    expect(cut.tasks.map((t) => t.id)).toEqual(['task-new']);
  });

  it('a pre-cut ticket takes its report, plant event and Why-Why record with it', () => {
    expect(cut.reports.map((r) => r.id)).toEqual(['r-on', 'r-new-free']);
    expect(cut.plantEvents?.map((e) => e.ticketId)).toEqual(['after']);
    expect(cut.whyWhy?.map((w) => w.ticketId)).toEqual(['on']);
  });

  it('leaves machines, moves, people, lists and settings alone', () => {
    expect(cut.machines).toBe(SMALL.machines);
    expect(cut.moves).toBe(SMALL.moves);
    expect(cut.people).toBe(SMALL.people);
    expect(cut.lists).toBe(SMALL.lists);
    expect(cut.settings).toBe(SMALL.settings);
  });
});

describe('dataFrom in a run', () => {
  it('a named span still reads its own period: 2024 is reachable', () => {
    const span = { from: '2024-01-01', to: '2024-12-31' };
    const withCut = run(withFrom(HISTORY, '2026-01-01'), AS_OF, DEFAULT_PROFILE, span).figures;
    const without = run(HISTORY, AS_OF, DEFAULT_PROFILE, span).figures;
    expect(withCut).toEqual(without);
  });

  it('a dataFrom that is not a plant date throws a RangeError', () => {
    expect(() => run(withFrom(ENGINE_DATA, '2026-1-1'), AS_OF, DEFAULT_PROFILE)).toThrow(
      RangeError,
    );
  });

  it('a dataFrom after the run date leaves no ticket in any figure', () => {
    const result = run(withFrom(ENGINE_DATA, '2026-11-12'), AS_OF, DEFAULT_PROFILE);
    expect(result.rows.tickets).toBe(0);
  });
});
