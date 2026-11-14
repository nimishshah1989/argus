import { describe, expect, it } from 'vitest';
import { canAcknowledge } from '../src/permissions.js';
import { raiseTicket, transition, TransitionError } from '../src/state.js';
import type { ActorContext, Role, TicketEvent } from '../src/types.js';

const now = new Date('2026-01-01T12:00:00Z');
const RAISED = new Date('2026-01-01T10:00:00Z');

function actor(role: Role, over: Partial<ActorContext> = {}): ActorContext {
  return { role, loginId: 'login-1', personId: 'person-1', shared: false, ...over };
}

function ticket() {
  return raiseTicket({
    id: 't-1',
    ref: 'BD-0001',
    kind: 'stopped',
    machineId: 'm-1',
    problem: 'Spindle alarm',
    reportedAt: RAISED,
    raisedLoginId: 'login-1',
    reportedByPersonId: null,
    selfStarted: false,
    startNow: false,
  });
}

function acknowledge(
  who: ActorContext,
  onRoster: boolean,
  over: { events?: TicketEvent[]; status?: 'open' | 'working' | 'waiting' | 'closed' } = {},
) {
  const raised = ticket();
  return transition({
    ticket: { ...raised.ticket, status: over.status ?? 'open' },
    events: over.events ?? raised.events,
    segments: [],
    crew: [],
    command: { type: 'acknowledge', personId: who.personId ?? '', onRoster },
    ctx: { ...who, now },
  });
}

const ROSTER_ROLES = ['technician', 'supervisor', 'head', 'plant_head'] as const;
const rostered = { onRoster: true, assignedToActor: false };
const assignee = { onRoster: false, assignedToActor: true };
const neither = { onRoster: false, assignedToActor: false };

describe('who may acknowledge (DOMAIN §2: the assignee or an on-duty person)', () => {
  it('passes a technician, supervisor, head or plant head who is on the roster', () => {
    for (const role of ROSTER_ROLES) expect(canAcknowledge(actor(role), rostered), role).toBe(true);
  });

  it('passes the ticket assignee without a roster line', () => {
    for (const role of ROSTER_ROLES) expect(canAcknowledge(actor(role), assignee), role).toBe(true);
  });

  it('refuses the same roles when they are neither on the roster nor the assignee', () => {
    for (const role of ROSTER_ROLES) expect(canAcknowledge(actor(role), neither), role).toBe(false);
  });

  it('refuses an operator and the board even when a roster line names them', () => {
    for (const role of ['operator', 'board'] as const) {
      expect(canAcknowledge(actor(role), rostered), role).toBe(false);
      expect(canAcknowledge(actor(role), assignee), role).toBe(false);
    }
  });

  it('gives an admin no pass: only the roster or the assignment lets them acknowledge', () => {
    expect(canAcknowledge(actor('admin'), neither)).toBe(false);
    expect(canAcknowledge(actor('admin'), rostered)).toBe(false);
  });

  it('refuses a shared login with no acting person, rostered or not', () => {
    const nobody = actor('technician', { shared: true, personId: null });
    expect(canAcknowledge(nobody, rostered)).toBe(false);
    expect(canAcknowledge(nobody, assignee)).toBe(false);
  });
});

describe('acknowledge command', () => {
  it('records an acknowledge event and leaves the status alone', () => {
    const result = acknowledge(actor('technician'), true);
    expect(result.ticket.status).toBe('open');
    expect(result.events.at(-1)).toMatchObject({ type: 'acknowledge', at: now });
    expect(result.ticket.lastEventSeq).toBe(1);
  });

  it('lets the assignee acknowledge without a roster line, and not someone else', () => {
    const raised = ticket();
    const assigned = { ...raised.ticket, assignedToPersonId: 'person-1' };
    const run = (who: ActorContext) =>
      transition({
        ticket: assigned,
        events: raised.events,
        segments: [],
        crew: [],
        command: { type: 'acknowledge', personId: who.personId ?? '', onRoster: false },
        ctx: { ...who, now },
      });
    expect(run(actor('technician')).events.at(-1)?.type).toBe('acknowledge');
    expect(() => run(actor('technician', { personId: 'person-2' }))).toThrow(/^Not allowed/);
  });

  it('is allowed while the ticket is being worked', () => {
    const result = acknowledge(actor('technician'), true, { status: 'working' });
    expect(result.events.at(-1)?.type).toBe('acknowledge');
  });

  it('refuses someone who is not on the roster, before looking at the ticket', () => {
    expect(() => acknowledge(actor('technician'), false, { status: 'closed' })).toThrow(
      /^Not allowed/,
    );
  });

  it('refuses a second acknowledge with a conflict, not a second event', () => {
    const first = acknowledge(actor('technician'), true);
    expect(() => acknowledge(actor('technician'), true, { events: first.events })).toThrow(
      TransitionError,
    );
    expect(() => acknowledge(actor('technician'), true, { events: first.events })).not.toThrow(
      /^Not allowed/,
    );
  });

  it('refuses a closed or waiting ticket', () => {
    for (const status of ['closed', 'waiting'] as const) {
      expect(() => acknowledge(actor('technician'), true, { status }), status).toThrow(
        TransitionError,
      );
    }
  });
});
