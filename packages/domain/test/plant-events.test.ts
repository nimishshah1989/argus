import { DEFAULT_PROFILE } from '@uptimo/shared';
import { describe, expect, it } from 'vitest';
import { run, type EngineData, type EngineResult, type TicketRow } from '../src/index.js';
import { isProduction } from '../src/analytics/machine-facts.js';
import { ENGINE_DATA } from './answer-key/fixture.js';

/**
 * Ticket 91: a power or air failure is a closed general ticket with a line per machine. Its machine-hours are counted
 * in `dashboard.plant-events` and in the fleet's availability, and in no breakdown count, MTTR or MTBF.
 */
const AS_OF = '2026-11-11';
const production = ENGINE_DATA.machines.filter(isProduction);
const left = ENGINE_DATA.machines.find((m) => m.segment !== 'CNC')!;

const eventTicket = (id: string, day: string): TicketRow => ({
  id,
  ref: `WR-${id}`,
  kind: 'general',
  status: 'closed',
  machineId: null,
  reportedAt: `${day}T04:00:00.000Z`,
  closedAt: `${day}T10:00:00.000Z`,
  source: 'history',
  downtimeMin: null,
  repairMin: null,
  workType: 'Utility failure',
  raisedChannel: 'backfill',
});

function withEvents(): EngineData {
  return {
    ...ENGINE_DATA,
    tickets: [
      ...ENGINE_DATA.tickets,
      eventTicket('pe-1', '2026-06-10'),
      eventTicket('pe-0', '2025-06-10'),
    ],
    plantEvents: [
      {
        ticketId: 'pe-1',
        lines: [
          { machineId: production[0]!.id, minutes: 30_000 },
          { machineId: production[1]!.id, minutes: 6_000 },
          { machineId: left.id, minutes: 60 },
        ],
      },
      { ticketId: 'pe-0', lines: [{ machineId: production[0]!.id, minutes: 600 }] },
    ],
  };
}

const figure = (result: EngineResult, key: string) => result.figures.find((f) => f.key === key)!;
const span = { from: '2026-01-01', to: AS_OF };

describe('plant events (ticket 91)', () => {
  const before = run(ENGINE_DATA, AS_OF, DEFAULT_PROFILE, span);
  const after = run(withEvents(), AS_OF, DEFAULT_PROFILE, span);

  it('counts the production fleet machine-hours of the events in the span, and drills to the event', () => {
    expect(figure(before, 'dashboard.plant-events')).toMatchObject({
      value: 0,
      drill: { ids: [] },
    });
    expect(figure(after, 'dashboard.plant-events')).toMatchObject({
      status: 'ready',
      value: 600,
      drill: { type: 'ticket', ids: ['pe-1'] },
    });
  });

  it('takes those hours from the fleet availability and from nothing else', () => {
    const was = Number(figure(before, 'dashboard.fleet-availability').value);
    const now = Number(figure(after, 'dashboard.fleet-availability').value);
    expect(now).toBeLessThan(was);
    const same = before.figures
      .filter((f) => !['dashboard.plant-events', 'dashboard.fleet-availability'].includes(f.key))
      .filter((f) => JSON.stringify(f) !== JSON.stringify(figure(after, f.key)));
    expect(same.map((f) => f.key)).toEqual([]);
  });

  it('does not count an event whose ticket was closed after the run date, or is not closed', () => {
    const late = { ...eventTicket('pe-late', '2026-11-10'), closedAt: '2026-11-15T10:00:00.000Z' };
    const open = { ...eventTicket('pe-open', '2026-11-09'), status: 'open' as const };
    const data = withEvents();
    const result = run(
      {
        ...data,
        tickets: [...data.tickets, late, open],
        plantEvents: [
          ...data.plantEvents!,
          { ticketId: 'pe-late', lines: [{ machineId: production[0]!.id, minutes: 6_000 }] },
          { ticketId: 'pe-open', lines: [{ machineId: production[0]!.id, minutes: 6_000 }] },
        ],
      },
      AS_OF,
      DEFAULT_PROFILE,
      span,
    );
    expect(figure(result, 'dashboard.plant-events')).toMatchObject({
      value: 600,
      drill: { ids: ['pe-1'] },
    });
  });

  it('adds nothing to the breakdown count, MTTR or MTBF', () => {
    for (const key of [
      'dashboard.total-breakdowns',
      'a3-mttr-mtbf',
      'dashboard.total-downtime-hours',
    ]) {
      expect(figure(after, key)).toEqual(figure(before, key));
    }
  });
});
