import { describe, expect, it } from 'vitest';
import { en } from '@uptimo/shared/i18n';
import {
  changeTakeaway,
  concentrationTakeaway,
  hasYardstick,
  takeawayFor,
  targetTakeaway,
  tilesIn,
} from './insight.js';

const t = (key: string) => (en as Record<string, string>)[key] ?? key;
const item = (name: string, value: number) => ({ name, value, shown: `${value}%` });
const shifts = [item('A shift', 96.1), item('B shift', 98.4)];
const target = { value: 98, shown: '98.0%' };

describe('targetTakeaway (ticket 619)', () => {
  it('says how many miss and names the worst, low being worse', () => {
    const got = targetTakeaway([...shifts, item('Day', 91.2)], target, t, { worse: 'low' });
    expect(got).toEqual({
      text: '2 of 3 miss 98.0%; worst is Day (91.2%).',
      tone: 'risk',
      tag: 'Risk',
    });
  });

  it('says only one meets when one of three or more does', () => {
    const got = targetTakeaway([...shifts, item('Day', 91.2)], { value: 98.4, shown: '98.4%' }, t, {
      worse: 'low',
    });
    expect(got?.text).toBe('Only B shift meets 98.4%.');
    expect(got?.tone).toBe('loss');
  });

  it('is a gain when all meet, a loss when none do', () => {
    expect(targetTakeaway(shifts, { value: 90, shown: '90%' }, t, { worse: 'low' })).toEqual({
      text: 'All 2 meet 90%.',
      tone: 'gain',
      tag: 'Gain',
    });
    expect(targetTakeaway(shifts, { value: 99, shown: '99%' }, t, { worse: 'low' })?.text).toBe(
      'None of the 2 meet 99%.',
    );
  });
});

describe('concentrationTakeaway (ticket 619)', () => {
  it('finds the few that make up half of an additive total', () => {
    const items = [40, 30, 5, 5, 5, 5, 4, 3, 2, 1].map((v, i) => item(`M${i + 1}`, v));
    expect(concentrationTakeaway(items, t)).toEqual({
      text: '2 of 10 make up 70% of the total.',
      tone: 'risk',
      tag: 'Risk',
    });
  });

  it('says nothing when the total is spread out or there are too few items', () => {
    expect(
      concentrationTakeaway(
        [1, 1, 1, 1, 1, 1].map((v, i) => item(`M${i}`, v)),
        t,
      ),
    ).toBeNull();
    expect(
      concentrationTakeaway(
        [9, 1, 1, 1, 1].map((v, i) => item(`M${i}`, v)),
        t,
      ),
    ).toBeNull();
  });
});

describe('changeTakeaway (ticket 619)', () => {
  it('signs the change and calls a rise in a bad-when-high figure a loss', () => {
    expect(changeTakeaway({ now: 110, before: 100, period: 'September' }, t)).toEqual({
      text: '+10% on September.',
      tone: 'loss',
      tag: 'Loss',
    });
  });

  it('calls a fall a gain when high is worse, with a true minus sign', () => {
    expect(changeTakeaway({ now: 88, before: 100, period: 'September' }, t)?.text).toBe(
      '−12% on September.',
    );
    expect(changeTakeaway({ now: 88, before: 100, period: 'September' }, t)?.tone).toBe('gain');
  });

  it('is neutral when the change rounds to nothing, null with nothing before', () => {
    expect(changeTakeaway({ now: 100.2, before: 100, period: 'September' }, t)?.text).toBe(
      'No change on September.',
    );
    expect(changeTakeaway({ now: 5, before: 0, period: 'September' }, t)).toBeNull();
  });
});

describe('takeawayFor (ticket 619)', () => {
  it('prefers the target when one is declared', () => {
    const got = takeawayFor(shifts, { worse: 'low', target }, t);
    expect(got.text).toBe('1 of 2 miss 98.0%; worst is A shift (96.1%).');
  });

  it('falls back to the outlier line when only a direction is declared', () => {
    const got = takeawayFor([item('A', 10), item('B', 10), item('C', 40)], { worse: 'high' }, t);
    expect(got.outlier).toBe('C');
  });
});

describe('yardsticks on tiles (ticket 619)', () => {
  it('counts a delta with text or a named yardstick, not a blank one', () => {
    const tile = { id: 'a', label: 'A', value: '1' };
    expect(hasYardstick({ ...tile, delta: { text: '+9%' } })).toBe(true);
    expect(hasYardstick({ ...tile, delta: { text: '' } })).toBe(false);
    expect(hasYardstick({ ...tile, sub: 'x', yardstick: 'Target 2.0 h' })).toBe(true);
    expect(hasYardstick({ ...tile, sub: 'x', yardstick: ' ' })).toBe(false);
  });

  it('finds every tile in a model, nested in arrays and sections', () => {
    const model = {
      title: 'x',
      sections: [{ kpis: [{ id: 'a', label: 'A', value: '1', delta: { text: '' } }] }],
      figures: { top: { id: 'b', label: 'B', value: '2', sub: '' } },
    };
    expect(tilesIn(model).map((tile) => tile.id)).toEqual(['a', 'b']);
  });
});
