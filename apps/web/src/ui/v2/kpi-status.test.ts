// @vitest-environment node
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { KpiCard, type KpiData } from './kpi-card.js';
import { statusOf } from './status.js';

describe('statusOf (ADR 0036 R7)', () => {
  it('judges a figure against its target in its good direction', () => {
    expect(statusOf({ value: 95, target: 90, better: 'higher' })).toBe('good');
    expect(statusOf({ value: 85, target: 90, better: 'higher' })).toBe('watch');
    expect(statusOf({ value: 70, target: 90, better: 'higher' })).toBe('bad');
    expect(statusOf({ value: 2.1, target: 2, better: 'lower' })).toBe('watch');
    expect(statusOf({ value: 3, target: 2, better: 'lower' })).toBe('bad');
    // exactly on the 10 % band edge: 2.2 - 2 is 0.2000…02 in floating point, so compare with a small tolerance
    expect(statusOf({ value: 2.2, target: 2, better: 'lower' })).toBe('watch');
    expect(statusOf({ value: 3, better: 'lower' })).toBe('neutral');
  });
});

const kpi: KpiData = {
  id: 'mttr',
  label: 'MTTR',
  icon: 'reliability',
  value: '6.22 lakh',
  delta: { text: '', up: false, good: true },
  period: '',
  meaning: 'Hours lost',
  more: '',
};

describe('KpiCard status, unit, basis and exact value', () => {
  it('draws the status, the unit after the value, the basis line and the exact value as a tooltip', () => {
    const html = renderToStaticMarkup(
      createElement(KpiCard, {
        kpi: {
          ...kpi,
          status: 'bad',
          unit: 'hrs',
          basis: 'Hours to 16 Oct',
          exact: '6,22,000 hrs',
        },
      }),
    );
    expect(html).toContain('data-status="bad"');
    expect(html).toMatch(
      /title="6,22,000 hrs"[^>]*>6\.22 lakh<span class="v2-kpi-unit">hrs<\/span>/,
    );
    expect(html).toContain('<p class="v2-kpi-basis">Hours to 16 Oct</p>');
  });

  it('names the unit to a screen reader on the drill button', () => {
    const html = renderToStaticMarkup(
      createElement(KpiCard, {
        kpi: { ...kpi, unit: 'hrs', drill: { figure: 'mttr', label: 'Open the rows' } },
      }),
    );
    expect(html).toMatch(/aria-label="[^"]*6\.22 lakh hrs[^"]*Open the rows"/);
  });

  it('adds nothing when none is given', () => {
    const html = renderToStaticMarkup(createElement(KpiCard, { kpi }));
    expect(html).not.toMatch(/data-status|v2-kpi-unit|v2-kpi-basis|title=/);
  });
});
