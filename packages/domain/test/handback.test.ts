import { describe, expect, it } from 'vitest';
import { figures } from '../src/figures.js';
import { transition, TransitionError } from '../src/state.js';
import {
  canAnswerHandback,
  currentSignoff,
  projectHandbackTimer,
  signoffTurnaround,
  type SlaPolicy,
  type SlaProjectionInput,
} from '../src/index.js';
import type { ActorContext, CrewMember, TicketEvent, WorkSegment } from '../src/types.js';
import type { Ticket } from '../src/ticket.js';

const t = (iso: string) => new Date(iso);
const at = (hhmm: string) => t(`2026-01-01T${hhmm}:00Z`);

const closed: Ticket = {
  id: 'ticket-1',
  ref: 'BD-0001',
  kind: 'stopped',
  status: 'closed',
  machineId: 'm',
  problem: 'p',
  reportedAt: at('10:00'),
  raisedLoginId: 'floor-login',
  reportedByPersonId: 'reporter',
  selfStarted: false,
  startedAt: at('10:05'),
  leadPersonId: 'lead',
  segmentStartedAt: at('10:05'),
  handedOver: false,
  handoverSince: null,
  transferToPersonId: null,
  transferToShift: null,
  transfers: 0,
  waitReason: null,
  waitSince: null,
  assignedToPersonId: null,
  machineRunningAt: at('11:00'),
  machineStoppedAt: null,
  closedAt: at('11:10'),
  closedByPersonId: 'lead',
  closeKind: 'report',
  closeNote: null,
  taskReason: null,
  taskExpectedOn: null,
  taskDownMin: null,
  kindUpgradedAt: null,
  lastEventSeq: 4,
  severity: 'S2',
  criticalitySnapshot: null,
  figures: null,
};
const events: TicketEvent[] = [
  { type: 'down', at: at('10:00') },
  { type: 'start', at: at('10:05') },
  { type: 'running', at: at('11:00') },
  { type: 'close', at: at('11:10'), handbackRequested: true },
];
const segments: WorkSegment[] = [
  { personId: 'lead', role: 'lead', startedAt: at('10:05'), endedAt: at('11:10') },
];
const crew: CrewMember[] = [];

function actor(over: Partial<ActorContext> = {}): ActorContext & { now: Date } {
  return {
    role: 'operator',
    loginId: 'floor-login',
    personId: 'someone',
    shared: false,
    now: at('11:30'),
    ...over,
  };
}

function answer(
  command: Parameters<typeof transition>[0]['command'],
  over: { ticket?: Partial<Ticket>; events?: TicketEvent[]; ctx?: Partial<ActorContext> } = {},
) {
  return transition({
    ticket: { ...closed, ...over.ticket },
    events: over.events ?? events,
    segments,
    crew,
    command,
    ctx: actor(over.ctx),
  });
}

const confirm = { type: 'handbackConfirm', personId: 'someone', sameCell: false } as const;
const dispute = {
  type: 'handbackDispute',
  personId: 'someone',
  reason: 'Still stops',
  sameCell: false,
} as const;

describe('who may answer a sign-off (DOMAIN §3)', () => {
  const ticket = { raisedLoginId: 'floor-login', reportedByPersonId: 'reporter' };
  const can = (over: Partial<ActorContext>, sameCell = false) =>
    canAnswerHandback(actor(over), ticket, sameCell);

  it('the login that raised it, the reporting person, or an operator in the same cell', () => {
    expect(can({})).toBe(true);
    expect(can({ loginId: 'other', personId: 'reporter' })).toBe(true);
    expect(can({ loginId: 'other' }, true)).toBe(true);
    expect(can({ loginId: 'other' })).toBe(false);
  });

  it('supervisor and above always; technician and board never', () => {
    for (const role of ['supervisor', 'head', 'plant_head', 'admin'] as const) {
      expect(can({ role, loginId: 'other' })).toBe(true);
    }
    for (const role of ['technician', 'board'] as const) {
      expect(can({ role }, true)).toBe(false);
    }
  });
});

