import { describe, expect, it } from 'vitest';
import type { Ticket } from '../api.js';
import { downNow } from './liveDowntime.js';

const now = '2026-11-13T09:00:00Z';
function ticket(over: Partial<Ticket>): Ticket {
  return {
    reportedAt: '2026-11-13T08:00:00Z',
    machineRunningAt: null,
    machineStoppedAt: null,
    figures: null,
    ...over,
  } as unknown as Ticket;
}

describe('an open stopped ticket shows its downtime so far', () => {
  it('counts from the report while nothing has finished', () => {
    expect(downNow(ticket({}), now)).toBe(60);
  });

  it('adds the finished stretches to the one that began when it stopped again', () => {
    const t = ticket({
      machineStoppedAt: '2026-11-13T08:30:00Z',
      figures: { downAccMin: 10 } as Ticket['figures'],
    });
    expect(downNow(t, now)).toBe(40);
  });

  it('stops counting while the machine runs again', () => {
    const t = ticket({
      machineRunningAt: '2026-11-13T08:30:00Z',
      figures: { downAccMin: 30 } as Ticket['figures'],
    });
    expect(downNow(t, now)).toBe(30);
  });
});
