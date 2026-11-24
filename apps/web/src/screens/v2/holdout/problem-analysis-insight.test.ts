import { describe, expect, it } from 'vitest';
import { answerKey, testT } from '../printed-page/test-support.js';
import { problemAnalysisModel } from '../problem-analysis/adapter.js';

/**
 * Hidden (ADR 0034, ticket 671): a what-if figure whose engine line names no "was" value gets no made-up yardstick.
 * The availability and MTBF yardsticks are read from that line; with nothing to read they carry no number.
 */
describe('Problem Analysis yardsticks invent nothing (ticket 671)', () => {
  it('leaves the availability and MTBF yardsticks without a number when the engine printed no earlier value', () => {
    const reply = answerKey('a10-problems', 'a10-problems', 41);
    const value = JSON.parse(JSON.stringify(reply.figures[0]!.value)) as {
      pages: { kpis: { sub: string }[] }[];
    };
    value.pages[0]!.kpis[6]!.sub = '';
    value.pages[0]!.kpis[7]!.sub = '';
    const odd = { ...reply, figures: [{ ...reply.figures[0]!, value }] };
    const model = problemAnalysisModel(odd, testT)!;
    for (const figure of model.whatIf.slice(2)) expect(figure.yardstick ?? '').not.toMatch(/\d/);
    expect(model.whatIf[0]!.yardstick ?? '').toContain('3,060');
  });
});
