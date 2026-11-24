import { describe, expect, it } from 'vitest';
import { hasYardstick, tilesIn } from '../insight.js';
import { answerKey, testT } from '../printed-page/test-support.js';
import { whyWhyModel } from './adapter.js';

/**
 * ADR 0035 (ticket 670): the candidate list opens with one takeaway over the hours down of all its rows, whatever
 * filter or page is shown. Frozen 11 Nov answer key. Critical tests only (ADR 0034): figures, not wording or tone.
 */
const model = whyWhyModel(answerKey('a6-why-why', 'a6-why-why', 41), testT)!;
const text = model.takeaways?.candidates?.text ?? '';

describe('Why-Why takeaway (ticket 670)', () => {
  it('gives the one section a takeaway; the page has no figure tiles to measure', () => {
    expect(Object.keys(model.takeaways ?? {})).toEqual(['candidates']);
    expect(text.length).toBeGreaterThan(0);
    expect(tilesIn(model).filter((tile) => !hasYardstick(tile))).toEqual([]);
  });

  it('says how few of all 24 breakdowns hold half the hours down', () => {
    for (const figure of ['5', '24', '55%']) expect(text).toContain(figure);
  });
});
