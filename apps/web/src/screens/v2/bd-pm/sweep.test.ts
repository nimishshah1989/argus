import { describe, expect, it } from 'vitest';
import type { FiguresPart } from '../printed-page/printed.js';
import { answerKey, testT } from '../printed-page/test-support.js';
import { bdPmModel } from './adapter.js';

/**
 * Sweep 706 (ADR 0041 684): the yardstick totals the adapter formats itself read as `readable` from 1 lakh up; a
 * total under 1 lakh keeps its current text; percentages and engine-printed text never change. Critical tests only
 * (ADR 0034): the figures in the line, not its wording.
 */
const key = answerKey('a1-bd-pm', 'a1-bd-pm', 40);

/** The answer key with some printed figures replaced, by label. */
function withKpis(
  reply: FiguresPart,
  changes: Record<string, { value?: string; sub?: string }>,
): FiguresPart {
  const copy = structuredClone(reply);
  const value = copy.figures[0]!.value as { pages: { kpis: { label: string }[] }[] };
  value.pages[0]!.kpis = value.pages[0]!.kpis.map((kpi) => ({ ...kpi, ...changes[kpi.label] }));
  return copy;
}

const yardstick = (reply: FiguresPart, label: string) =>
  bdPmModel(reply, testT)!.figures.find((figure) => figure.label === label)?.yardstick ?? '';

describe('BD % and PM split yardstick totals (sweep 706)', () => {
  it('reads the plant available-hours total in lakh: 6,000 a year × 125 machines', () => {
    const line = yardstick(key, 'Total Available Hrs');
    expect(line).toContain('7.50 lakh');
    expect(line).toContain('75%');
    expect(line).not.toContain('7,50,000');
  });

  it('reads a lakh-scale BD + PM hours total in lakh, with each share unchanged', () => {
    const big = withKpis(key, {
      'Actual Breakdown': { value: '1,00,000.0 hrs' },
      'PM Downtime': { value: '50,000.0 hrs' },
    });
    expect(yardstick(big, 'Actual Breakdown')).toContain('67%');
    expect(yardstick(big, 'Actual Breakdown')).toContain('1.50 lakh');
    expect(yardstick(big, 'PM Downtime')).toContain('33%');
    expect(yardstick(big, 'PM Downtime')).toContain('1.50 lakh');
  });

  it('keeps an hours total under 1 lakh as it prints today', () => {
    expect(yardstick(key, 'Actual Breakdown')).toContain('3,819.4');
    expect(yardstick(key, 'PM Downtime')).toContain('3,819.4');
  });
});
