import { describe, expect, it } from 'vitest';
import { transition, TransitionError } from '../src/state.js';
import type { ActorContext, CrewMember, TicketEvent, WorkSegment } from '../src/types.js';
import type { Ticket } from '../src/ticket.js';

/** The rules of his `worker.js` for working a ticket: each case is a step of a real ticket of his export. */
const t = (iso: string) => new Date(iso);
const now = t('2026-01-01T12:00:00Z');
const ctx = (personId: string): ActorContext & { now: Date } => ({
  role: 'technician',
  loginId: 'login-1',
  personId,
  shared: false,
  now,
});

function ticket(over: Partial<Ticket> = {}): Ticket {
  return {
    id: 't',
    ref: 'BD-0001',
    kind: 'stopped',
    status: 'working',
    machineId: 'm',
    problem: 'p',
    reportedAt: t('2026-01-01T10:00:00Z'),
    raisedLoginId: 'login-1',
    reportedByPersonId: null,
    selfStarted: false,
    startedAt: t('2026-01-01T10:05:00Z'),
    leadPersonId: 'lead',
    segmentStartedAt: t('2026-01-01T10:05:00Z'),
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
    closedAt: null,
    closedByPersonId: null,
    closeKind: null,
    closeNote: null,
    taskReason: null,
    taskExpectedOn: null,
    taskDownMin: null,
    kindUpgradedAt: null,
    lastEventSeq: 1,
    severity: 'S3',
    criticalitySnapshot: null,
    figures: null,
    ...over,
  };
}

interface World {
  ticket?: Partial<Ticket>;
  events?: TicketEvent[];
  segments?: WorkSegment[];
  crew?: CrewMember[];
}

const down: TicketEvent = { type: 'down', at: t('2026-01-01T10:00:00Z') };

function run(
  command: Parameters<typeof transition>[0]['command'],
  actor: string,
  world: World = {},
) {
  return transition({
    ticket: ticket(world.ticket),
    events: world.events ?? [down],
    segments: world.segments ?? [],
    crew: world.crew ?? [],
    command,
    ctx: ctx(actor),
  });
}

const lead = (startedAt = '2026-01-01T10:05:00Z', endedAt?: string): WorkSegment => ({
  personId: 'lead',
  role: 'lead',
  startedAt: t(startedAt),
  ...(endedAt ? { endedAt: t(endedAt) } : {}),
});
const mate = (role: 'primary' | 'support', startedAt = '2026-01-01T10:30:00Z'): WorkSegment => ({
  personId: 'mate',
  role,
  startedAt: t(startedAt),
});

describe('resume', () => {
  const waiting = {
    status: 'waiting' as const,
    waitReason: 'x',
    waitSince: t('2026-01-01T11:00:00Z'),
  };
  const crew: CrewMember[] = [{ personId: 'mate', role: 'support' }];

  it('keeps the lead when the lead resumes, and restarts the crew clocks', () => {
    const r = run({ type: 'resume', personId: 'lead' }, 'lead', {
      ticket: waiting,
      crew,
      segments: [lead('2026-01-01T10:05:00Z', '2026-01-01T11:00:00Z')],
    });
    expect(r.ticket.leadPersonId).toBe('lead');
    const open = r.segments.filter((s) => !s.endedAt).map((s) => `${s.personId}:${s.role}`);
    expect(open.sort()).toEqual(['lead:lead', 'mate:support']);
  });

  it('keeps the lead when someone on the crew resumes', () => {
    const r = run({ type: 'resume', personId: 'mate' }, 'mate', { ticket: waiting, crew });
    expect(r.ticket.leadPersonId).toBe('lead');
  });

  it('makes an outsider who resumes the lead', () => {
    const r = run({ type: 'resume', personId: 'other' }, 'other', { ticket: waiting, crew });
    expect(r.ticket.leadPersonId).toBe('other');
    expect(
      r.segments
        .filter((s) => !s.endedAt)
        .map((s) => s.personId)
        .sort(),
    ).toEqual(['mate', 'other']);
  });
});

