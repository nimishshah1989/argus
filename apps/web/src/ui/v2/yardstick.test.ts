// @vitest-environment node
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { FigureTile } from './figure-tile.js';
import { KpiCard, type KpiData } from './kpi-card.js';

const kpi: KpiData = {
  id: 'mttr',
  label: 'MTTR',
  icon: 'reliability',
  value: '3.4 h',
  delta: { text: '', up: false, good: false },
  period: '',
  meaning: 'Average time to fix',
  more: '',
};

describe('yardstick on tiles (ticket 619)', () => {
  it('a KPI card with no delta shows its yardstick', () => {
    const out = renderToStaticMarkup(
      createElement(KpiCard, { kpi: { ...kpi, yardstick: 'Target 2.0 h' } }),
    );
    expect(out).toContain('class="v2-yardstick"');
    expect(out).toContain('Target 2.0 h');
  });

  it('a figure tile shows its yardstick under the value', () => {
    const out = renderToStaticMarkup(
      createElement(FigureTile, {
        figure: { id: 'x', label: 'Hours', value: '120', sub: '', yardstick: 'Last month 98' },
      }),
    );
    expect(out).toContain('class="v2-yardstick"');
    expect(out).toContain('Last month 98');
  });

  it('nothing extra when there is no yardstick', () => {
    expect(renderToStaticMarkup(createElement(KpiCard, { kpi }))).not.toContain('v2-yardstick');
  });
});