describe('confirm', () => {
  it('records who confirmed and leaves the ticket closed', () => {
    const result = answer(confirm);
    expect(result.ticket.status).toBe('closed');
    expect(result.events.at(-1)).toMatchObject({ type: 'handback_confirm', at: at('11:30') });
  });

  it('refuses a person who may not answer', () => {
    expect(() => answer(confirm, { ctx: { loginId: 'other' } })).toThrow('Not allowed');
    expect(() => answer(confirm, { ctx: { role: 'technician' } })).toThrow('Not allowed');
  });

  it('refuses a ticket nobody asked production to sign off, or one already answered', () => {
    const noAsk = events.map((e) =>
      e.type === 'close' ? { type: 'close' as const, at: e.at } : e,
    );
    expect(() => answer(confirm, { events: noAsk })).toThrow(TransitionError);
    const answered = [...events, { type: 'handback_confirm' as const, at: at('11:20') }];
    expect(() => answer(confirm, { events: answered })).toThrow('already');
    expect(() => answer(dispute, { events: answered })).toThrow('already');
  });

  it('refuses a ticket that is not closed', () => {
    expect(() => answer(confirm, { ticket: { status: 'working' } })).toThrow(TransitionError);
  });
});

describe('dispute', () => {
  it('reopens the same ticket for the last lead, with a new segment from now', () => {
    const result = answer(dispute);
    expect(result.ticket).toMatchObject({
      id: 'ticket-1',
      ref: 'BD-0001',
      status: 'working',
      leadPersonId: 'lead',
      closedAt: null,
      closedByPersonId: null,
      closeKind: null,
      segmentStartedAt: at('11:30'),
    });
    expect(result.segments.at(-1)).toEqual({
      personId: 'lead',
      role: 'lead',
      startedAt: at('11:30'),
    });
    expect(result.events.at(-1)).toMatchObject({
      type: 'handback_dispute',
      reason: 'Still stops',
      at: at('11:30'),
    });
  });

  it('puts the machine back to stopped when it had been running', () => {
    expect(answer(dispute).ticket.machineStoppedAt).toEqual(at('11:30'));
  });

  it('needs a reason', () => {
    expect(() => answer({ ...dispute, reason: '  ' })).toThrow(TransitionError);
  });

  it('a second close asks again, and that one can be answered', () => {
    const reopened = answer(dispute);
    const again = [
      ...reopened.events,
      { type: 'close' as const, at: at('12:00'), handbackRequested: true },
    ];
    expect(currentSignoff(again)?.answer).toBeNull();
    expect(
      answer(confirm, { events: again, ticket: { status: 'closed' } }).events.at(-1)?.type,
    ).toBe('handback_confirm');
  });
});

