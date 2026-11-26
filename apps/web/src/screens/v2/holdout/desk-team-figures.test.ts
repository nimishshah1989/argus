// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { Ticket } from '../../../api.js';
import { realT } from '../printed-page/test-support.js';
import { teamModel } from '../desk/team-adapter.js';
import { ago, CLOSED, LIVE, STATE, teamFixture, ticket } from '../desk/team-fixture.js';

/** S28-B (ADR 0045 T4), hidden: Team edges a builder who only satisfies the visible tests gets wrong. */
const withLive = (open: Ticket[]) =>
  teamModel({ ...teamFixture, state: { ...STATE, open } }, realT);

describe('Team figures never invent a number', () => {
  it('a paused job whose figures have not arrived shows "—" for minutes waited, not "0 min"', () => {
    const bare = ticket('w1', 'TKT-0500', {
      machineId: 'm5',
      status: 'waiting',
      waitSince: ago(10),
      figures: null,
    });
    const row = withLive([bare]).waiting[0]!;
    expect(row.ref).toBe('TKT-0500');
    expect(row.time).toBe('—');
  });

  it('a working job with no lead is in nobody’s card', () => {
    const orphan = ticket('w2', 'TKT-0501', {
      machineId: 'm1',
      status: 'working',
      leadPersonId: null,
    });
    expect(withLive([orphan]).working).toEqual([]);
  });

  it('nobody working: no cards, no takeaway, and the empty sentence', () => {
    const m = withLive(LIVE.filter((t) => t.status !== 'working'));
    expect(m.working).toEqual([]);
    expect(m.takeaways['desk.team'] ?? null).toBeNull();
    expect(m.words.nobody).toBe('Nobody is working right now.');
  });

  it('a lead missing from the people list is a "Team member", not an id', () => {
    const stranger = { ...LIVE.find((t) => t.id === 't1')!, leadPersonId: 'p-gone' };
    const names = withLive([stranger]).working.map((card) => card.name);
    expect(names).toEqual(['Team member']);
  });
});

describe('Team windows are independent and complete', () => {
  it('the cancelled window failing leaves Closed and its totals drawn', () => {
    const m = teamModel(
      {
        ...teamFixture,
        cancelled: { items: [], loading: false, error: 'Could not load. Try again.' },
      },
      realT,
    );
    expect(m.cancelled.state).toBe('error');
    expect(m.cancelled.error).toBe('Could not load. Try again.');
    expect(m.closed.state).toBe('ready');
    expect(m.closed.rows.length).toBe(3);
  });

  it('the closed window still reading is loading, not an empty list', () => {
    const m = teamModel(
      { ...teamFixture, closed: { items: [], loading: true, error: null } },
      realT,
    );
    expect(m.closed.state).toBe('loading');
    expect(m.closed.months).toEqual([]);
  });

  it('keeps every closed job past the first 200 (230 rows read by cursor) and totals all of them', () => {
    const many = Array.from({ length: 230 }, (_, i) =>
      ticket(`pg${i}`, `PG-${i}`, {
        machineId: 'm1',
        status: 'closed',
        leadPersonId: 'p1',
        closedAt: ago(60 + i),
        reportedAt: ago(120 + i),
        figures: { ...CLOSED.items[0]!.figures!, activeMin: 1, perPerson: {} },
      }),
    );
    const m = teamModel(
      { ...teamFixture, closed: { items: many, loading: false, error: null } },
      realT,
    );
    expect(m.closed.rows).toHaveLength(230);
    expect(m.closed.months).toHaveLength(1);
    expect(m.closed.months[0]!.rows).toEqual([
      { personId: 'p1', name: 'Tech A', primary: '3 h 50 min', support: null },
    ]);
  });
});
