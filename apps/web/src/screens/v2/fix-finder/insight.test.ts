import { describe, expect, it } from 'vitest';
import { answerKey, testT } from '../printed-page/test-support.js';
import { fixFinderModel } from './adapter.js';

/**
 * Ticket 672 (ADR 0035): the cases table opens with one line over the downtime of every case the engine printed, and
 * the typical-downtime tile names the engine's own average. Critical tests only (ADR 0034): figures, never wording.
 * Frozen 11 Nov answer key: 15 cases, 24.17 h; TC-13 10.35 h and VC-15 3.33 h make up 57%.
 */
const model = fixFinderModel(answerKey('fix-finder', 'fix-finder', 43), testT)!;
const tile = (id: string) => model.figures.find((f) => f.id === id)!;

describe('Fix Finder insight (ticket 672)', () => {
  it('gives its one section a takeaway', () => {
    expect(Object.keys(model.takeaways ?? {})).toEqual(['cases']);
    expect(model.takeaways?.cases?.text.length).toBeGreaterThan(0);
  });

  it('says how few cases hold most of the downtime, over every case', () => {
    const text = model.takeaways?.cases?.text ?? '';
    for (const figure of ['2', '15', '57%']) expect(text).toContain(figure);
  });

  it('measures the typical downtime against the engine’s own average', () => {
    expect(tile('kpi-2').yardstick ?? '').toContain('2.3');
  });

  it('never compares a dash with anything', () => {
    expect(tile('kpi-1').value).toBe('—');
    expect(tile('kpi-1').yardstick ?? '').not.toMatch(/\d/);
  });
});
