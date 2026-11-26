// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { REASON_MAX_LENGTH } from '@uptimo/shared/ticket';
import { formatMinutes } from '../../../components/format.js';
import { realT } from '../printed-page/test-support.js';
import {
  cancelModel,
  disputeModel,
  mineModel,
  pmModel,
  type ListsContext,
} from './lists-adapter.js';
import { listHandback, listMachine, listMe, listTicket } from './lists-fixture.js';
import {
  complaintPill,
  longestWaiting,
  mayCancel,
  oldestPmJob,
  reasonReady,
  signoffShows,
} from './lists-model.js';

const NOW = '2026-11-13T11:10:00.000Z';
const machines = [listMachine('machine-1', 'VC-17'), listMachine('machine-2', 'LT-08')];
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

describe('S27-B pill: floor words, production’s side on a closed sign-off', () => {
  it('Booked, In progress, Fixed, Cancelled', () => {
    expect(complaintPill(listTicket())).toEqual({ group: 'floor', id: 'booked' });
    expect(complaintPill(listTicket({ status: 'working' }))).toEqual({
      group: 'floor',
      id: 'in_progress',
    });
    expect(complaintPill(listTicket(closed))).toEqual({ group: 'floor', id: 'fixed' });
    expect(complaintPill(listTicket({ status: 'cancelled' }))).toEqual({
      group: 'ticket',
      id: 'cancelled',
    });
  });

  it('a closed ticket with a sign-off shows requested / confirmed / timed out', () => {
    for (const status of ['requested', 'confirmed', 'timed_out'] as const)
      expect(complaintPill(listTicket({ ...closed, handback: listHandback({ status }) }))).toEqual({
        group: 'handback',
        id: status,
      });
  });
});

describe('S27-B permissions: who is asked, who may cancel', () => {
  const asking = listTicket({ ...closed, handback: listHandback() });
  it('an answerer is asked; a technician never is', () => {
    expect(signoffShows(asking, 'operator')).toBe('ask');
    expect(signoffShows(asking, 'technician')).toBeNull();
    expect(signoffShows(listTicket(), 'operator')).toBeNull();
  });

  it('after the question: answerers read the outcome; a technician reads only a timeout', () => {
    const confirmed = listTicket({ ...closed, handback: listHandback({ status: 'confirmed' }) });
    const timedOut = listTicket({ ...closed, handback: listHandback({ status: 'timed_out' }) });
    expect(signoffShows(confirmed, 'operator')).toBe('answered');
    expect(signoffShows(confirmed, 'technician')).toBeNull();
    expect(signoffShows(timedOut, 'technician')).toBe('answered');
  });

  it('cancel only on my own ticket nobody has started', () => {
    expect(mayCancel(listTicket(), listMe())).toBe(true);
    expect(
      mayCancel(listTicket({ startedAt: '2026-11-13T09:05:00.000Z', status: 'working' }), listMe()),
    ).toBe(false);
    expect(mayCancel(listTicket(), listMe({ id: 'login-9' }))).toBe(false);
  });
});

