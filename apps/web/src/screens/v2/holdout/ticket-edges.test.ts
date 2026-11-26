// @vitest-environment node
import type { TFunction } from 'i18next';
import { describe, expect, it } from 'vitest';
import '../../../i18n/index.js';
import type { Me, Ticket, TicketDetail } from '../../../api.js';
import { realT } from '../printed-page/test-support.js';
import { DETAIL, fixtureInput, SUPERVISOR, TICKET } from '../ticket/fixture.js';
import { ticketModel } from '../ticket/adapter.js';
import { allowedActions, lockoutFor } from '../ticket/model.js';

/** Ticket 771 hidden edges (ADR 0034): absent figures never print as 0, permissions at the edges, every word via i18n. */
const withTicket = (patch: Partial<Ticket>, rest: Partial<TicketDetail> = {}): TicketDetail => ({
  ...DETAIL,
  ...rest,
  ticket: { ...TICKET, ...patch },
});
const modelOf = (detail: TicketDetail, t: TFunction = realT) =>
  ticketModel({ ...fixtureInput(), detail }, t);
const ids = (detail: TicketDetail) => modelOf(detail).minutes?.figures.map((f) => f.id);

describe('figures that do not exist are not drawn as 0', () => {
  it('a support ticket has no downtime figure and no Machine downtime fact', () => {
    const m = modelOf(withTicket({ kind: 'support', machineStoppedAt: null }));
    expect(m.minutes!.figures.map((f) => f.id)).toEqual(['workTime', 'waiting']);
    expect(m.facts.some((f) => f.label === 'Machine downtime')).toBe(false);
  });

  it('a ticket with no figures yet has no Minutes card', () => {
    expect(modelOf(withTicket({ figures: null })).minutes).toBeNull();
  });

  it('a closed ticket’s final downtime of 0 is a real 0, and it is not "so far"', () => {
    const closed = withTicket({
      status: 'closed',
      closedAt: TICKET.startedAt,
      figures: { ...TICKET.figures!, downtimeMin: 0 },
    });
    const m = modelOf(closed);
    expect(m.minutes!.figures[0]).toMatchObject({ id: 'downtime', minutes: 0, value: '0 min' });
    expect(m.facts.filter((f) => f.value.endsWith('so far'))).toEqual([]);
  });

  it('a machine running again counts only the finished stopped stretches', () => {
    const running = withTicket({
      machineRunningAt: TICKET.startedAt,
      figures: { ...TICKET.figures!, downAccMin: 20 },
    });
    expect(modelOf(running).minutes!.figures[0]).toMatchObject({ id: 'downtime', minutes: 20 });
  });

  it('a person with no cached minutes gets their intervals up to the page’s clock, not the machine’s', () => {
    const m = modelOf(withTicket({ figures: { ...TICKET.figures!, perPerson: {} } }));
    expect(m.people.rows.map((r) => [r.key, r.minutes])).toEqual([
      ['p2', 65],
      ['p3', 55],
    ]);
  });
});

describe('header of a work request', () => {
  it('uses the ref as the title, with no ref chip and no kind chip', () => {
    const m = modelOf(withTicket({ kind: 'general', machineId: null, machineSnapshot: null }));
    expect(m.title).toBe('TKT-0413');
    expect(m.ref).toBeNull();
    expect(m.chips.some((c) => c.text === 'Stopped' || c.text === 'Support')).toBe(false);
    expect(ids(withTicket({ kind: 'general', machineId: null }))).not.toContain('downtime');
  });
});

describe('permissions at the edges', () => {
  const login = (role: string, actingPersonId: string, id = `u-${role}`): Me => ({
    ...SUPERVISOR,
    id,
    role,
    actingPersonId,
  });
  // Raised from the operator's own login (the domain's "own ticket" is the raising login).
  const booked = withTicket(
    {
      status: 'open',
      startedAt: null,
      segmentStartedAt: null,
      leadPersonId: null,
      raisedLoginId: 'u-operator',
    },
    { people: [], intervals: [] },
  );

  it('the reporting operator may only cancel their own unstarted ticket', () => {
    expect(allowedActions(booked, login('operator', 'p1')).map((a) => a.label)).toEqual([
      'detail.action.cancel',
    ]);
  });

  it('another operator gets nothing (the server sends canAcknowledge false to them)', () => {
    expect(allowedActions(booked, login('operator', 'p7', 'u-other'))).toEqual([]);
  });

  it('the plant head gets no work action and no cancel', () => {
    const actions = allowedActions(booked, login('plant_head', 'p8')).map((a) => a.action);
    expect(actions.filter((a) => a !== 'acknowledge')).toEqual([]);
  });

  it('with no login yet, no lockout card and no acting person', () => {
    expect(lockoutFor(DETAIL, undefined)).toEqual({ personId: '', view: null });
  });
});

describe('Gujarati: every word goes through i18n', () => {
  it('no English heading, label, chip or back link is hard-coded', () => {
    const marked = ((key: string) => `§${key}`) as unknown as TFunction;
    const m = modelOf(DETAIL, marked);
    const words = [
      m.back.label,
      m.share.label,
      m.minutes!.heading,
      m.people.heading,
      m.history.heading,
      ...m.chips.map((c) => c.text),
      ...m.facts.map((f) => f.label),
      ...m.minutes!.figures.map((f) => f.label),
    ];
    expect(words.filter((w) => !w.startsWith('§'))).toEqual([]);
  });
});
