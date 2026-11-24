// @vitest-environment node
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import '../../../i18n/index.js';
import { DashboardView } from './View.js';
import { dashboardTestModel } from './test-model.js';

/**
 * Ticket 613, M2b (ADR 0023): the Dashboard says what to notice. In the frozen 11 November plant: the costliest
 * problems are 485.0, 307.0 and 296.0 hrs (Axis motor / drive / encoder / servo leads); the 117 machines on the bubble
 * table lose 3,060.11 hrs between them, TMC-2 alone 307.57 (the others average 23.73); no ticket is open.
 */
const model = await dashboardTestModel();

describe('Dashboard insight', () => {
  it('opens the costliest problems with the one that outweighs the other two', () => {
    expect(model.takeaways?.costliest).toEqual({
      text: 'Axis motor / drive / encoder / servo is 1.6× the average of the others (485.0 hrs).',
      tone: 'loss',
      tag: 'Loss',
      outlier: 'Axis motor / drive / encoder / servo',
    });
  });

  it('opens the machines table with the machine far above the rest: 13 times the others', () => {
    expect(model.takeaways?.machines).toEqual({
      text: 'TMC-2 is 13.0× the average of the others (307.57 hrs).',
      tone: 'loss',
      tag: 'Loss',
      outlier: 'TMC-2',
    });
  });

  it('opens "needs you now" with a quiet note when nothing is open', () => {
    expect(model.takeaways?.needs).toEqual({
      text: 'Nothing needs you now.',
      tone: 'neutral',
      tag: 'Note',
    });
  });

  it('gives the key columns a yardstick: a bar the length of the share of the longest', () => {
    const problems = model.costliest!.table!.rows;
    expect(problems.map((r) => r[1]!.bar)).toEqual(
      [1, 0.63, 0.61].map((n) => expect.closeTo(n, 2)),
    );
    const machines = model.machines!.rows;
    expect(machines[0]![0]!.text).toBe('TMC-2');
    expect(machines[0]![3]!.bar).toBe(1);
    expect(machines[1]![3]!.bar).toBeCloseTo(0.57, 2);
  });

  it('keeps the figures: the same 117 machines, worst first', () => {
    expect(model.machines!.rows).toHaveLength(117);
    expect(model.machines!.rows.slice(0, 3).map((r) => r[3]!.text)).toEqual([
      '307.57',
      '175.08',
      '151.32',
    ]);
  });

  it('draws the takeaways with their loss pills', () => {
    const markup = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        { initialEntries: ['/analytics/today'] },
        createElement(DashboardView, {
          model,
          nav: [{ id: 'today', label: 'Today', icon: 'today' as const, href: '/a', current: true }],
          title: 'Dashboard',
        }),
      ),
    );
    expect(markup).toContain('class="v2-takeaway"');
    expect(markup).toContain('TMC-2 is 13.0× the average of the others (307.57 hrs).');
    expect(markup).toContain('v2-pill-loss');
  });
});
