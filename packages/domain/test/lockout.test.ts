import { describe, expect, it } from 'vitest';
import { standingLockoutConfirmations } from '../src/lockout.js';
import { transition, TransitionError } from '../src/state.js';
import type { ActorContext, EventType, TicketEvent } from '../src/types.js';
import type { Ticket } from '../src/ticket.js';

const at = (min: number) => new Date(Date.UTC(2026, 0, 1, 10, min));
const ev = (type: EventType, min: number, who: string | null = null): TicketEvent => ({
  type,
  at: at(min),
  actingPersonId: who,
});
const standing = (events: TicketEvent[]) => [...standingLockoutConfirmations(events).keys()].sort();

describe('who stands confirmed on a flagged ticket', () => {
  it('is nobody before anyone confirms, and each person who confirms stands on their own', () => {
    expect(standing([ev('down', 0)])).toEqual([]);
    expect(
      standing([
        ev('lockout_confirmed', 1, 'ann'),
        ev('start', 2, 'ann'),
        ev('lockout_confirmed', 3, 'bob'),
      ]),
    ).toEqual(['ann', 'bob']);
  });

  it.each([
    'pause',
    'transfer',
    'close',
    'cancel',
    'restore',
    'handback_confirm',
    'handback_dispute',
  ] as const)('a %s takes every lock off', (type) => {
    expect(
      standing([
        ev('lockout_confirmed', 1, 'ann'),
        ev('lockout_confirmed', 2, 'bob'),
        ev(type, 3, 'ann'),
      ]),
    ).toEqual([]);
    expect(standing([ev(type, 3, 'ann'), ev('lockout_confirmed', 4, 'bob')])).toEqual(['bob']);
  });

  it('a person who leaves takes their own lock off and nobody else’s', () => {
    expect(
      standing([
        ev('lockout_confirmed', 1, 'ann'),
        ev('lockout_confirmed', 2, 'bob'),
        ev('leave', 3, 'bob'),
      ]),
    ).toEqual(['ann']);
  });

  it('Start, pickup, join and resume do not take a lock off', () => {
    expect(
      standing([
        ev('lockout_confirmed', 1, 'ann'),
        ev('start', 2, 'ann'),
        ev('join', 3, 'bob'),
        ev('resume', 4, 'ann'),
        ev('pickup', 5, 'ann'),
      ]),
    ).toEqual(['ann']);
  });

  it('a confirmation with no person on it stands for nobody', () => {
    expect(standing([ev('lockout_confirmed', 1, null)])).toEqual([]);
  });
});

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

  it('is taken on an open, a waiting and a working ticket, and refused on a closed or cancelled one', () => {
    for (const status of ['open', 'waiting', 'working'] as const) {
      expect(confirm({ status }).events.at(-1)?.type, status).toBe('lockout_confirmed');
    }
    for (const status of ['closed', 'cancelled'] as const) {
      expect(() => confirm({ status }), status).toThrow(TransitionError);
    }
  });

  it('is refused for a role that may not work tickets, and for a person who already stands confirmed', () => {
    expect(() => confirm({}, [], 'operator')).toThrow('Not allowed');
    expect(() => confirm({}, [ev('lockout_confirmed', 5, 'p1')])).toThrow('already confirmed');
  });

  it('is taken by a second person while the first still stands, and again after a pause', () => {
    expect(
      confirm({ status: 'working' }, [ev('lockout_confirmed', 5, 'someone')]).events,
    ).toHaveLength(2);
    expect(
      confirm({ status: 'waiting' }, [ev('lockout_confirmed', 5, 'p1'), ev('pause', 6, 'p1')])
        .events,
    ).toHaveLength(3);
  });
});
