import { describe, expect, it } from 'vitest';
import { raiseTicket, recordPastBreakdown, transition, TransitionError } from '../src/state.js';
import { figures } from '../src/figures.js';
import type { ActorContext, CrewMember, TicketEvent, WorkSegment } from '../src/types.js';
import type { Ticket } from '../src/ticket.js';

const t = (iso: string) => new Date(iso);
const now = t('2026-01-01T12:00:00Z');

function ctx(role: ActorContext['role'], personId = 'person-1'): ActorContext & { now: Date } {
  return { role, loginId: 'login-1', personId, shared: false, now };
}

function base(over: Partial<Ticket> = {}): Ticket {
  return {
    id: 'ticket-1',
    ref: 'BD-0001',
    kind: 'stopped',
    status: 'open',
    machineId: 'machine-1',
    problem: 'Spindle alarm',
    reportedAt: t('2026-01-01T10:00:00Z'),
    raisedLoginId: 'login-1',
    reportedByPersonId: 'person-1',
    selfStarted: false,
    startedAt: null,
    leadPersonId: null,
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
    closedAt: null,
    closedByPersonId: null,
    closeKind: null,
    closeNote: null,
    taskReason: null,
    taskExpectedOn: null,
    taskDownMin: null,
    kindUpgradedAt: null,
    lastEventSeq: 0,
    figures: null,
    ...over,
  };
}

function run(
  ticket: Ticket,
  command: Parameters<typeof transition>[0]['command'],
  actor = ctx('technician'),
  extra: { segments?: WorkSegment[]; events?: TicketEvent[]; crew?: CrewMember[] } = {},
) {
  return transition({
    ticket,
    events: extra.events ?? [],
    segments: extra.segments ?? [],
    crew: extra.crew ?? [],
    command,
    ctx: actor,
  });
}

describe('state machine', () => {
  it('raises an open ticket and optionally starts it', () => {
    const raised = raiseTicket({
      id: 't-1',
      ref: 'BD-0001',
      kind: 'stopped',
      machineId: 'm-1',
      problem: 'X',
      reportedAt: now,
      raisedLoginId: 'login-1',
      reportedByPersonId: 'person-1',
      selfStarted: false,
      startNow: false,
    });
    expect(raised.ticket.status).toBe('open');
    expect(raised.events.map((e) => e.type)).toEqual(['down']);
    const self = raiseTicket({
      id: 't-2',
      ref: 'BD-0002',
      kind: 'stopped',
      machineId: 'm-1',
      problem: 'Y',
      reportedAt: now,
      raisedLoginId: 'login-1',
      reportedByPersonId: 'person-1',
      selfStarted: true,
      startNow: true,
    });
    expect(self.ticket.status).toBe('working');
    expect(self.ticket.startedAt).toEqual(now);
    expect(self.events.map((e) => e.type)).toEqual(['down', 'start']);
    expect(self.segments).toHaveLength(1);
    expect(self.segments[0]?.endedAt).toBeUndefined();
  });

  it('starts an open ticket and opens a lead segment', () => {
    const result = run(base(), { type: 'start', personId: 'person-1' });
    expect(result.ticket.status).toBe('working');
    expect(result.ticket.leadPersonId).toBe('person-1');
    expect(result.events.at(-1)?.type).toBe('start');
    expect(result.segments).toHaveLength(1);
  });

  it('rejects a second start on a self-started or already-led ticket', () => {
    const self = raiseTicket({
      id: 't-3',
      ref: 'BD-0003',
      kind: 'stopped',
      machineId: 'm-1',
      problem: 'Z',
      reportedAt: now,
      raisedLoginId: 'login-1',
      reportedByPersonId: 'person-1',
      selfStarted: true,
      startNow: true,
    });
    expect(() =>
      transition({
        ticket: self.ticket,
        events: self.events,
        segments: self.segments,
        crew: [],
        command: { type: 'start', personId: 'person-1' },
        ctx: ctx('technician'),
      }),
    ).toThrow(TransitionError);

    const openLead = { personId: 'person-1', role: 'lead' as const, startedAt: now };
    expect(() =>
      run(base(), { type: 'start', personId: 'person-1' }, ctx('technician'), {
        segments: [openLead],
      }),
    ).toThrow(TransitionError);
  });

  it('rejects starting a non-open ticket', () => {
    expect(() => run(base({ status: 'working' }), { type: 'start', personId: 'person-1' })).toThrow(
      TransitionError,
    );
  });

  it('pauses a working ticket and closes its segments', () => {
    const started = run(base(), { type: 'start', personId: 'person-1' });
    const paused = run(
      started.ticket,
      { type: 'pause', personId: 'person-1', reason: 'Waiting for spare' },
      ctx('technician'),
      { segments: started.segments },
    );
    expect(paused.ticket.status).toBe('waiting');
    expect(paused.ticket.waitReason).toBe('Waiting for spare');
    expect(paused.segments[0]?.endedAt).toEqual(now);
  });

  it('resumes a waiting ticket with a new lead segment', () => {
    const waiting = base({
      status: 'waiting',
      waitReason: 'Waiting for spare',
      waitSince: t('2026-01-01T11:00:00Z'),
      startedAt: t('2026-01-01T10:00:00Z'),
    });
    const result = run(waiting, { type: 'resume', personId: 'person-2' });
    expect(result.ticket.status).toBe('working');
    expect(result.ticket.leadPersonId).toBe('person-2');
  });

  it('transfers a working ticket back to open with a handover', () => {
    const working = base({
      status: 'working',
      leadPersonId: 'person-1',
      startedAt: t('2026-01-01T10:00:00Z'),
    });
    const result = run(working, { type: 'transfer', personId: 'person-1', note: 'Handing over' });
    expect(result.ticket.status).toBe('open');
    expect(result.ticket.handedOver).toBe(true);
    expect(result.ticket.transfers).toBe(1);
  });

  it('marks a stopped machine running and then stopped', () => {
    const running = run(base({ status: 'working' }), {
      type: 'machineRunning',
      personId: 'person-1',
    });
    expect(running.ticket.machineRunningAt).toEqual(now);
    const stopped = run(running.ticket, { type: 'machineStopped', personId: 'person-1' });
    expect(stopped.ticket.machineStoppedAt).toEqual(now);
  });

  it('closes a working ticket as the lead and cancels an own open ticket', () => {
    const working = base({
      status: 'working',
      leadPersonId: 'person-1',
      startedAt: t('2026-01-01T10:00:00Z'),
    });
    const closed = run(working, { type: 'close', personId: 'person-1', kind: 'report' });
    expect(closed.ticket.status).toBe('closed');
    expect(closed.ticket.closeKind).toBe('report');
    const cancelled = run(
      base(),
      { type: 'cancel', personId: 'person-1', reason: 'Mistake' },
      ctx('operator'),
    );
    expect(cancelled.ticket.status).toBe('cancelled');
  });
});

