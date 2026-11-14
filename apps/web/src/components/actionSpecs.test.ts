import { describe, expect, it } from 'vitest';
import type { ActorContext } from '@uptimo/domain';
import type { Me, Ticket, TicketPerson } from '../api.js';
import {
  actionSpecs,
  type ActionSpec,
  actorFrom,
  crewFrom,
  offers,
  quickSpec,
} from './actionSpecs.js';

function ticket(overrides: Partial<Ticket> = {}): Ticket {
  return {
    id: 'ticket-1',
    ref: 'BD-0149',
    kind: 'stopped',
    status: 'open',
    machineId: 'machine-1',
    machineSnapshot: { code: 'VC-17', category: 'VMC', cell: 'Cell A' },
    problem: 'Spindle alarm',
    reportedAt: '2026-11-11T09:00:00.000Z',
    reportedByPersonId: 'person-1',
    raisedLoginId: 'login-1',
    location: null,
    workType: null,
    urgent: false,
    handedOver: false,
    startedAt: null,
    leadPersonId: null,
    waitReason: null,
    machineRunningAt: null,
    closedAt: null,
    closeKind: null,
    closeNote: null,
    severity: null,
    criticalitySnapshot: null,
    slaPolicyId: null,
    selfStarted: false,
    segmentStartedAt: null,
    handoverSince: null,
    transferToPersonId: null,
    transferToShift: null,
    transfers: 0,
    waitSince: null,
    assignedToPersonId: null,
    machineStoppedAt: null,
    closedByPersonId: null,
    taskReason: null,
    taskExpectedOn: null,
    taskDownMin: null,
    kindUpgradedAt: null,
    lastEventSeq: 0,
    problemLang: null,
    reportedByRole: null,
    raisedChannel: 'floor',
    parentId: null,
    expectedBackAt: null,
    waitingSpare: null,
    sla: null,
    figures: null,
    ...overrides,
  };
}

const STARTED = '2026-11-11T09:05:00.000Z';
const working = (overrides: Partial<Ticket> = {}) =>
  ticket({ status: 'working', startedAt: STARTED, leadPersonId: 'person-9', ...overrides });

function actor(overrides: Partial<ActorContext> = {}): ActorContext {
  return {
    role: 'technician',
    loginId: 'login-2',
    personId: 'person-2',
    shared: false,
    ...overrides,
  };
}

const support = (personId: string, leftAt: string | null = null) => ({
  personId,
  role: 'support' as const,
  leftAt,
});

function actions(t: Ticket, who: ActorContext, crew = [] as ReturnType<typeof crewFrom>) {
  return actionSpecs(t, crew, who).map((spec) => spec.action);
}

describe('actionSpecs', () => {
  it('labels and orders the working bar, close split in two', () => {
    const running = working({ machineRunningAt: STARTED });
    const specs = actionSpecs(running, [support('person-2')], actor({ role: 'supervisor' }));
    expect(specs.map((spec) => spec.label)).toEqual([
      'detail.action.closeReport',
      'action.label.pause',
      'action.label.transfer',
      'action.label.machineStopped',
      'action.label.update',
      'action.label.leave',
      'detail.action.closeNoReport',
      'detail.action.cancel',
    ]);
    expect(specs.map((spec) => spec.primary)).toEqual([true, ...Array(7).fill(false)]);
    expect(specs.filter((spec) => spec.preset).map((spec) => spec.preset)).toEqual([
      'report',
      'no_report',
    ]);
  });

  it('makes Join the primary button for a technician who cannot close', () => {
    const [first] = actionSpecs(working(), [], actor());
    expect(first?.action).toBe('join');
  });

  it('never makes Cancel the primary button', () => {
    const operator = actor({ role: 'operator', loginId: 'login-1' });
    expect(actionSpecs(ticket(), [], operator)).toEqual([
      { action: 'cancel', label: 'detail.action.cancel', primary: false },
    ]);
  });

  it('offers one Mark done for a work request', () => {
    const specs = actionSpecs(working({ kind: 'general' }), [], actor({ role: 'supervisor' }));
    expect(specs.filter((spec) => spec.action === 'close')).toEqual([
      { action: 'close', label: 'closes.action.markDone', preset: 'done', primary: true },
    ]);
  });

  it('says Pick up on a handed-over open ticket', () => {
    const [first] = actionSpecs(ticket({ handedOver: true }), [], actor());
    expect(first).toEqual({ action: 'start', label: 'action.label.pickUp', primary: true });
  });

  it('rejects an English literal as a label', () => {
    // @ts-expect-error an English literal is not a MessageKey
    const english: ActionSpec = { action: 'start', label: 'Start', primary: true };
    expect(english.label).toBe('Start');
  });
});

describe('quickSpec', () => {
  it('picks the quick action', () => {
    const label = (t: Ticket, who = actor()) => quickSpec(t, who)?.label ?? null;
    expect(label(ticket())).toBe('action.label.start');
    expect(label(ticket({ handedOver: true }))).toBe('action.label.pickUp');
    expect(label(ticket({ status: 'waiting', startedAt: STARTED }))).toBe('action.label.resume');
    expect(label(working())).toBe('action.label.machineRunning');
    expect(label(working({ machineRunningAt: STARTED }))).toBeNull();
    expect(label(ticket(), actor({ role: 'operator' }))).toBeNull();
  });
});

