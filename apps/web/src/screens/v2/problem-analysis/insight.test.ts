import { describe, expect, it } from 'vitest';
import { hasYardstick, tilesIn } from '../insight.js';
import { answerKey, testT } from '../printed-page/test-support.js';
import { problemAnalysisModel } from './adapter.js';

/**
 * ADR 0035 (ticket 671): each table opens with one takeaway over all its rows, and each of the eight figures names
 * its yardstick. Frozen 11 Nov answer key: 1279 breakdowns, 3,060.1 hours over 24 groups. Critical tests only
 * (ADR 0034): the figures in each line, not its wording or tone.
 */
const SECTIONS = ['groups', 'families', 'repeats', 'unplaced', 'unrecognised', 'editor'];
const model = problemAnalysisModel(answerKey('a10-problems', 'a10-problems', 41), testT)!;
const text = (id: string) => model.takeaways?.[id]?.text ?? '';
const hasFigures = (id: string, figures: string[]) => {
  for (const figure of figures) expect(text(id), id).toContain(figure);
};
const yardstick = (id: string) =>
  [...model.studied, ...model.whatIf].find((f) => f.id === id)?.yardstick ?? '';

describe('Problem Analysis takeaways and yardsticks (ticket 671)', () => {
  it('gives every table one takeaway and every figure a yardstick', () => {
    expect(Object.keys(model.takeaways ?? {}).sort()).toEqual([...SECTIONS].sort());
    for (const id of SECTIONS) expect(text(id).length, id).toBeGreaterThan(0);
    expect(
      tilesIn(model)
        .filter((tile) => !hasYardstick(tile))
        .map((tile) => tile.id),
    ).toEqual([]);
  });

  it('says how few groups, families and repeat pairs hold half the hours', () => {
    hasFigures('groups', ['5', '24', '50%']);
    hasFigures('families', ['3', '9', '58%']);
    hasFigures('repeats', ['3', '15', '54%']);
  });

  it('names the unrecognised word that stands out by hours, and invents no figure for the two lists', () => {
    hasFigures('unrecognised', ['power', '1.7', '4.9']);
    expect(text('unplaced')).not.toMatch(/\d/);
    expect(text('editor')).not.toMatch(/\d/);
  });

  it('measures the four page figures against the whole', () => {
    expect(yardstick('kpi-0')).toContain('2.39');
    expect(yardstick('kpi-1')).toContain('24');
    for (const figure of ['40.89%', '1279']) expect(yardstick('kpi-2')).toContain(figure);
    for (const figure of ['36.38%', '3,060']) expect(yardstick('kpi-3')).toContain(figure);
  });

  it('measures the four what-if figures against the whole and against today', () => {
    for (const figure of ['8%', '3,060']) expect(yardstick('kpi-4')).toContain(figure);
    for (const figure of ['4%', '1279']) expect(yardstick('kpi-5')).toContain(figure);
    expect(yardstick('kpi-6')).toContain('99.46%');
    expect(yardstick('kpi-7')).toContain('440');
  });
});
