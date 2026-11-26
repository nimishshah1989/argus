// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { CompareReply } from '@uptimo/shared/compare-pair';
import { answerKey, realT } from '../printed-page/test-support.js';
import { liveCompare } from './live.js';
import { moneyText } from './sweep.js';

/** Sweep 706, batch D: Compare's money keeps its text under a lakh and reads as the kit's from a lakh up. */

const plain = (s: string) => s.replace(/\s/g, ' ');
const FIGURE = answerKey('compare', 'compare', 43).figures[0]!;
type Year = NonNullable<CompareReply['years']>[0];
const year = (over: Partial<Year>): Year => ({
  machineId: 'id',
  code: 'X',
  category: 'Vertical Machining Center',
  cell: 'Cell 1',
  age: 6,
  count: 0,
  hours: 0,
  plannedHours: 5000,
  causes: [],
  weekly: Array.from({ length: 12 }, () => 0),
  last: { count: 0, hours: 0 },
  ...over,
});

describe('moneyText', () => {
  it('keeps the page’s own text under a lakh', () => {
    expect(moneyText(40000)).toBe('₹ 0.40 lakh');
    expect(moneyText(16000)).toBe('₹ 0.16 lakh');
  });

  it('reads as the kit’s rupees from a lakh up', () => {
    expect(moneyText(3823000)).toBe('₹ 38.23 lakh');
    expect(moneyText(12000000)).toBe('₹ 1.20 cr');
  });
});

describe('the live Compare prints crore-scale money the kit’s way', () => {
  it('a 20-hour gap at ₹ 10,00,000 an hour is "₹ 2.00 cr", on the figure and the key figure', () => {
    const m = liveCompare(
      {
        asOf: '2026-11-11',
        pair: { a: 'VC-28', b: 'VC-22' },
        options: ['VC-28', 'VC-22'],
        figure: FIGURE,
        years: [year({ code: 'VC-28', count: 8, hours: 20 }), year({ code: 'VC-22', count: 4 })],
        rate: 1000000,
      },
      realT,
    );
    const money = m.boxes[0].figures.find((f) => f.id === 'money')!;
    expect(plain(money.value)).toBe('₹ 2.00 cr');
    expect(plain(m.kpis.find((k) => k.id === 'money')!.value)).toBe('₹ 2.00 cr');
  });
});
