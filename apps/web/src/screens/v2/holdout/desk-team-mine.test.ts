// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { realT } from '../printed-page/test-support.js';
import { mineModel } from '../desk/team-adapter.js';
import { MINE, mineFixture } from '../desk/team-fixture.js';
import { mineQuery } from '../desk/team-model.js';

/** S28-B (ADR 0045 T4), hidden: Mine edges a builder who only satisfies the visible tests gets wrong. */
const withMine = (over: Partial<typeof MINE>, rest: Partial<typeof mineFixture> = {}) =>
  mineModel({ ...mineFixture, ...rest, mine: { ...MINE, ...over } }, realT);

describe('Mine states', () => {
  it('still reading with nothing yet is loading', () => {
    expect(withMine({ items: [], loading: true }).state).toBe('loading');
  });

  it('a later page still reading keeps the rows already read on screen', () => {
    const m = withMine({ loading: true });
    expect(m.state).toBe('ready');
    expect(m.inProgress.map((card) => card.ticket.ref)).toEqual(['TKT-0409']);
  });

  it('a failed read is an error with its words', () => {
    const m = withMine({ items: [], error: 'Could not load. Try again.' });
    expect(m.state).toBe('error');
    expect(m.error).toBe('Could not load. Try again.');
  });

  it('"Nothing assigned to you." only when In progress and Waiting are both empty', () => {
    const closedOnly = MINE.items.filter((t) => t.status === 'closed');
    expect(withMine({ items: closedOnly }).empty).toBe('Nothing assigned to you.');
    const workingOnly = MINE.items.filter((t) => t.status !== 'waiting');
    expect(withMine({ items: workingOnly }).empty).toBeNull();
  });
});

describe('Mine permissions', () => {
  it('no login read yet: no quick button on any card', () => {
    const m = withMine({}, { me: undefined });
    for (const card of [...m.inProgress, ...m.waiting])
      expect(card.quick, card.ticket.ref).toBeNull();
  });

  it('no login read yet: the query is not narrowed to a stranger', () => {
    expect(mineQuery(undefined)).toEqual({ status: ['working', 'waiting', 'closed'] });
  });
});
