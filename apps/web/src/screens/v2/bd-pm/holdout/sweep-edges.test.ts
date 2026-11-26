import { describe, expect, it } from 'vitest';
import type { FiguresPart } from '../../printed-page/printed.js';
import { answerKey, testT } from '../../printed-page/test-support.js';
import { bdPmModel } from '../adapter.js';

/** Hidden edges of the bd-pm yardstick totals (sweep 706). Critical tests only (ADR 0034): figures, not wording. */
const key = answerKey('a1-bd-pm', 'a1-bd-pm', 40);

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

describe('bd-pm yardstick totals, at their edges', () => {
  it('reads a total of exactly 1 lakh as lakh', () => {
    const at = withKpis(key, {
      'Actual Breakdown': { value: '60,000.0 hrs' },
      'PM Downtime': { value: '40,000.0 hrs' },
    });
    expect(yardstick(at, 'Actual Breakdown')).toContain('1.00 lakh');
    expect(yardstick(at, 'Actual Breakdown')).toContain('60%');
  });

  it('reads a crore-scale hours total in crore', () => {
    const huge = withKpis(key, {
      'Actual Breakdown': { value: '1,00,00,000.0 hrs' },
      'PM Downtime': { value: '50,00,000.0 hrs' },
    });
    expect(yardstick(huge, 'PM Downtime')).toContain('1.50 cr');
    expect(yardstick(huge, 'PM Downtime')).toContain('33%');
  });

  it('keeps an available-hours total under 1 lakh as it prints today: 6,000 × 10 machines', () => {
    const small = withKpis(key, { 'Total Machines': { value: '10' } });
    expect(yardstick(small, 'Total Available Hrs')).toContain('60,000');
    expect(yardstick(small, 'Total Available Hrs')).not.toContain('lakh');
  });

  it('never re-rounds the annual hours the engine printed, and reads their lakh-scale product', () => {
    const annual = withKpis(key, {
      'Avg Available Hrs / Machine': {
        sub: 'hours to 11 Nov · annual 1,20,000 from Settings',
      },
    });
    expect(yardstick(annual, 'Avg Available Hrs / Machine')).toContain('1,20,000');
    expect(yardstick(annual, 'Avg Available Hrs / Machine')).not.toContain('lakh');
    // 1,20,000 a year × 125 machines = 1,50,00,000.
    expect(yardstick(annual, 'Total Available Hrs')).toContain('1.50 cr');
  });

  it('leaves the percentages as they print', () => {
    const big = withKpis(key, {
      'Actual Breakdown': { value: '1,00,000.0 hrs' },
      'PM Downtime': { value: '50,000.0 hrs' },
    });
    expect(yardstick(big, 'Fleet Availability')).toBe(yardstick(key, 'Fleet Availability'));
    expect(yardstick(key, 'Fleet Availability')).toContain('99.31%');
  });

  it('never invents a comparison for the machine count', () => {
    const big = withKpis(key, { 'Actual Breakdown': { value: '1,00,000.0 hrs' } });
    expect(yardstick(big, 'Total Machines')).not.toMatch(/\d/);
  });
});
