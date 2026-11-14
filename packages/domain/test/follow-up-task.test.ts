import { describe, expect, it } from 'vitest';
import {
  availableActions,
  canWork,
  raiseTicket,
  transition,
  TransitionError,
  type ActionTicket,
  type ActorContext,
  type Command,
  type Role,
} from '../src/index.js';
import type { TicketEvent } from '../src/types.js';

const PERSON = 'p-1';
const reportedAt = new Date('2026-01-01T10:00:00Z');
const at = (hours: number) => new Date(reportedAt.getTime() + hours * 3_600_000);
const actor = (role: Role): ActorContext => ({
  role,
  loginId: 'login-1',
  personId: PERSON,
  shared: false,
});

function open(kind: 'stopped' | 'general') {
  return raiseTicket({
    id: 't-1',
    ref: 'WR-0001',
    kind,
    machineId: kind === 'general' ? null : 'm-1',
    problem: 'X',
    reportedAt,
    raisedLoginId: 'login-raise',
    reportedByPersonId: null,
    selfStarted: false,
    startNow: false,
  });
}

function run(
  state: ReturnType<typeof open>,
  command: Command,
  now: Date,
  role: Role = 'technician',
) {
  return transition({ ...state, crew: [], command, ctx: { ...actor(role), now } });
}

describe('a follow-up task is closed straight from open', () => {
  const close: Command = {
    type: 'close',
    personId: PERSON,
    kind: 'done',
    taskDownMin: 30,
    isTask: true,
  };

  it('the person closing starts it at the close time, and the minutes are kept', () => {
    const result = run(open('general'), close, at(2));
    expect(result.events.map((event) => event.type)).toEqual(['down', 'start', 'close']);
    expect(result.events[1]?.at).toEqual(at(2));
    expect(result.ticket).toMatchObject({
      status: 'closed',
      closeKind: 'done',
      leadPersonId: PERSON,
      taskDownMin: 30,
    });
  });

  it('a ticket that is not a task still has to be worked before it is closed', () => {
    const plain: Command = { type: 'close', personId: PERSON, kind: 'done' };
    expect(() => run(open('stopped'), plain, at(2))).toThrow(TransitionError);
    expect(() => run(open('general'), plain, at(2))).toThrow(TransitionError);
  });

  it('only a role that may work can do it: an operator may not', () => {
    expect(() => run(open('general'), close, at(2), 'operator')).toThrow(TransitionError);
  });

  it.each(['technician', 'supervisor', 'head', 'admin'] as const)('a %s can', (role) => {
    expect(run(open('general'), close, at(2), role).ticket.status).toBe('closed');
  });
});

describe('the actions offered on an open task', () => {
  const task = (parentId: string | null): ActionTicket => ({
    status: 'open',
    kind: 'general',
    handedOver: false,
    machineRunningAt: null,
    startedAt: null,
    raisedLoginId: 'login-raise',
    leadPersonId: null,
    parentId,
    crew: [],
  });
  const roles: Role[] = [
    'operator',
    'technician',
    'supervisor',
    'head',
    'plant_head',
    'admin',
    'board',
  ];

  it.each(roles)('%s is offered close on an open task exactly when it may work', (role) => {
    expect(availableActions(task('p-parent'), actor(role)).includes('close')).toBe(
      canWork(actor(role)),
    );
  });

  it('a plain open ticket is not offered close', () => {
    expect(availableActions(task(null), actor('admin'))).not.toContain('close');
  });
});

describe('a task line on a breakdown is no event at the machine', () => {
  it('back-dated times on a reopened breakdown are not held up by a later task line', () => {
    const state = open('stopped');
    const started = run(state, { type: 'start', personId: PERSON }, at(1));
    const taskLine: TicketEvent = { type: 'task', at: at(70) };
    const result = transition({
      ...started,
      events: [...started.events, taskLine],
      crew: [],
      command: { type: 'machineRunning', personId: PERSON, at: at(3) },
      ctx: { ...actor('technician'), now: at(100) },
    });
    expect(result.events.at(-1)).toMatchObject({ type: 'running', at: at(3) });
  });
});
