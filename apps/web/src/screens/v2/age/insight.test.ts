// @vitest-environment node
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { en } from '@uptimo/shared/i18n';
import '../../../i18n/index.js';
import { fill } from '../../../i18n/fill.js';
import { realReply } from '../figures/real-reply.js';
import type { Translate } from '../figures/read.js';
import { hasYardstick, tilesIn } from '../insight.js';
import { ageModel } from './adapter.js';
import { AgeView } from './View.js';

/**
 * Ticket 657 (ADR 0035): the band table opens with the kit's outlier line over the average hours per machine, and every
 * band card names the fleet's average as its yardstick. Critical tests only (ADR 0034): figures, not wording or tone.
 * Frozen 11 Nov: 20+ yrs at 104.66 hrs is 3.6× the other bands; the fleet averages 3,060.1 hrs ÷ 125 = 24.48 hrs.
 */
const t: Translate = (key, values) =>
  fill((en as Record<string, string>)[key] ?? key, values ?? {});
const model = ageModel(realReply(), t)!;

describe('Age insight (ticket 657)', () => {
  it('gives its one section a takeaway', () => {
    expect(Object.keys(model.takeaways ?? {})).toEqual(['bands']);
    expect(model.takeaways?.bands?.text.length).toBeGreaterThan(0);
  });

  it('names the band that loses the most hours per machine, and by how much', () => {
    const text = model.takeaways?.bands?.text ?? '';
    for (const figure of ['20+ yrs', '3.6', '104.66']) expect(text).toContain(figure);
  });

  it('gives every band card the fleet average per machine as its yardstick', () => {
    expect(tilesIn(model).filter((tile) => !hasYardstick(tile))).toEqual([]);
    for (const kpi of model.kpis) expect(kpi.yardstick, kpi.label).toContain('24.48');
  });

  it('draws the screen with its takeaway', () => {
    const nav = [
      { id: 'm', label: 'Machines', icon: 'machines' as const, href: '/a', current: true },
    ];
    const html = renderToStaticMarkup(
      createElement(MemoryRouter, {}, createElement(AgeView, { model, nav, title: 'Age' })),
    );
    for (const figure of ['104.66', '3.6', '24.48']) expect(html).toContain(figure);
  });
});
