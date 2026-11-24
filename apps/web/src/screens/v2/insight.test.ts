import { describe, expect, it } from 'vitest';
import { en } from '@uptimo/shared/i18n';
import { outlierTakeaway } from './insight.js';

const t = (key: string) => (en as Record<string, string>)[key] ?? key;
const item = (name: string, value: number) => ({ name, value, shown: `${value} h` });

describe('outlierTakeaway', () => {
  it('names the worst item and how many times the others it is', () => {
    const got = outlierTakeaway([item('Shift A', 10), item('Shift B', 10), item('Shift C', 40)], t);
    expect(got).toEqual({
      text: 'Shift C is 4.0× the average of the others (40 h).',
      tone: 'loss',
      tag: 'Loss',
    });
  });

  it('takes the smallest as the outlier when low is worse', () => {
    const got = outlierTakeaway([item('A', 90), item('B', 90), item('C', 30)], t, { worse: 'low' });
    expect(got.text).toBe('C is 3.0× the average of the others (30 h).');
  });

  it('says nothing stands out when no one is far enough from the rest', () => {
    const got = outlierTakeaway([item('A', 10), item('B', 11), item('C', 12)], t);
    expect(got).toEqual({ text: 'Nothing stands out here.', tone: 'neutral', tag: 'Note' });
  });

  it('is neutral for one item or an average of zero', () => {
    expect(outlierTakeaway([item('A', 5)], t).tone).toBe('neutral');
    expect(outlierTakeaway([item('A', 5), item('B', 0)], t).tone).toBe('neutral');
  });
});