describe('transfer', () => {
  it('stops the crew and marks them gone with the reason "job transferred"', () => {
    const r = run({ type: 'transfer', personId: 'lead', note: 'next shift' }, 'lead', {
      crew: [{ personId: 'mate', role: 'primary' }],
      segments: [lead(), mate('primary')],
    });
    expect(r.crew[0]).toMatchObject({ leftAt: now, leftReason: 'job transferred' });
    expect(r.segments.every((s) => s.endedAt)).toBe(true);
  });
});

describe('leave', () => {
  const crew: CrewMember[] = [{ personId: 'mate', role: 'primary' }];

  it('lets the lead go when a primary takes over, with a fresh lead clock for that primary', () => {
    const r = run({ type: 'leave', personId: 'lead', reason: 'shift over' }, 'lead', {
      crew,
      segments: [lead(), mate('primary')],
    });
    expect(r.ticket.leadPersonId).toBe('mate');
    expect(r.segments.filter((s) => s.personId === 'lead').every((s) => s.endedAt)).toBe(true);
    const own = r.segments.find((s) => s.personId === 'mate' && s.role === 'primary');
    expect(own?.endedAt).toEqual(now);
    expect(
      r.segments.find((s) => s.personId === 'mate' && s.role === 'lead' && !s.endedAt),
    ).toMatchObject({
      startedAt: now,
    });
  });

  it('refuses the lead leaving when only support is left to take over', () => {
    const supportOnly: CrewMember[] = [{ personId: 'mate', role: 'support' }];
    expect(() =>
      run({ type: 'leave', personId: 'lead', reason: 'x' }, 'lead', {
        crew: supportOnly,
        segments: [lead(), mate('support')],
      }),
    ).toThrow(TransitionError);
  });
});

describe('join', () => {
  it('refuses the person running the job joining their own job', () => {
    expect(() => run({ type: 'join', personId: 'lead', role: 'support' }, 'lead')).toThrow(
      TransitionError,
    );
  });
});

describe('start and pick up', () => {
  const handedOver = {
    status: 'open' as const,
    handedOver: true,
    handoverSince: t('2026-01-01T11:00:00Z'),
    leadPersonId: null,
  };
  const events: TicketEvent[] = [
    down,
    { type: 'transfer', at: t('2026-01-01T11:00:00Z') },
    { type: 'update', at: t('2026-01-01T11:20:00Z') },
  ];

  it('lets a pick-up be back-dated to the transfer, past an update written in between', () => {
    const r = run(
      { type: 'start', personId: 'next', pickup: true, at: t('2026-01-01T11:05:00Z') },
      'next',
      {
        ticket: handedOver,
        events,
      },
    );
    expect(r.segments[0]?.startedAt).toEqual(t('2026-01-01T11:05:00Z'));
  });

  it('stops a back-dated start at the transfer time', () => {
    const r = run(
      { type: 'start', personId: 'next', pickup: true, at: t('2026-01-01T09:00:00Z') },
      'next',
      {
        ticket: handedOver,
        events,
      },
    );
    expect(r.segments[0]?.startedAt).toEqual(t('2026-01-01T11:00:00Z'));
  });
});

describe('running and stopped', () => {
  it('refuses "running" before work has started, and twice', () => {
    expect(() =>
      run({ type: 'machineRunning', personId: 'lead' }, 'lead', { ticket: { status: 'open' } }),
    ).toThrow(TransitionError);
    expect(() =>
      run({ type: 'machineRunning', personId: 'lead' }, 'lead', {
        ticket: { machineRunningAt: t('2026-01-01T11:00:00Z') },
      }),
    ).toThrow(TransitionError);
  });

  it('back-dates "stopped" but not before the machine was running', () => {
    const running = t('2026-01-01T11:00:00Z');
    const events: TicketEvent[] = [down, { type: 'running', at: running }];
    const ok = run(
      { type: 'machineStopped', personId: 'lead', at: t('2026-01-01T11:30:00Z') },
      'lead',
      {
        ticket: { machineRunningAt: running },
        events,
      },
    );
    expect(ok.ticket.machineStoppedAt).toEqual(t('2026-01-01T11:30:00Z'));
    const early = run(
      { type: 'machineStopped', personId: 'lead', at: t('2026-01-01T10:30:00Z') },
      'lead',
      {
        ticket: { machineRunningAt: running },
        events,
      },
    );
    expect(early.ticket.machineStoppedAt).toEqual(running);
  });
});
