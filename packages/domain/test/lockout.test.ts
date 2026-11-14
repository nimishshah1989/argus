import { describe, expect, it } from 'vitest';
import { standingLockoutConfirmation } from '../src/lockout.js';
import { transition, TransitionError } from '../src/state.js';
import type { ActorContext, EventType, TicketEvent } from '../src/types.js';
import type { Ticket } from '../src/ticket.js';

const at = (min: number) => new Date(Date.UTC(2026, 0, 1, 10, min));
const ev = (type: EventType, min: number): TicketEvent => ({ type, at: at(min) });
const ctx = (role: ActorContext['role'] = 'technician'): ActorContext & { now: Date } => ({
  role,
  loginId: 'login-1',
  personId: 'p1',
  shared: false,
  now: at(30),
});
const base = {
  id: 't',
  ref: 'BD-1',
  kind: 'general',
  status: 'open',
  machineId: null,
  problem: 'p',
  reportedAt: at(0),
  raisedLoginId: 'login-1',
  lastEventSeq: 0,
} as unknown as Ticket;
const confirm = (
  over: Partial<Ticket> = {},
  events: TicketEvent[] = [],
  role?: ActorContext['role'],
) =>
  transition({
    ticket: { ...base, ...over },
    events,
    segments: [],
    crew: [],
    command: { type: 'confirmLockout', personId: 'p1', steps: ['Isolate', 'Lock and tag'] },
    ctx: ctx(role),
  });

describe('which lockout confirmation still stands', () => {
  it('is none before anyone confirms', () => {
    expect(standingLockoutConfirmation([ev('down', 0)])).toBeNull();
  });

  it('is the last confirmation until work starts', () => {
    const confirmed = ev('lockout_confirmed', 5);
    expect(standingLockoutConfirmation([ev('down', 0), confirmed])).toBe(confirmed);
  });

  it.each(['start', 'pickup', 'cancel', 'restore'] as const)('is used up by a later %s', (type) => {
    expect(standingLockoutConfirmation([ev('lockout_confirmed', 5), ev(type, 6)])).toBeNull();
  });

  it('survives a pause and a resume after it, and counts again if confirmed after a start', () => {
    const again = ev('lockout_confirmed', 20);
    expect(
      standingLockoutConfirmation([ev('lockout_confirmed', 5), ev('start', 6), ev('pause', 7)]),
    ).toBeNull();
    expect(
      standingLockoutConfirmation([
        ev('lockout_confirmed', 5),
        ev('start', 6),
        ev('transfer', 10),
        again,
      ]),
    ).toBe(again);
  });
});

describe('confirming the lockout', () => {
  it('writes one history entry with the steps and changes nothing else on the ticket', () => {
    const result = confirm();
    expect(result.events.at(-1)).toMatchObject({
      type: 'lockout_confirmed',
      reason: 'Isolate; Lock and tag',
      at: at(30),
    });
    expect(result.ticket).toMatchObject({ status: 'open', lastEventSeq: 1 });
    expect(result.segments).toEqual([]);
  });

  it('is refused on a ticket that has started, been closed or been cancelled', () => {
    for (const status of ['working', 'waiting', 'closed', 'cancelled'] as const) {
      expect(() => confirm({ status }), status).toThrow(TransitionError);
    }
  });

  it('is refused for a role that may not work tickets, and a second time', () => {
    expect(() => confirm({}, [], 'operator')).toThrow('Not allowed');
    expect(() => confirm({}, [ev('lockout_confirmed', 5)])).toThrow('already confirmed');
  });
});
