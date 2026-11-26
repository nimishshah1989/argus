// @vitest-environment node
import i18next, { type TFunction } from 'i18next';
import { describe, expect, it } from 'vitest';
import { gu } from '@uptimo/shared/i18n';
import { realT } from '../printed-page/test-support.js';
import { disputeModel, mineModel, pmModel, type ListsContext } from '../floor/lists-adapter.js';
import { listHandback, listMachine, listMe, listTicket } from '../floor/lists-fixture.js';
import {
  complaintPill,
  complaintPlace,
  longestWaiting,
  mayCancel,
  signoffShows,
} from '../floor/lists-model.js';

const NOW = '2026-11-13T11:10:00.000Z';
const machines = [listMachine('machine-1', 'VC-17')];
const ctx = (over: Partial<ListsContext> = {}): ListsContext => ({
  me: listMe(),
  machines,
  nowIso: NOW,
  state: 'ready',
  paging: { hasNext: false, fetching: false },
  ...over,
});
const closed = {
  status: 'closed' as const,
  startedAt: '2026-11-13T09:10:00.000Z',
  closedAt: '2026-11-13T10:30:00.000Z',
};
const printed = (model: unknown) => JSON.stringify(model);

describe('S27-B floor lists: edges', () => {
  it('a disputed sign-off on a closed ticket keeps the floor word Fixed', () => {
    expect(
      complaintPill(listTicket({ ...closed, handback: listHandback({ status: 'disputed' }) })),
    ).toEqual({
      group: 'floor',
      id: 'fixed',
    });
  });

  it('the board and a technician are never asked, and never read "You said…" lines', () => {
    const confirmed = listTicket({
      ...closed,
      handback: listHandback({ status: 'confirmed', respondedAt: '2026-11-13T10:52:00.000Z' }),
    });
    const reopened = listTicket({
      ...closed,
      status: 'open',
      handback: listHandback({ status: 'disputed', disputeReason: 'Still vibrating' }),
    });
    for (const role of ['technician', 'board']) {
      expect(signoffShows(listTicket({ ...closed, handback: listHandback() }), role)).toBeNull();
      expect(signoffShows(confirmed, role)).toBeNull();
      expect(signoffShows(reopened, role)).toBeNull();
    }
  });

  it('a login with no known role gets no Cancel and does not throw', () => {
    expect(mayCancel(listTicket(), listMe({ role: 'nobody' }))).toBe(false);
  });

  it('missing times are left out, never printed as Invalid Date, NaN or null', () => {
    const asking = listTicket({ ...closed, closedAt: null, handback: listHandback() });
    const timedOut = listTicket({
      ...closed,
      closedAt: null,
      id: 't2',
      handback: listHandback({ status: 'timed_out', dueAt: null }),
    });
    const model = mineModel([asking, timedOut], ctx(), realT);
    const ask = model.cards[0]?.signoff;
    expect(ask?.kind).toBe('ask');
    expect(ask?.kind === 'ask' ? ask.body : 'x').toBeNull();
    expect(printed(model)).not.toMatch(/Invalid Date|NaN|undefined|null min/);
  });

  it('no Booked complaint (all started, closed or none): no takeaway, never a 0-minute wait', () => {
    expect(longestWaiting([], machines, NOW)).toBeNull();
    const started = listTicket({ status: 'working', startedAt: '2026-11-13T09:05:00.000Z' });
    expect(longestWaiting([started, listTicket(closed)], machines, NOW)).toBeNull();
    expect(mineModel([started], ctx(), realT).takeaway).toBeNull();
    expect(pmModel([], ctx({ state: 'empty' }), realT).takeaway).toBeNull();
  });

  it('a clock running behind the report never gives a negative wait', () => {
    const future = listTicket({ reportedAt: '2026-11-13T11:30:00.000Z' });
    expect(longestWaiting([future], machines, NOW)?.minutes).toBe(0);
  });

  it('other work shows its place; a machine unknown to the plant shows nothing rather than an id', () => {
    expect(
      complaintPlace(
        listTicket({ machineId: null, machineSnapshot: null, kind: 'general', location: 'Stores' }),
        machines,
      ),
    ).toBe('Stores');
    expect(complaintPlace(listTicket({ machineId: 'gone', location: null }), machines)).toBe('');
  });

  it('a PM job off any machine is named by its place', () => {
    const job = listTicket({
      id: 'p1',
      raisedChannel: 'pm',
      kind: 'general',
      machineId: null,
      machineSnapshot: null,
      location: 'Tool room',
    });
    expect(pmModel([job], ctx({ me: listMe({ role: 'technician' }) }), realT).cards[0]?.code).toBe(
      'Tool room',
    );
  });

  it('Load more is offered only while another page exists, and is busy while it loads', () => {
    expect(mineModel([listTicket()], ctx(), realT).more).toBeNull();
    expect(
      mineModel([listTicket()], ctx({ paging: { hasNext: true, fetching: false } }), realT).more
        ?.busy,
    ).toBe(false);
    expect(
      mineModel([listTicket()], ctx({ paging: { hasNext: true, fetching: true } }), realT).more
        ?.busy,
    ).toBe(true);
  });

  it('a new-breakdown refusal without a REF still reads, and the sheet then only goes back', () => {
    const model = disputeModel(
      listTicket(closed),
      {
        reason: 'x',
        refusal: { kind: 'newBreakdown', ref: null, reportedAt: null },
        pending: false,
      },
      realT,
    );
    expect(model.refused?.title).toBeTruthy();
    expect(model.refused?.reported).toBeNull();
    expect(model.ready).toBe(false);
  });

  it('another cell’s phone is told so in words, not as the new-breakdown refusal', () => {
    const model = disputeModel(
      listTicket(closed),
      { reason: 'x', refusal: { kind: 'otherCell' }, pending: false },
      realT,
    );
    expect(model.refused).toBeNull();
    expect(model.error).toBe(realT('signoff.otherCell'));
  });

  it('a refused "Yes" says why on its card in words; a pending answer disables Yes on that card only', () => {
    const a = listTicket({ id: 'a', ...closed, handback: listHandback() });
    const b = listTicket({ id: 'b', ...closed, handback: listHandback() });
    const asks = (answer: ListsContext['answer']) =>
      mineModel([a, b], ctx({ answer }), realT).cards.map((card) =>
        card.signoff?.kind === 'ask' ? [card.signoff.error, card.signoff.busy] : null,
      );
    expect(asks({ ticketId: 'a', pending: false, refusal: { kind: 'notAllowed' } })).toEqual([
      [realT('signoff.notAllowed'), false],
      [null, false],
    ]);
    expect(asks({ ticketId: 'b', pending: false, refusal: { kind: 'other' } })[1]).toEqual([
      realT('signoff.failed'),
      false,
    ]);
    expect(asks({ ticketId: 'a', pending: true, refusal: null })).toEqual([
      [null, true],
      [null, false],
    ]);
    expect(asks(undefined)).toEqual([
      [null, false],
      [null, false],
    ]);
  });

  it('offline or failed loads keep their state and draw no cards or takeaway', () => {
    for (const state of ['offline', 'error', 'loading'] as const) {
      const model = mineModel([], ctx({ state }), realT);
      expect(model.state).toBe(state);
      expect(model.cards).toEqual([]);
      expect(model.takeaway).toBeNull();
    }
  });
});

