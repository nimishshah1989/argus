import { describe, expect, it } from 'vitest';
import { en } from '@uptimo/shared/i18n';
import {
  changeTakeaway,
  concentrationTakeaway,
  takeawayFor,
  targetTakeaway,
  tilesIn,
} from '../insight.js';

const t = (key: string) => (en as Record<string, string>)[key] ?? key;
const item = (name: string, value: number) => ({ name, value, shown: `${value} h` });

describe('insight rules: edges (ticket 619, hidden)', () => {
  it('a value equal to the target meets it, high or low worse', () => {
    expect(targetTakeaway([item('A', 2), item('B', 2)], { value: 2, shown: '2 h' }, t)?.tone).toBe(
      'gain',
    );
    expect(
      targetTakeaway([item('A', 2), item('B', 2)], { value: 2, shown: '2 h' }, t, { worse: 'low' })
        ?.tone,
    ).toBe('gain');
  });

  it('high worse: the worst named is the largest that misses', () => {
    const got = targetTakeaway(
      [item('A', 3), item('B', 9), item('C', 1)],
      { value: 2, shown: '2 h' },
      t,
    );
    expect(got?.text).toBe('Only C meets 2 h.');
    const two = targetTakeaway([item('A', 3), item('B', 9)], { value: 4, shown: '4 h' }, t);
    expect(two?.text).toBe('1 of 2 miss 4 h; worst is B (9 h).');
  });

  it('no items: no target line', () => {
    expect(targetTakeaway([], { value: 2, shown: '2 h' }, t)).toBeNull();
  });

  it('concentration ignores negatives and zeros, needs a third or fewer', () => {
    const items = [50, 50, 0, 0, 0, -5].map((v, i) => item(`M${i}`, v));
    expect(concentrationTakeaway(items, t)?.text).toBe('1 of 6 make up 50% of the total.');
    const third = [30, 30, 10, 10, 10, 10].map((v, i) => item(`M${i}`, v));
    expect(concentrationTakeaway(third, t)?.text).toBe('2 of 6 make up 60% of the total.');
    const over = [20, 20, 20, 15, 15, 10].map((v, i) => item(`M${i}`, v));
    expect(concentrationTakeaway(over, t)).toBeNull();
  });

  it('change: low worse flips the tone; negative before uses its size', () => {
    expect(changeTakeaway({ now: 90, before: 100, period: 'P' }, t, { worse: 'low' })?.tone).toBe(
      'loss',
    );
    expect(changeTakeaway({ now: 0, before: -10, period: 'P' }, t)?.text).toBe('+100% on P.');
    expect(changeTakeaway({ now: 1, before: Number.NaN, period: 'P' }, t)).toBeNull();
  });

  it('picks change before concentration, concentration only when additive', () => {
    const many = [40, 30, 5, 5, 5, 5, 4, 3, 2, 1].map((v, i) => item(`M${i}`, v));
    const change = { now: 110, before: 100, period: 'P' };
    expect(takeawayFor(many, { worse: 'high', additive: true, change }, t).text).toBe('+10% on P.');
    expect(takeawayFor(many, { worse: 'high', additive: true }, t).text).toBe(
      '2 of 10 make up 70% of the total.',
    );
    expect(takeawayFor(many, { worse: 'high' }, t).text).not.toContain('of the total');
  });

  it('a change that cannot be worked out falls through to the next rule', () => {
    const got = takeawayFor(
      [item('A', 10), item('B', 10), item('C', 40)],
      { worse: 'high', change: { now: 1, before: 0, period: 'P' } },
      t,
    );
    expect(got.outlier).toBe('C');
  });

  it('tilesIn survives cycles and does not search inside a tile', () => {
    const tile: Record<string, unknown> = { id: 'a', label: 'A', value: '1', sub: '' };
    tile.inner = { id: 'b', label: 'B', value: '2', sub: '' };
    const model: Record<string, unknown> = { list: [tile, tile] };
    model.self = model;
    expect(tilesIn(model).map((x) => x.id)).toEqual(['a']);
    expect(tilesIn(null)).toEqual([]);
  });
});
