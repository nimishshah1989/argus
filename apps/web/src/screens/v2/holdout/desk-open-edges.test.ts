// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { realT } from '../printed-page/test-support.js';
import { openModel } from '../desk/adapter.js';
import { deskFixture, ticket } from '../desk/fixture.js';
import { mayOpen, showsSettings } from '../desk/model.js';

/** S28-A (ADR 0045 T3), hidden: refusals, no invented figures, filters and the plant's day. ADR 0034. */
const refs = (cards: { ticket: { ref: string } }[]) => cards.map((card) => card.ticket.ref);

describe('desk Open edges (ticket 769, hidden)', () => {
  it('refuses every desk list, and the settings links, to the operator and the board login', () => {
    for (const role of ['operator', 'board', 'someone_else'])
      for (const view of ['open', 'mine', 'team'] as const)
        expect(mayOpen(view, role), `${role} ${view}`).toBe(false);
    expect(showsSettings('operator')).toBe(false);
    expect(showsSettings('board')).toBe(false);
  });

  it('offers no quick button while the login is unknown', () => {
    const model = openModel({ ...deskFixture, me: undefined }, realT);
    const cards = [
      ...model.breakdowns.cards,
      ...(model.breakdowns.paused?.cards ?? []),
      ...model.work.cards,
    ];
    expect(cards.length).toBeGreaterThan(0);
    for (const card of cards) expect(card.quick, card.ticket.ref).toBeNull();
  });

  it('an empty plant invents no breakdown, task, team or report figure', () => {
    const model = openModel(
      { ...deskFixture, state: { ...deskFixture.state, open: [], needReport: [] } },
      realT,
    );
    expect(model.badge).toBe(0);
    expect(model.counts.map(({ id, value }) => [id, value])).toEqual([
      ['down', 0],
      ['waiting', 0],
      ['support', 0],
      ['running', 7],
    ]);
    expect(model.breakdowns.cards).toEqual([]);
    expect(model.breakdowns.paused).toBeNull();
    expect(model.tasks.cards).toEqual([]);
    expect(model.work.cards).toEqual([]);
    expect(model.needsReport).toBeNull();
    expect(model.teamNow).not.toMatch(/\d/);
    expect(model.takeaways['desk.breakdowns']?.text ?? '').not.toMatch(/\d/);
    expect(model.takeaways['desk.tasks']?.text ?? '').not.toMatch(/\d/);
    expect(model.breakdowns.cards.some((card) => card.longest)).toBe(false);
  });

  it('a pressed Support tile keeps only support requests and says so', () => {
    const model = openModel({ ...deskFixture, filter: 'support' }, realT);
    expect(model.counts.find((tile) => tile.pressed)?.id).toBe('support');
    expect(model.counts.filter((tile) => tile.pressed)).toHaveLength(1);
    expect(refs(model.breakdowns.cards)).toEqual(['TKT-0398']);
    expect(model.breakdowns.paused).toBeNull();
    expect(model.showing).not.toBeNull();
  });

  it('a pressed Waiting tile keeps only the paused job', () => {
    const model = openModel({ ...deskFixture, filter: 'waiting' }, realT);
    expect(model.breakdowns.cards).toEqual([]);
    expect(refs(model.breakdowns.paused?.cards ?? [])).toEqual(['TKT-0390']);
  });

  it('judges a task overdue by the plant’s day, not the phone’s', () => {
    // 19:00 UTC on the 24th is already 00:30 on the 25th in Kolkata: a task due the 24th is overdue there.
    const late = ticket('t20', 'TKT-0500', {
      machineId: 'm1',
      kind: 'general',
      parentId: 'tp9',
      taskReason: 'spare',
      taskExpectedOn: '2026-11-24',
      reportedAt: '2026-11-20T06:00:00.000Z',
    });
    const model = openModel(
      {
        ...deskFixture,
        segment: 'tasks',
        state: { open: [late], needReport: [], now: '2026-11-24T19:00:00.000Z' },
      },
      realT,
    );
    expect(
      model.tasks.cards.map(({ ticket: t, state, overdue }) => [t.ref, state, overdue]),
    ).toEqual([['TKT-0500', 'overdue', true]]);
  });
});
