// @vitest-environment node
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import '../../../i18n/index.js';
import { frozenActionCenter } from './frozen.js';
import { ActionCenterView } from './View.js';

/**
 * Ticket 614, M2b (ADR 0023): the Action Center says what to notice. The frozen board has 5 open high nudges (HMC-2
 * broken down 12 times, HMC-2's ATC back on 2 days, VC-14 6 times, VC-16 10 times, TMC-6 7 times; TC-3's high nudge
 * is acknowledged, so it does not count) and eight machines at risk with scores 7, 4, 4, 4, 4, 3, 3, 3.
 */
const model = await frozenActionCenter();

describe('Action Center insight', () => {
  it('opens the nudges with the open high-priority count and the worst of them (most events)', () => {
    expect(model.takeaways?.nudges).toEqual({
      text: '5 high-priority nudges are open. The worst: HMC-2 has broken down 12 times in 30 days.',
      tone: 'loss',
      tag: 'Loss',
      outlier: 'freq~HMC-2',
    });
  });

  it('opens the machines at risk with the one far above the rest: 7 against an average of 3.57', () => {
    expect(model.takeaways?.risk).toEqual({
      text: 'HMC-2 is 2.0× the average of the others (7).',
      tone: 'loss',
      tag: 'Loss',
      outlier: 'HMC-2',
    });
  });

  it("gives each machine's score a yardstick: its share of the highest score", () => {
    expect(model.risk.map((r) => [r.machine?.label, r.share])).toEqual([
      ['HMC-2', 1],
      ['WJ-01', 0.57],
      ['TC-10', 0.57],
      ['VC-56', 0.57],
      ['VC-22', 0.57],
      ['VC-14', 0.43],
      ['VC-16', 0.43],
      ['TMC-6', 0.43],
    ]);
  });

  it('keeps the engine order and every nudge: worst first already, nothing dropped', () => {
    expect(model.nudges).toHaveLength(36);
    expect(model.nudges.slice(0, 2).map((n) => n.id)).toEqual(['freq~HMC-2', 'recur~HMC-2~ATC']);
  });

  it('draws the takeaway with its loss pill above the table', () => {
    const markup = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        { initialEntries: ['/analytics/today/action-center'] },
        createElement(ActionCenterView, {
          model,
          nav: [{ id: 'today', label: 'Today', icon: 'today' as const, href: '/a', current: true }],
          title: 'Action Center',
        }),
      ),
    );
    expect(markup).toContain('class="v2-takeaway"');
    expect(markup).toContain('5 high-priority nudges are open.');
    expect(markup).toContain('v2-pill-loss');
  });
});
