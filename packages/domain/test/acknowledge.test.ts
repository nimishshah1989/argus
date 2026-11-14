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

describe('who may acknowledge (DOMAIN §3)', () => {
  it('passes a technician, supervisor, head or plant head who is on the roster', () => {
    for (const role of ['technician', 'supervisor', 'head', 'plant_head'] as const) {
      expect(canAcknowledge(actor(role), true), role).toBe(true);
    }
  });

  it('refuses the same roles when they are not on the roster', () => {
    for (const role of ['technician', 'supervisor', 'head', 'plant_head'] as const) {
      expect(canAcknowledge(actor(role), false), role).toBe(false);
    }
  });

  it('refuses an operator and the board even when a roster line names them', () => {
    expect(canAcknowledge(actor('operator'), true)).toBe(false);
    expect(canAcknowledge(actor('board'), true)).toBe(false);
  });

  it('lets an admin acknowledge without a roster line (the matrix says yes)', () => {
    expect(canAcknowledge(actor('admin', { personId: null }), false)).toBe(true);
  });

  it('refuses a shared login with no acting person, rostered or not', () => {
    expect(canAcknowledge(actor('technician', { shared: true, personId: null }), true)).toBe(false);
  });
});

describe('acknowledge command', () => {
  it('records an acknowledge event and leaves the status alone', () => {
    const result = acknowledge(actor('technician'), true);
    expect(result.ticket.status).toBe('open');
    expect(result.events.at(-1)).toMatchObject({ type: 'acknowledge', at: now });
    expect(result.ticket.lastEventSeq).toBe(1);
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