describe('the sign-off clock', () => {
  const policy: SlaPolicy = {
    id: 'p',
    severity: 'S2',
    ackMinutes: 15,
    restoreMinutes: 240,
    handbackMinutes: 60,
    businessHoursOnly: false,
  };
  const input = (
    list: TicketEvent[],
    now: string,
    over: Partial<SlaPolicy> = {},
  ): SlaProjectionInput => ({
    ticket: {
      id: 'ticket-1',
      kind: 'stopped',
      severity: 'S2',
      status: 'closed',
      reportedAt: at('10:00'),
      closedAt: at('11:10'),
    },
    events: list,
    policy: { ...policy, ...over },
    now: at(now),
  });

  it('has no clock without a request or without a limit', () => {
    expect(projectHandbackTimer(input(events.slice(0, 3), '11:20'))).toBeNull();
    expect(projectHandbackTimer(input(events, '11:20', { handbackMinutes: null }))).toBeNull();
  });

  it('runs from the close and is due after the limit', () => {
    expect(projectHandbackTimer(input(events, '11:40'))).toMatchObject({
      id: 'ticket-1:handback',
      state: 'running',
      breached: false,
      dueAt: at('12:10'),
      remainingMinutes: 30,
    });
  });

  it('times out when unanswered at the due time', () => {
    expect(projectHandbackTimer(input(events, '12:10'))).toMatchObject({
      state: 'running',
      breached: true,
    });
  });

  it('stops on an answer: in time is not breached, late is, a dispute says so', () => {
    const early = [...events, { type: 'handback_confirm' as const, at: at('11:50') }];
    expect(projectHandbackTimer(input(early, '13:00'))).toMatchObject({
      state: 'stopped',
      stopReason: 'confirmed',
      breached: false,
      stoppedAt: at('11:50'),
    });
    const late = [...events, { type: 'handback_dispute' as const, at: at('12:30') }];
    expect(projectHandbackTimer(input(late, '13:00'))).toMatchObject({
      state: 'stopped',
      stopReason: 'disputed',
      breached: true,
    });
  });

  it('the next close starts a new clock', () => {
    const second = [
      ...events,
      { type: 'handback_dispute' as const, at: at('11:30') },
      { type: 'close' as const, at: at('12:00'), handbackRequested: true },
    ];
    expect(projectHandbackTimer(input(second, '12:20'))).toMatchObject({
      state: 'running',
      dueAt: at('13:00'),
    });
  });
});

describe('turnaround both ways', () => {
  const list: TicketEvent[] = [
    { type: 'down', at: at('10:00') },
    { type: 'start', at: at('10:05') },
    { type: 'pause', at: at('10:20'), pausesSla: false },
    { type: 'resume', at: at('10:50') },
    { type: 'close', at: at('11:10'), handbackRequested: true },
  ];

  it('production owns its wait and the sign-off; maintenance the rest', () => {
    expect(signoffTurnaround(list, at('10:00'), at('11:40'))).toEqual({
      maintenanceMin: 40,
      productionMin: 30 + 30,
    });
    const answered = [...list, { type: 'handback_confirm' as const, at: at('11:25') }];
    expect(signoffTurnaround(answered, at('10:00'), at('12:30'))).toEqual({
      maintenanceMin: 40,
      productionMin: 30 + 15,
    });
  });

  it('a wait that does stop the SLA clock is maintenance time', () => {
    const vendor = list.map((e) => (e.type === 'pause' ? { ...e, pausesSla: true } : e));
    expect(signoffTurnaround(vendor, at('10:00'), at('11:10'))).toEqual({
      maintenanceMin: 70,
      productionMin: 0,
    });
  });

  it('is null when nobody was asked', () => {
    expect(signoffTurnaround(list.slice(0, 2), at('10:00'), at('11:40'))).toBeNull();
  });
});

describe('downtime after a dispute', () => {
  const run = (list: TicketEvent[], closedAt?: Date) =>
    figures({
      reportedAt: at('10:00'),
      kind: 'stopped',
      selfStarted: false,
      events: list,
      segments: [],
      now: at('13:00'),
      ...(closedAt ? { closedAt } : {}),
    });
  const closes = [
    { type: 'handback_dispute' as const, at: at('11:30') },
    { type: 'close' as const, at: at('12:00'), handbackRequested: true },
  ];

  it('the disputed stretch counts and the signed-off gap does not', () => {
    const never = [
      { type: 'down' as const, at: at('10:00') },
      { type: 'close' as const, at: at('11:10') },
    ];
    expect(run([...never, ...closes], at('12:00')).downtimeMin).toBe(70 + 30);
    const ran = [...events.slice(0, 3), { type: 'close' as const, at: at('11:10') }];
    expect(run([...ran, ...closes], at('12:00')).downtimeMin).toBe(60 + 30);
  });

  it('is not final while the ticket is reopened', () => {
    expect(run([...events, closes[0] as TicketEvent]).downtimeMin).toBeNull();
  });
});
