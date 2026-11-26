import { describe, expect, it } from 'vitest';
import type { SignoffOutcome } from '@uptimo/shared/signoff';
import {
  feedRows,
  outcomeRows,
  waitedMinutes,
  type FeedItem,
  type FeedWords,
} from './signoff-feed.js';

/** 11:00 at the plant; every fixture is one shift earlier so the wait is easy to read. */
const NOW = '2026-11-13T11:00:00.000Z';

const words: FeedWords = {
  heading: "Waiting for production's OK",
  headingCount: "Waiting for production's OK ({{count}})",
  workRequest: 'Work request',
  waiting: 'Waiting {{time}}',
};

const item = (over: Partial<FeedItem> = {}): FeedItem => ({
  ticketId: 't1',
  ref: 'BD-1',
  machine: { id: 'm1', code: 'VC-1' },
  cell: 'Cell 2',
  closedAt: '2026-11-13T10:00:00.000Z',
  requestedAt: '2026-11-13T10:00:00.000Z',
  dueAt: '2026-11-13T14:00:00.000Z',
  ...over,
});

describe('the waiting feed', () => {
  it('reads oldest close first, whatever order the server sends', () => {
    const feed = feedRows(
      [
        item({ ticketId: 'new', ref: 'BD-3', closedAt: '2026-11-13T10:50:00.000Z' }),
        item({ ticketId: 'old', ref: 'BD-1', closedAt: '2026-11-13T09:00:00.000Z' }),
        item({ ticketId: 'mid', ref: 'BD-2', closedAt: '2026-11-13T10:00:00.000Z' }),
      ],
      NOW,
      words,
    );
    expect(feed.rows.map((row) => row.ref)).toEqual(['BD-1', 'BD-2', 'BD-3']);
  });

  it('reads the wait in whole minutes from the plant clock', () => {
    const asked = item({ requestedAt: '2026-11-13T09:50:00.000Z' });
    expect(waitedMinutes(NOW, asked)).toBe(70);
    expect(feedRows([asked], NOW, words).rows[0]!.waited).toBe('Waiting 1 h 10 min');
  });

  it('calls a ticket with no machine a work request, and keeps its cell', () => {
    const row = feedRows([item({ machine: null })], NOW, words).rows[0]!;
    expect(row.machine).toBe('Work request');
    expect(row.cell).toBe('Cell 2');
  });

  it('counts what is waiting in the heading line', () => {
    expect(feedRows([], NOW, words).heading).toBe("Waiting for production's OK");
    const three = [item(), item({ ticketId: 't2' }), item({ ticketId: 't3' })];
    expect(feedRows(three, NOW, words).heading).toBe("Waiting for production's OK (3)");
  });
});

describe('the sign-off outcomes of the last day', () => {
  const say = (key: string, values: Record<string, string> = {}) =>
    `${key}${Object.entries(values)
      .map(([k, v]) => ` ${k}=${v}`)
      .join('')}`;
  const outcome = (over: Partial<SignoffOutcome> = {}): SignoffOutcome => ({
    ticketId: 't1',
    ref: 'BD-1',
    machine: { id: 'm1', code: 'VC-1' },
    cell: 'Cell 2',
    status: 'confirmed',
    requestedAt: '2026-11-13T10:00:00.000Z',
    at: '2026-11-13T10:22:00.000Z',
    byPersonId: 'p1',
    reason: null,
    ...over,
  });
  const rows = (list: SignoffOutcome[]) =>
    outcomeRows(list, { say, names: { p1: 'Operator A' }, timeZone: 'UTC' });

  it('puts the newest first and says who answered, when, and how long after the close', () => {
    const [first, second] = rows([
      outcome({ ticketId: 'old', at: '2026-11-13T10:05:00.000Z' }),
      outcome({ ticketId: 'new' }),
    ]);
    expect(first!.ticketId).toBe('new');
    expect(second!.ticketId).toBe('old');
    expect(first).toMatchObject({ tone: 'gain', title: 'signoff.deskConfirmed' });
    expect(first!.detail).toContain('who=Operator A');
    expect(first!.detail).toContain('time=10:22');
    expect(first!.detail).toContain('after=22 min');
  });

  it("gives a dispute its reason and a timeout the limit it ran out at; an unknown person is 'Team member'", () => {
    const [disputed] = rows([
      outcome({ status: 'disputed', reason: 'Still vibrating', byPersonId: 'gone' }),
    ]);
    expect(disputed).toMatchObject({ tone: 'loss', title: 'signoff.deskDisputed' });
    expect(disputed!.detail).toContain('reason=Still vibrating');
    expect(disputed!.detail).toContain('who=common.teamMember');
    const [timedOut] = rows([
      outcome({ status: 'timed_out', byPersonId: null, at: '2026-11-13T14:00:00.000Z' }),
    ]);
    expect(timedOut).toMatchObject({ tone: 'risk', title: 'signoff.deskTimedOut' });
    expect(timedOut!.detail).toContain('limit=4 h');
  });

  it('names a work request when there is no machine', () => {
    expect(rows([outcome({ machine: null })])[0]!.machine).toBe('signoff.workRequest');
  });
});
