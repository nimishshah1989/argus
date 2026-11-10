import { describe, expect, it } from 'vitest';
import { raiseTicket, transition, TransitionError } from '../src/state.js';
import type { ActorContext, TicketEvent, WorkSegment } from '../src/types.js';
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
  extra: { segments?: WorkSegment[]; events?: TicketEvent[] } = {},
) {
  return transition({
    ticket,
    events: extra.events ?? [],
    segments: extra.segments ?? [],
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
    expect(self.ticket.startedAt).toEqual(now);
    expect(self.events.map((e) => e.type)).toEqual(['down', 'start']);
    expect(self.segments).toHaveLength(1);
  });

  it('starts an open ticket and opens a lead segment', () => {
    const result = run(base(), { type: 'start', personId: 'person-1' });
    expect(result.ticket.status).toBe('working');
    expect(result.ticket.leadPersonId).toBe('person-1');
    expect(result.events.at(-1)?.type).toBe('start');
    expect(result.segments).toHaveLength(1);
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