describe('remaining commands', () => {
  it('joins a working ticket and leaves it', () => {
    const working = base({
      status: 'working',
      leadPersonId: 'person-1',
      startedAt: t('2026-01-01T10:00:00Z'),
    });
    const joined = run(
      working,
      { type: 'join', personId: 'person-2', role: 'support' },
      ctx('technician', 'person-2'),
    );
    expect(joined.crew).toHaveLength(1);
    expect(joined.segments).toHaveLength(1);
    const left = run(
      joined.ticket,
      { type: 'leave', personId: 'person-2', reason: 'Done' },
      ctx('technician', 'person-2'),
      { segments: joined.segments, crew: joined.crew },
    );
    expect(left.crew[0]?.leftAt).toEqual(now);
  });

  it('gates leave to workers', () => {
    const crew: CrewMember[] = [{ personId: 'person-2', role: 'support' }];
    expect(() =>
      run(
        base({ status: 'working', leadPersonId: 'person-1' }),
        { type: 'leave', personId: 'person-2', reason: 'Done' },
        ctx('operator', 'person-2'),
        { crew },
      ),
    ).toThrow(TransitionError);

    const left = run(
      base({ status: 'working', leadPersonId: 'person-1' }),
      { type: 'leave', personId: 'person-2', reason: 'Done' },
      ctx('technician', 'person-2'),
      { crew },
    );
    expect(left.crew[0]?.leftAt).toEqual(now);
  });

  it('upgrades a support ticket to stopped', () => {
    const support = base({ kind: 'support', status: 'working' });
    const result = run(support, { type: 'upgradeKind', personId: 'person-1' });
    expect(result.ticket.kind).toBe('stopped');
    expect(result.ticket.kindUpgradedAt).toEqual(now);
  });

  it('adds a late report and restores a cancelled ticket', () => {
    const closedNoReport = base({ status: 'closed', closeKind: 'no_report' });
    const late = run(closedNoReport, { type: 'lateReport', personId: 'person-1' });
    expect(late.ticket.closeKind).toBe('report');

    const working = base({
      status: 'working',
      leadPersonId: 'person-1',
      startedAt: t('2026-01-01T10:00:00Z'),
    });
    const cancelled = run(
      working,
      { type: 'cancel', personId: 'person-1', reason: 'By mistake' },
      ctx('technician'),
    );
    const restored = run(
      cancelled.ticket,
      { type: 'restore', personId: 'person-1', reason: 'By mistake', toStatus: 'working' },
      ctx('admin'),
      { events: cancelled.events, segments: cancelled.segments },
    );
    expect(restored.ticket.status).toBe('working');
    expect(restored.segments).toHaveLength(1);
  });

  it('restores to the previous status recorded on cancel, ignoring a conflicting toStatus', () => {
    const waiting = base({
      status: 'waiting',
      waitReason: 'Waiting for spare',
      waitSince: t('2026-01-01T11:00:00Z'),
    });
    const cancelled = run(
      waiting,
      { type: 'cancel', personId: 'person-1', reason: 'Mistake' },
      ctx('technician'),
    );
    expect(cancelled.events.at(-1)?.status).toBe('waiting');

    const restored = run(
      cancelled.ticket,
      { type: 'restore', personId: 'person-1', reason: 'Undo', toStatus: 'working' },
      ctx('admin'),
      { events: cancelled.events, segments: cancelled.segments },
    );
    expect(restored.ticket.status).toBe('waiting');
    expect(restored.ticket.waitSince).toEqual(now);
  });

  it('rejects a restore more than 7 days after the cancel', () => {
    const working = base({
      status: 'working',
      leadPersonId: 'person-1',
      startedAt: t('2026-01-01T10:00:00Z'),
    });
    const cancelled = run(
      working,
      { type: 'cancel', personId: 'person-1', reason: 'Mistake' },
      ctx('technician'),
    );
    const later = { ...ctx('admin'), now: t('2026-01-09T12:00:00Z') };
    expect(() =>
      run(cancelled.ticket, { type: 'restore', personId: 'person-1', reason: 'Undo' }, later, {
        events: cancelled.events,
        segments: cancelled.segments,
      }),
    ).toThrow(TransitionError);
  });

  it('lets an admin correct a ticket and records from/to', () => {
    const result = run(
      base(),
      { type: 'correct', personId: 'person-1', reason: 'Fix', changes: { problem: 'New problem' } },
      ctx('admin'),
    );
    expect(result.ticket.problem).toBe('New problem');
    expect(result.events.at(-1)).toMatchObject({
      type: 'edit',
      changes: [{ field: 'problem', from: 'Spindle alarm', to: 'New problem' }],
    });
  });

  it('rejects a non-admin correction', () => {
    expect(() =>
      run(
        base(),
        { type: 'correct', personId: 'person-1', reason: 'Fix', changes: { problem: 'X' } },
        ctx('technician'),
      ),
    ).toThrow(TransitionError);
  });

  it('rejects a correction more than 7 days after close', () => {
    const closed = base({
      status: 'closed',
      closeKind: 'report',
      closedAt: t('2025-12-24T12:00:00Z'),
    });
    expect(() =>
      run(
        closed,
        { type: 'correct', personId: 'person-1', reason: 'Fix', changes: { problem: 'X' } },
        ctx('admin'),
      ),
    ).toThrow(TransitionError);
  });

  it('rejects a correction that puts closedAt before startedAt', () => {
    const working = base({
      status: 'working',
      reportedAt: t('2026-01-01T09:00:00Z'),
      startedAt: t('2026-01-01T10:00:00Z'),
      leadPersonId: 'person-1',
    });
    expect(() =>
      run(
        working,
        {
          type: 'correct',
          personId: 'person-1',
          reason: 'Fix',
          changes: { closedAt: t('2026-01-01T09:30:00Z') },
        },
        ctx('admin'),
      ),
    ).toThrow(TransitionError);
  });

  it('records a past breakdown without inventing hands-on time', () => {
    const past = recordPastBreakdown({
      id: 't-past',
      ref: 'BD-9000',
      kind: 'stopped',
      machineId: 'm-1',
      problem: 'Old breakdown',
      reportedAt: t('2026-01-01T09:00:00Z'),
      closedAt: t('2026-01-01T10:00:00Z'),
      raisedLoginId: 'login-1',
      reportedByPersonId: 'person-1',
      closedByPersonId: 'person-1',
    });
    expect(past.segments).toHaveLength(0);
    expect(past.ticket.startedAt).toBeNull();
    expect(past.ticket.leadPersonId).toBeNull();
    const f = figures({
      reportedAt: past.ticket.reportedAt,
      kind: 'stopped',
      selfStarted: false,
      events: past.events,
      segments: past.segments,
      now: t('2026-01-01T10:00:00Z'),
      closedAt: past.ticket.closedAt ?? undefined,
    });
    expect(f.activeMin).toBe(0);
  });
});