describe('S27-B floor lists: Gujarati', () => {
  const guT = (() => {
    const inst = i18next.createInstance();
    void inst.init({
      lng: 'gu',
      resources: { gu: { translation: { ...gu } } },
      interpolation: { escapeValue: false },
    });
    return inst.t.bind(inst) as unknown as TFunction;
  })();

  it('every word comes through t: the Gujarati catalogue, not English', () => {
    const rows = [listTicket({ reportedAt: '2026-11-13T09:00:00.000Z' })];
    const mine = mineModel(rows, ctx(), guT);
    expect(mine.title).toBe(gu['floor.complaints']);
    expect(mine.empty).toBe(gu['floor.complaintsEmpty']);
    expect(mine.cards[0]?.kindLine.startsWith(gu['reportFloor.kindStopped'] ?? '?')).toBe(true);
    expect(mine.cards[0]?.cancel).toBe(gu['action.cancel']);
    const english = mineModel(rows, ctx(), realT);
    expect(mine.takeaway?.text).toBeTruthy();
    expect(mine.takeaway?.text).not.toBe(english.takeaway?.text);
    expect(mine.takeaway?.tag).not.toBe(english.takeaway?.tag);
    const pm = pmModel([], ctx({ state: 'empty' }), guT);
    expect(pm.title).toBe(gu['pm.jobs.title']);
    expect(pm.empty).toBe(gu['pm.jobs.empty']);
  });
});
