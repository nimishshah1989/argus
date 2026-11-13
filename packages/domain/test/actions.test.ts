import { describe, expect, it } from 'vitest';
import {
  ACTION_ORDER,
  availableActions,
  canWork,
  raiseTicket,
  transition,
  TransitionError,
  type ActionTicket,
  type ActorContext,
  type Command,
  type CrewMember,
  type Role,
  type TicketAction,
  type WorkSegment,
} from '../src/index.js';
import type { Ticket } from '../src/ticket.js';
import type { TicketEvent } from '../src/types.js';

const reportedAt = new Date('2026-01-01T10:00:00Z');
const now = new Date('2026-01-01T12:00:00Z');
const ROLES: Role[] = [
  'operator',
  'technician',
  'supervisor',
  'head',
  'plant_head',
  'admin',
  'board',
];
const RAISE_LOGIN = 'login-raise';
const LEAD = 'p-lead';
const PRIMARY = 'p-primary';
const SUPPORT = 'p-support';
const LEFT = 'p-left';
const OTHER = 'p-other';

interface State {
  ticket: Ticket;
  events: TicketEvent[];
  segments: WorkSegment[];
  crew: CrewMember[];
}

const setup: ActorContext = {
  role: 'admin',
  loginId: 'login-setup',
  personId: LEAD,
  shared: false,
};

function step(state: State, command: Command): State {
  return transition({ ...state, command, ctx: { ...setup, personId: LEAD, now } });
}

function raise(kind: Ticket['kind']): State {
  const { ticket, events, segments } = raiseTicket({
    id: 't-1',
    ref: 'BD-0001',
    kind,
    machineId: kind === 'general' ? null : 'm-1',
    problem: 'X',
    reportedAt,
    raisedLoginId: RAISE_LOGIN,
    reportedByPersonId: null,
    selfStarted: false,
    startNow: false,
  });
  return { ticket, events, segments, crew: [] };
}

/** A working ticket with a lead, a primary, a support and one person who joined and left. */
function working(kind: Ticket['kind']): State {
  let state = step(raise(kind), { type: 'start', personId: LEAD });
  state = step(state, { type: 'join', personId: PRIMARY, role: 'primary' });
  state = step(state, { type: 'join', personId: SUPPORT, role: 'support' });
  state = step(state, { type: 'join', personId: LEFT, role: 'support' });
  return step(state, { type: 'leave', personId: LEFT, reason: 'done' });
}

const VARIANTS: Record<string, (kind: Ticket['kind']) => State> = {
  open: raise,
  'open handed over': (kind) =>
    step(working(kind), { type: 'transfer', personId: LEAD, note: 'night' }),
  working,
  waiting: (kind) => step(working(kind), { type: 'pause', personId: LEAD, reason: 'spare' }),
  'closed report': (kind) => step(working(kind), { type: 'close', personId: LEAD, kind: 'report' }),
  'closed no report': (kind) =>
    step(working(kind), { type: 'close', personId: LEAD, kind: 'no_report', note: 'n' }),
  'closed done': (kind) => step(working(kind), { type: 'close', personId: LEAD, kind: 'done' }),
  'cancelled from open': (kind) =>
    step(raise(kind), { type: 'cancel', personId: LEAD, reason: 'x' }),
  'cancelled from working': (kind) =>
    step(working(kind), { type: 'cancel', personId: LEAD, reason: 'x' }),
};

function toActionTicket(state: State): ActionTicket {
  const { ticket } = state;
  return {
    status: ticket.status,
    kind: ticket.kind,
    handedOver: ticket.handedOver,
    machineRunningAt: ticket.machineRunningAt,
    startedAt: ticket.startedAt,
    raisedLoginId: ticket.raisedLoginId,
    leadPersonId: ticket.leadPersonId,
    crew: state.crew.map((member) => ({
      personId: member.personId,
      role: member.role,
      leftAt: member.leftAt ?? null,
    })),
  };
}

function commandFor(action: TicketAction, state: State, personId: string): Command {
  const commands: Record<TicketAction, Command> = {
    start: { type: 'start', personId, pickup: state.ticket.handedOver },
    resume: { type: 'resume', personId },
    update: { type: 'update', personId, text: 'x' },
    pause: { type: 'pause', personId, reason: 'spare' },
    transfer: { type: 'transfer', personId, note: 'x' },
    'machine-running': { type: 'machineRunning', personId },
    'machine-stopped': { type: 'machineStopped', personId },
    join: { type: 'join', personId, role: 'support' },
    leave: { type: 'leave', personId, reason: 'x' },
    close: { type: 'close', personId, kind: 'done' },
    cancel: { type: 'cancel', personId, reason: 'x' },
  };
  return commands[action];
}

/** The route gate in tickets/mapper.ts: these need canWork before the handler runs. */
const GATED = new Set<TicketAction>([
  'leave',
  'pause',
  'resume',
  'transfer',
  'update',
  'machine-running',
  'machine-stopped',
]);

/** What the server does: resolveActingPerson, the route gate, then transition(). */
function serverAccepts(action: TicketAction, state: State, actor: ActorContext): boolean {
  if (actor.personId === null) return false; // 403 personal login without a person, 404 shared
  if (GATED.has(action) && !canWork(actor)) return false;
  try {
    transition({
      ...state,
      command: commandFor(action, state, actor.personId),
      ctx: { ...actor, now },
    });
    return true;
  } catch (error) {
    if (error instanceof TransitionError) return false;
    throw error;
  }
}

const inPlay = (state: State) => ['working', 'waiting'].includes(state.ticket.status);