describe('S27-B takeaway figures come from the loaded rows', () => {
  const rows = [
    listTicket({
      id: 't3',
      ref: 'BD-0153',
      reportedAt: '2026-11-13T10:00:00.000Z',
      machineId: 'machine-2',
    }),
    listTicket({
      id: 't2',
      ref: 'BD-0152',
      status: 'working',
      reportedAt: '2026-11-13T07:00:00.000Z',
      startedAt: '2026-11-13T07:05:00.000Z',
    }),
    listTicket({ id: 't1', ref: 'BD-0150', reportedAt: '2026-11-13T09:00:00.000Z' }),
  ];

  it('the Booked complaint waiting longest, out of the Booked ones (a started one is not waiting)', () => {
    expect(longestWaiting(rows, machines, NOW)).toEqual({
      ticketId: 't1',
      ref: 'BD-0150',
      place: 'VC-17',
      minutes: 130,
      of: 2,
    });
  });

  it('My complaints says it: place and wait in the takeaway, warn tone; cards keep the server’s order', () => {
    const model = mineModel(rows, ctx(), realT);
    expect(model.takeaway?.tone).toBe('risk');
    expect(model.takeaway?.outlier).toBe('t1');
    expect(model.takeaway?.text).toContain('VC-17');
    expect(model.takeaway?.text).toContain(formatMinutes(130));
    expect(model.takeaway?.tag).toBeTruthy();
    // The yardstick names how many complaints the rule looked at (the 2 Booked ones).
    expect(model.takeaway?.yardstick).toContain('2');
    expect(model.cards.map((card) => card.ref)).toEqual(['BD-0153', 'BD-0152', 'BD-0150']);
    expect(model.cards.map((card) => card.place)).toEqual(['LT-08', 'VC-17', 'VC-17']);
  });

  it('only cancellable cards carry Cancel; only an asked card carries the ask', () => {
    const asking = listTicket({ id: 't9', ref: 'BD-0140', ...closed, handback: listHandback() });
    const model = mineModel([...rows, asking], ctx(), realT);
    expect(model.cards.map((card) => card.cancel !== null)).toEqual([true, false, true, false]);
    expect(model.cards.map((card) => card.signoff?.kind ?? null)).toEqual([
      null,
      null,
      null,
      'ask',
    ]);
  });

  it('PM jobs: the oldest loaded job, each card a link to its ticket', () => {
    const pm = [
      listTicket({
        id: 'p1',
        ref: 'WR-PM-0001',
        raisedChannel: 'pm',
        kind: 'general',
        reportedAt: '2026-11-13T08:00:00.000Z',
        machineSnapshot: { code: 'CMP-01', category: null, cell: null },
      }),
      listTicket({
        id: 'p2',
        ref: 'WR-PM-0002',
        raisedChannel: 'pm',
        kind: 'general',
        status: 'working',
        reportedAt: '2026-11-13T06:10:00.000Z',
        startedAt: '2026-11-13T06:20:00.000Z',
        machineSnapshot: { code: 'CNC-01', category: null, cell: null },
      }),
    ];
    expect(oldestPmJob(pm, machines, NOW)).toMatchObject({
      ticketId: 'p2',
      minutes: 300,
      of: 2,
      place: 'CNC-01',
    });
    const model = pmModel(pm, ctx({ me: listMe({ role: 'technician' }) }), realT);
    expect(model.cards.map((card) => [card.href, card.code, card.ref])).toEqual([
      ['/desk/p1', 'CMP-01', 'WR-PM-0001'],
      ['/desk/p2', 'CNC-01', 'WR-PM-0002'],
    ]);
    expect(model.takeaway?.text).toContain('CNC-01');
    expect(model.takeaway?.tag).toBeTruthy();
    expect(model.takeaway?.yardstick).toContain('2');
    expect(model.title).toBe(realT('pm.jobs.title'));
    expect(model.hint).toBe(realT('pm.jobs.sub'));
  });
});

describe('S27-B sheets: a reason is required, its length is capped', () => {
  it('send needs trimmed text and nothing in flight', () => {
    expect(reasonReady('   ', false)).toBe(false);
    expect(reasonReady('still noisy', false)).toBe(true);
    expect(reasonReady('still noisy', true)).toBe(false);
  });

  it('Not fixed caps the reason at the server’s limit and reads a new-breakdown refusal', () => {
    const ticket = listTicket(closed);
    const plain = disputeModel(ticket, { reason: 'x', refusal: null, pending: false }, realT);
    expect(plain.maxLength).toBe(REASON_MAX_LENGTH);
    expect(plain.ready).toBe(true);
    expect(plain.refused).toBeNull();
    const refused = disputeModel(
      ticket,
      {
        reason: 'x',
        refusal: { kind: 'newBreakdown', ref: 'BD-0170', reportedAt: '2026-11-13T10:50:00.000Z' },
        pending: false,
      },
      realT,
    );
    expect(refused.refused?.title).toContain('BD-0170');
  });

  it('Cancel the ticket is ready only with a reason', () => {
    const ticket = listTicket();
    expect(cancelModel(ticket, { reason: '', error: null, pending: false }, realT).ready).toBe(
      false,
    );
    expect(
      cancelModel(ticket, { reason: 'wrong machine', error: null, pending: false }, realT).ready,
    ).toBe(true);
  });
});
