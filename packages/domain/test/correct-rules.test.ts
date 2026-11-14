import { describe, expect, it } from 'vitest';
import { transition, TransitionError } from '../src/state.js';
import type { ActorContext, TicketEvent, WorkSegment } from '../src/types.js';
import type { Ticket } from '../src/ticket.js';

/** The admin's correction (DOMAIN §2): the window, and times that must agree with the ticket's own history. */
const t = (iso: string) => new Date(iso);
const admin = (now: string): ActorContext & { now: Date } => ({
  role: 'admin',
  loginId: 'login-admin',
  personId: 'admin',
  shared: false,
  now: t(now),
});

function ticket(over: Partial<Ticket> = {}): Ticket {
  return {
    id: 't',
    ref: 'BD-0001',
    kind: 'stopped',
    status: 'closed',
    machineId: 'm',
    problem: 'p',
    reportedAt: t('2026-01-01T08:00:00Z'),
    raisedLoginId: 'login-1',
    reportedByPersonId: null,
    selfStarted: false,
    startedAt: t('2026-01-01T10:00:00Z'),
    leadPersonId: 'lead',
    segmentStartedAt: null,
    handedOver: false,
    handoverSince: null,
    transferToPersonId: null,
    transferToShift: null,
    transfers: 0,
    waitReason: null,
    waitSince: null,
    assignedToPersonId: null,
    machineRunningAt: null,
    machineStoppedAt: null,
    closedAt: t('2026-01-01T12:00:00Z'),
    closedByPersonId: 'lead',
    closeKind: 'no_report',
    closeNote: null,
    taskReason: null,
    taskExpectedOn: null,
    taskDownMin: null,
    kindUpgradedAt: null,
    lastEventSeq: 3,
    severity: 'S3',
    criticalitySnapshot: null,
    figures: null,
    ...over,
  };
}

const events: TicketEvent[] = [
  { type: 'down', at: t('2026-01-01T08:00:00Z') },
  { type: 'start', at: t('2026-01-01T10:00:00Z') },
  { type: 'close', at: t('2026-01-01T12:00:00Z') },
];
const segments: WorkSegment[] = [
  {
    personId: 'lead',
    role: 'lead',
    startedAt: t('2026-01-01T10:00:00Z'),
    endedAt: t('2026-01-01T12:00:00Z'),
  },
];

function correct(
  changes: Record<string, unknown>,
  now = '2026-01-02T00:00:00Z',
  over: Partial<Ticket> = {},
  world: { events?: TicketEvent[]; segments?: WorkSegment[] } = {},
) {
  return transition({
    ticket: ticket(over),
    events: world.events ?? events,
    segments: world.segments ?? segments,
    crew: [],
    command: { type: 'correct', personId: 'admin', reason: 'Fix', changes },
    ctx: admin(now),
  });
}

describe('the 7-day window is measured from the close event and does not renew', () => {
  it('refuses a closing time later than the one recorded, so the window cannot be pushed out', () => {
    // closed 12:00 on 1 Jan; on 6 Jan an admin moves the close to now
    expect(() => correct({ closedAt: t('2026-01-06T12:00:00Z') }, '2026-01-06T12:00:00Z')).toThrow(
      /Invalid correction/,
    );
  });

  it('allows a correction on day 6 and refuses one on day 8, whatever ticket.closedAt says', () => {
    expect(correct({ problem: 'Day 6' }, '2026-01-07T11:00:00Z').ticket.problem).toBe('Day 6');
    // ticket.closedAt was moved later by an earlier correction; the close event still says 1 Jan 12:00
    const moved = { closedAt: t('2026-01-07T00:00:00Z') };
    expect(() => correct({ problem: 'Day 8' }, '2026-01-08T13:00:00Z', moved)).toThrow(
      /within 7 days/,
    );
  });
});

describe("corrected times agree with the ticket's own history", () => {
  it.each([
    ['a start after the first start event', { startedAt: t('2026-01-01T10:30:00Z') }],
    ['a report after the first start', { reportedAt: t('2026-01-01T10:30:00Z') }],
    ['a close before the last work segment ends', { closedAt: t('2026-01-01T09:30:00Z') }],
    [
      "the reviewer's case: start 09:00 and close 09:30 over work from 10:00 to 12:00",
      { startedAt: t('2026-01-01T09:00:00Z'), closedAt: t('2026-01-01T09:30:00Z') },
    ],
  ])('refuses %s, with a reason', (_name, changes) => {
    expect(() => correct(changes)).toThrow(/Invalid correction/);
  });

  it('refuses a close before the last work event even when the segments end earlier', () => {
    const late: TicketEvent[] = [
      ...events.slice(0, 2),
      { type: 'update', at: t('2026-01-01T11:30:00Z') },
      events[2] as TicketEvent,
    ];
    const short: WorkSegment[] = [
      { ...(segments[0] as WorkSegment), endedAt: t('2026-01-01T11:00:00Z') },
    ];
    expect(() =>
      correct(
        { closedAt: t('2026-01-01T11:10:00Z') },
        '2026-01-02T00:00:00Z',
        {},
        { events: late, segments: short },
      ),
    ).toThrow(/Invalid correction/);
  });

  it('accepts times that agree', () => {
    const ok = correct({
      startedAt: t('2026-01-01T09:00:00Z'),
      closedAt: t('2026-01-01T12:00:00Z'),
    });
    expect(ok.ticket.startedAt).toEqual(t('2026-01-01T09:00:00Z'));
  });

  it('closedAt only on a closed ticket', () => {
    expect(() =>
      correct({ closedAt: t('2026-01-01T12:00:00Z') }, '2026-01-02T00:00:00Z', {
        status: 'working',
        closedAt: null,
      }),
    ).toThrow(TransitionError);
  });

  it('minutes set by hand only on a closed ticket, and null takes them off again', () => {
    expect(() =>
      correct({ handsOnOverrideMin: 30 }, '2026-01-02T00:00:00Z', {
        status: 'working',
        closedAt: null,
      }),
    ).toThrow(TransitionError);
    const off = correct({ handsOnOverrideMin: null });
    expect(off.events.at(-1)?.changes).toEqual([
      { field: 'handsOnOverrideMin', from: null, to: null },
    ]);
  });
});

describe('restore window', () => {
  it('falls back to the cancelled time when there is no cancel event', () => {
    const cancelled = ticket({
      status: 'cancelled',
      closedAt: null,
      cancelledAt: t('2026-01-01T09:00:00Z'),
    });
    const restore = (now: string) =>
      transition({
        ticket: cancelled,
        events: [events[0] as TicketEvent],
        segments: [],
        crew: [],
        command: { type: 'restore', personId: 'admin', reason: 'Mistake' },
        ctx: admin(now),
      });
    expect(restore('2026-01-05T00:00:00Z').ticket.status).toBe('open');
    expect(() => restore('2026-01-10T00:00:00Z')).toThrow(/within 7 days/);
  });
});