/** Rows the rulings keep hidden although the server accepts them (§10 of the slice plan). */
const HIDDEN: Partial<Record<TicketAction, (state: State, actor: ActorContext) => string | null>> =
  {
    join: (state, actor) => (actor.personId === state.ticket.leadPersonId ? 'Q3' : null),
    leave: (state) => (['closed', 'cancelled'].includes(state.ticket.status) ? 'Q5' : null),
    update: (state) => (state.ticket.status === 'open' && !state.ticket.handedOver ? 'Q7' : null),
    'machine-running': (state) => (inPlay(state) ? null : 'Q8/Q9'),
    'machine-stopped': (state) => (inPlay(state) ? null : 'Q10'),
    cancel: (state) => (inPlay(state) || state.ticket.status === 'open' ? null : 'Q14'),
  };

function* actors(): Generator<ActorContext> {
  for (const role of ROLES) {
    for (const personId of [LEAD, PRIMARY, SUPPORT, LEFT, OTHER, null]) {
      for (const shared of [false, true]) {
        for (const loginId of [RAISE_LOGIN, 'login-other'])
          yield { role, loginId, personId, shared };
      }
    }
  }
}

function* states(): Generator<[string, State]> {
  for (const [name, build] of Object.entries(VARIANTS)) {
    for (const kind of ['stopped', 'support', 'general'] as const) {
      const base = build(kind);
      yield [`${name} ${kind}`, base];
      if (kind === 'stopped') {
        yield [`${name} ${kind} running`, step(base, { type: 'machineRunning', personId: LEAD })];
      }
    }
  }
}

describe('availableActions against the server', () => {
  it('never shows what the server refuses, and hides only the ruled rows', () => {
    const problems: string[] = [];
    for (const [name, state] of states()) {
      const ticket = toActionTicket(state);
      for (const actor of actors()) {
        const shown = new Set(availableActions(ticket, actor));
        if (actor.personId === null && shown.size > 0) problems.push(`${name}: person-less shows`);
        for (const action of ACTION_ORDER) {
          const accepted = serverAccepts(action, state, actor);
          const label = `${name} ${actor.role} ${actor.personId} ${actor.shared} ${actor.loginId} ${action}`;
          if (shown.has(action) && !accepted) problems.push(`shown but refused: ${label}`);
          if (!shown.has(action) && accepted && !HIDDEN[action]?.(state, actor)) {
            problems.push(`accepted but hidden without a ruling: ${label}`);
          }
        }
      }
    }
    expect(problems.slice(0, 10)).toEqual([]);
  });
});

function pick(name: string, kind: Ticket['kind'] = 'stopped', running = false): ActionTicket {
  const base = (VARIANTS[name] as (kind: Ticket['kind']) => State)(kind);
  const state = running ? step(base, { type: 'machineRunning', personId: LEAD }) : base;
  return toActionTicket(state);
}

const tech = (personId: string | null, over: Partial<ActorContext> = {}): ActorContext => ({
  role: 'technician',
  loginId: 'login-tech',
  personId,
  shared: false,
  ...over,
});

describe('availableActions', () => {
  it('lists actions in the canonical order', () => {
    const actor: ActorContext = { ...tech(SUPPORT), role: 'supervisor' };
    expect(availableActions(pick('working', 'stopped', true), actor)).toEqual([
      'update',
      'pause',
      'transfer',
      'machine-running',
      'machine-stopped',
      'leave',
      'close',
      'cancel',
    ]);
  });

  it('offers nothing to operator, plant head and board on a started ticket', () => {
    for (const role of ['operator', 'plant_head', 'board'] as const) {
      const actor: ActorContext = { role, loginId: RAISE_LOGIN, personId: OTHER, shared: false };
      expect(availableActions(pick('working'), actor)).toEqual([]);
    }
  });

  it('reads ISO strings like dates', () => {
    const date = pick('working', 'stopped', true);
    const iso: ActionTicket = {
      ...date,
      startedAt: (date.startedAt as Date).toISOString(),
      machineRunningAt: (date.machineRunningAt as Date).toISOString(),
      crew: date.crew.map((member) => ({
        ...member,
        leftAt: member.leftAt ? (member.leftAt as Date).toISOString() : null,
      })),
    };
    for (const personId of [LEAD, SUPPORT, LEFT]) {
      expect(availableActions(iso, tech(personId))).toEqual(availableActions(date, tech(personId)));
    }
  });

  it('refuses close to a technician who is not lead or primary on a personal login', () => {
    const ticket = pick('working');
    expect(availableActions(ticket, tech(SUPPORT))).not.toContain('close');
    expect(availableActions(ticket, tech(OTHER))).not.toContain('close');
    expect(availableActions(ticket, tech(SUPPORT, { shared: true }))).toContain('close');
    expect(availableActions(ticket, tech(LEAD))).toContain('close');
    expect(availableActions(ticket, tech(PRIMARY))).toContain('close');
  });

  it('follows the rulings Q1, Q2, Q12, Q13, Q15 and Q16', () => {
    expect(availableActions(pick('open'), tech(OTHER))).not.toContain('join'); // Q1
    expect(availableActions(pick('working'), tech(LEAD))).not.toContain('leave'); // Q2
    const unstarted = pick('open');
    const operator: ActorContext = {
      role: 'operator',
      loginId: RAISE_LOGIN,
      personId: OTHER,
      shared: true,
    };
    expect(availableActions(unstarted, operator)).toEqual(['cancel']); // Q12
    expect(availableActions(unstarted, { ...operator, shared: false, loginId: 'x' })).toEqual([]); // Q13
    expect(availableActions(unstarted, { ...operator, role: 'plant_head' })).toEqual([]); // Q15
    expect(availableActions(pick('working'), tech(LEAD, { loginId: RAISE_LOGIN }))).toContain(
      'cancel',
    ); // Q16
  });
});
