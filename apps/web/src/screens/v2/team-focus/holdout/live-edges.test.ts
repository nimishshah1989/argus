import { describe, expect, it } from 'vitest';
import type { FocusNote } from '@uptimo/shared/team-focus-notes';
import { focusActions, type FocusAction } from '../../../analytics/team-focus-actions.js';
import { answerKey, realT } from '../../printed-page/test-support.js';
import { teamFocusModel, withNotes } from '../adapter.js';
import { focusPeriod, KEY, liveTeamFocus } from '../live.js';

const ASOF = '2026-11-20';
const act = (key: string, stake: number, extra: Partial<FocusAction> = {}): FocusAction => ({
  key,
  lane: 'B',
  machine: null,
  title: `Action ${key}`,
  stake,
  status: 'open',
  owner: '',
  note: '',
  ...extra,
});
const note = (status: FocusNote['status'], owner = '', text = ''): FocusNote => ({
  status,
  owner,
  note: text,
  at: '2026-11-21T10:00:00.000Z',
});

describe('Team Focus live adapter: the engine’s own answer key (11-Nov-2026 plant, no notes saved)', () => {
  const reply = answerKey('team-focus', KEY, 1);
  const live = () => liveTeamFocus(reply, {}, realT);
  const extra = (reply.figures[0]!.value as { extra: Array<{ key: string; stake: number }> }).extra;

  it('lists all 31 actions as not started, nobody owning any, and reads no month from a key that has none', () => {
    const model = live();
    expect(model.actions).toHaveLength(31);
    expect(model.actions.every((a) => a.status === 'todo' && a.owner === null)).toBe(true);
    expect(model.people).toEqual([]);
    expect(model.kpis.map((k) => k.value).filter((_, i) => i !== 1)).toEqual(['31', '31', '0%']);
    expect(focusPeriod(reply)).toBeNull();
  });

  it('puts every action in "needs an owner", biggest first, a tie in the engine’s order', () => {
    const order = extra
      .map((a, at) => ({ ...a, at }))
      .sort((a, b) => b.stake - a.stake || a.at - b.at)
      .map((a) => a.key);
    expect(live().start.map((d) => d.id)).toEqual(order);
  });
});

describe('Team Focus live adapter: edges', () => {
  it('keeps an unowned action in progress in "needs an owner" and leaves a closed one out; ties keep engine order', () => {
    const actions = [
      act('a', 2),
      act('b', 5, { status: 'prog' }),
      act('c', 2),
      act('d', 9, { status: 'done' }),
      act('e', 9, { status: 'skip' }),
    ];
    const model = teamFocusModel(actions, ASOF, realT);
    expect(model.start.map((d) => d.id)).toEqual(['b', 'a', 'c']);
  });

  it('lays notes over a copy: the input is untouched and a note on a gone action adds nothing', () => {
    const actions = [act('a', 1), act('b', 2)];
    const before = structuredClone(actions);
    const laid = withNotes(actions, { b: note('prog', 'Neel S', 'x'), gone: note('done', 'Z') });
    expect(actions).toEqual(before);
    expect(laid.map((a) => a.key)).toEqual(['a', 'b']);
    expect(laid[1]).toMatchObject({ status: 'prog', owner: 'Neel S', note: 'x' });
  });

  it('when everything is closed: says so, no unowned line, no "biggest still open"', () => {
    const actions = withNotes([act('a', 3), act('b', 1)], {
      a: note('done', 'Meera K'),
      b: note('skip'),
    });
    const model = teamFocusModel(actions, ASOF, realT);
    expect(model.start).toEqual([]);
    expect(model.verdict.headline).toEqual([
      { text: 'Every action of the month is done or not needed.' },
    ]);
    expect(model.verdict.why).toEqual([[{ text: '2 of 2 actions are done or not needed (100%)' }]]);
    expect(model.kpis.find((k) => k.id === 'unowned')?.more).toBe('Every open action has an owner');
    expect(model.kpis.find((k) => k.id === 'stake')?.value).toBe('0.0 h');
  });

  it('when every open action has an owner: no unowned line, the biggest still named', () => {
    const actions = withNotes([act('a', 3), act('b', 1)], {
      a: note('open', 'Meera K'),
      b: note('prog', 'Neel S'),
    });
    const model = teamFocusModel(actions, ASOF, realT);
    expect(model.verdict.why).toEqual([
      [{ text: '0 of 2 actions are done or not needed (0%)' }],
      [{ text: 'The biggest still open: Action a, 3.0 h a month' }],
    ]);
    expect(model.people.map((p) => p.chip.label)).toEqual(['Meera K', 'Neel S']);
  });

  it('reads the stored words only: an unknown stored status is "not started"', () => {
    const actions = withNotes([act('a', 1)], {
      a: { ...note('open'), status: 'later' as FocusNote['status'] },
    });
    const model = teamFocusModel(actions, ASOF, realT);
    expect(model.actions[0]).toMatchObject({ status: 'todo', statusLabel: 'Not started' });
  });

  it('reads the actions the same way v1 did', () => {
    const value = {
      extra: [{ key: 'k', lane: 'A', title: 'T', stake: 1, status: 'open', owner: '', note: '' }],
    };
    expect(focusActions(value)).toHaveLength(1);
  });
});
