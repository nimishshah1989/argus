import { describe, expect, it } from 'vitest';
import { dayScore, type DayTicket } from '../src/day-score.js';
import type { FigureInput, TicketEvent } from '../src/types.js';

const t = (iso: string) => new Date(iso);
const event = (type: TicketEvent['type'], at: string, isVendor = false): TicketEvent => ({
  type,
  at: t(at),
  isVendor,
});

const NOW = t('2026-11-14T06:30:00Z');

function open(reportedAt: string, events: TicketEvent[]): DayTicket {
  const input: FigureInput = {
    reportedAt: t(reportedAt),
    kind: 'stopped',
    selfStarted: false,
    events,
    segments: [],
    now: NOW,
  };
  return { status: events.some((e) => e.type === 'pause') ? 'waiting' : 'working', input };
}

const closed = (
  responseMin: number | null,
  repairMin: number | null,
  waitMin: number | null,
): DayTicket => ({ status: 'closed', figures: { responseMin, repairMin, waitMin } });

describe('dayScore', () => {
  it('is null, not 0, on a day with no tickets', () => {
    expect(dayScore([], NOW)).toEqual({
      tickets: 0,
      notStarted: 0,
      stillOpen: 0,
      responseMin: null,
      repairMin: null,
      waitingMin: null,
    });
  });

  it('averages the stored response, repair and waiting of closed tickets, rounded to whole minutes', () => {
    const score = dayScore([closed(5, 15, 0), closed(10, 120, 35)], NOW);
    expect(score).toMatchObject({ tickets: 2, responseMin: 8, repairMin: 68, waitingMin: 18 });
  });

  it('leaves cancelled tickets out of every count and average', () => {
    const score = dayScore([{ status: 'cancelled' }, closed(10, 30, 0)], NOW);
    expect(score).toMatchObject({ tickets: 1, responseMin: 10, repairMin: 30 });
  });

  it('counts a closed record with no figures (a past breakdown without a work start) but averages nothing from it', () => {
    const score = dayScore([closed(null, null, null), closed(10, 30, 0)], NOW);
    expect(score).toMatchObject({
      tickets: 2,
      notStarted: 0,
      stillOpen: 0,
      responseMin: 10,
      repairMin: 30,
      waitingMin: 0,
    });
  });

  it('counts an unstarted ticket but gives it no response or repair', () => {
    const unstarted = open('2026-11-14T05:30:00Z', []);
    expect(dayScore([unstarted], NOW)).toEqual({
      tickets: 1,
      notStarted: 1,
      stillOpen: 1,
      responseMin: null,
      repairMin: null,
      waitingMin: null,
    });
    expect(dayScore([unstarted, closed(10, 30, 0)], NOW)).toMatchObject({
      tickets: 2,
      notStarted: 1,
      responseMin: 10,
      repairMin: 30,
    });
  });

  it('measures a ticket still being repaired to the injected now, its waits inside repair', () => {
    const paused = open('2026-11-14T02:30:00Z', [
      event('start', '2026-11-14T02:50:00Z'),
      event('pause', '2026-11-14T03:30:00Z', true),
    ]);
    expect(dayScore([paused], NOW)).toMatchObject({
      stillOpen: 1,
      responseMin: 20,
      repairMin: 220,
      waitingMin: 180,
    });
    expect(dayScore([paused], t('2026-11-14T07:00:00Z'))).toMatchObject({
      repairMin: 250,
      waitingMin: 210,
    });
  });

  it('keeps the first start as the response after a transfer and a pickup', () => {
    const restarted = open('2026-11-14T03:30:00Z', [
      event('start', '2026-11-14T03:40:00Z'),
      event('transfer', '2026-11-14T04:00:00Z'),
      event('pickup', '2026-11-14T04:30:00Z'),
    ]);
    expect(dayScore([restarted], NOW)).toMatchObject({ responseMin: 10, repairMin: 170 });
  });

  it('gives a self-started ticket repair but no response', () => {
    const input: FigureInput = {
      reportedAt: t('2026-11-14T05:00:00Z'),
      kind: 'stopped',
      selfStarted: true,
      events: [event('start', '2026-11-14T05:00:00Z')],
      segments: [],
      now: NOW,
    };
    expect(dayScore([{ status: 'working', input }], NOW)).toMatchObject({
      responseMin: null,
      repairMin: 90,
    });
  });
});