describe('actorFrom and crewFrom', () => {
  const me: Me = {
    id: 'login-2',
    username: 'asha',
    name: 'Asha',
    title: null,
    role: 'technician',
    shared: true,
    actingPersonId: 'person-2',
  };

  it('maps me to an actor', () => {
    expect(actorFrom(me)).toEqual({
      role: 'technician',
      loginId: 'login-2',
      personId: 'person-2',
      shared: true,
    });
    expect(actorFrom({ ...me, role: 'visitor' })).toBeNull();
  });

  it('keeps left crew rows for close', () => {
    const people: TicketPerson[] = [
      { personId: 'a', role: 'primary', leftAt: null, leftReason: null },
      { personId: 'b', role: 'support', leftAt: '2026-11-11T10:00:00.000Z', leftReason: 'done' },
      { personId: 'c', role: 'lead', leftAt: null, leftReason: null },
    ];
    expect(crewFrom(people)).toEqual([
      { personId: 'a', role: 'primary', leftAt: null },
      { personId: 'b', role: 'support', leftAt: '2026-11-11T10:00:00.000Z' },
    ]);
  });
});

describe('join and leave', () => {
  it('offers join to a technician who is not on the crew', () => {
    const list = actions(working(), actor());
    expect(list).toContain('join');
    expect(list).not.toContain('leave');
  });

  it('hides join on an open ticket, and still offers start (Q1)', () => {
    const list = actions(ticket(), actor());
    expect(list).not.toContain('join');
    expect(list).toContain('start');
  });

  it('offers leave to an active crew member instead of join', () => {
    for (const t of [ticket(), working()]) {
      const list = actions(t, actor(), [support('person-2')]);
      expect(list).toContain('leave');
      expect(list).not.toContain('join');
    }
  });

  it('treats the lead as on the ticket: no join (Q3), no leave without a crew row (Q2)', () => {
    const list = actions(working({ leadPersonId: 'person-2' }), actor());
    expect(list).not.toContain('leave');
    expect(list).not.toContain('join');
  });

  it('offers join and leave on working and waiting tickets too', () => {
    expect(actions(working(), actor())).toContain('join');
    expect(actions(working(), actor(), [support('person-2')])).toContain('leave');
    const waiting = ticket({ status: 'waiting', startedAt: STARTED });
    expect(actions(waiting, actor(), [support('person-2')])).toContain('leave');
  });

  it('offers join again to someone who left', () => {
    expect(actions(working(), actor(), [support('person-2', STARTED)])).toContain('join');
  });

  it('omits join and leave without an acting person or outside the live statuses', () => {
    expect(actions(ticket(), actor({ personId: null }))).toEqual([]);
    expect(actions(ticket({ status: 'closed' }), actor())).toEqual([]);
    expect(actions(ticket({ status: 'cancelled' }), actor())).toEqual([]);
  });
});

describe('cancel', () => {
  it('offers cancel from working (technician and above can cancel)', () => {
    expect(actions(working(), actor(), [support('person-2')])).toContain('cancel');
  });

  it('keeps cancel on open and waiting', () => {
    expect(actions(ticket(), actor())).toContain('cancel');
    expect(actions(ticket({ status: 'waiting' }), actor())).toContain('cancel');
  });

  it("offers the reporter's own cancel only while unstarted on the same login", () => {
    const operator = actor({ role: 'operator', loginId: 'login-1' });
    expect(offers(ticket(), operator, 'cancel')).toBe(true);
    expect(offers(ticket({ startedAt: STARTED }), operator, 'cancel')).toBe(false);
    expect(offers(ticket(), actor({ role: 'operator', loginId: 'login-9' }), 'cancel')).toBe(false);
  });

  it('refuses an operator on a started or closed ticket', () => {
    const operator = actor({ role: 'operator', loginId: 'login-1' });
    expect(offers(working(), operator, 'cancel')).toBe(false);
    expect(offers(ticket({ status: 'closed', startedAt: STARTED }), operator, 'cancel')).toBe(
      false,
    );
  });

  it('refuses the operator named reporter on another login (Q13), and no acting person', () => {
    const named = ticket({ reportedByPersonId: 'person-2', raisedLoginId: 'login-1' });
    expect(offers(named, actor({ role: 'operator', loginId: 'login-9' }), 'cancel')).toBe(false);
    expect(
      offers(ticket(), actor({ role: 'operator', loginId: 'login-1', personId: null }), 'cancel'),
    ).toBe(false);
  });

  it('offers a technician cancel on an own started ticket (Q16)', () => {
    expect(offers(working({ raisedLoginId: 'login-2' }), actor(), 'cancel')).toBe(true);
  });

  it('offers a shared-login operator cancel on another person unstarted ticket (Q12)', () => {
    const shared = actor({ role: 'operator', loginId: 'login-1', shared: true });
    expect(offers(ticket({ reportedByPersonId: 'person-7' }), shared, 'cancel')).toBe(true);
  });

  it('refuses own cancel on a cancelled ticket (Q14)', () => {
    const operator = actor({ role: 'operator', loginId: 'login-1' });
    expect(offers(ticket({ status: 'cancelled' }), operator, 'cancel')).toBe(false);
  });
});
