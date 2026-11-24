// @vitest-environment node
import { en } from '@uptimo/shared/i18n';
import { describe, expect, it } from 'vitest';
import type { Ticket } from '../../../api.js';
import { realReply } from '../figures/real-reply.js';
import type { Translate } from '../figures/read.js';
import { dashboardModel } from './adapter.js';
import { dashboardTestModel, priorReply } from './test-model.js';

/**
 * Ticket 640, M2b (ADR 0031 §2; critical tests only, ADR 0034: figures, not wording or tone): the Dashboard says what to notice. In the frozen 11 November plant, against
 * 12 October: Axis motor / drive / encoder / servo leads the costliest problems at 485.0 hrs; 13 of the 117 machines
 * on the bubble table make up 51% of the 3,060.11 hrs; no ticket is open; every card names its 12 October value.
 */
const model = await dashboardTestModel();

const t: Translate = (key, values = {}) =>
  ((en as Record<string, string>)[key] ?? key).replace(/\{\{?(\w+)\}?\}/g, (whole, name: string) =>
    Object.hasOwn(values, name) ? String(values[name]) : whole,
  );

describe('Dashboard takeaways', () => {
  it('opens the costliest problems with the one that outweighs the others', () => {
    const text = model.takeaways?.costliest?.text ?? '';
    for (const figure of ['Axis motor / drive / encoder / servo', '1.6', '485.0'])
      expect(text).toContain(figure);
  });

  it('opens the machines table with how few machines carry half the hours', () => {
    const text = model.takeaways?.machines?.text ?? '';
    for (const figure of ['13', '117', '51%']) expect(text).toContain(figure);
  });

  it('opens "needs you now" with the open counts when something is open', () => {
    const late = {
      id: 't1',
      ref: 'BD-1',
      kind: 'stopped',
      status: 'open',
      machineId: 'm1',
      reportedAt: '2026-11-11T02:00:00Z',
      machineRunningAt: null,
      machineStoppedAt: null,
      waitSince: null,
      handedOver: false,
      urgent: false,
      parentId: null,
      taskExpectedOn: null,
      figures: null,
      sla: { ack: { breached: true } },
    } as unknown as Ticket;
    const busy = dashboardModel(
      {
        reply: realReply(),
        open: { tickets: [late], now: '2026-11-11T09:00:00.000Z' },
        board: null,
        machines: [],
      },
      t,
    );
    expect(busy.needs.state).toBe('ready');
    const counts = (busy.needs as { counts: string }).counts;
    expect(counts).toMatch(/^1 open/);
    expect(busy.takeaways?.needs?.text).toBe(counts);
  });
});

describe('Dashboard tiles carry a yardstick: the 12 October value', () => {
  const kpis = model.sections.flatMap((s) => s.kpis);

  it('every card whose figure the 12 October reply has', () => {
    expect(priorReply().asOf).toBe('2026-10-12');
    expect(kpis).toHaveLength(17);
    expect(kpis.filter((k) => !k.yardstick).map((k) => k.id)).toEqual([]);
  });

  it('prints the day and the value the engine printed that day', () => {
    const at = (id: string) => kpis.find((k) => k.id === `dashboard.${id}`)?.yardstick;
    expect(at('fleet-availability')).toBe('12-Oct-2026: 99.29%');
    expect(at('total-downtime-hours')).toBe('12-Oct-2026: 2,831.5 hrs');
    expect(at('breakdown-free')).toBe('12-Oct-2026: 42 of 124');
    expect(at('avg-complaints-per-day')).toBe('12-Oct-2026: 3.85 /day');
    expect(at('cnc-machines')).toBe('12-Oct-2026: 125');
  });

  it('has no yardstick without a prior reply', () => {
    const alone = dashboardModel({ reply: realReply(), open: null, board: null, machines: [] }, t);
    expect(alone.sections.flatMap((s) => s.kpis).filter((k) => k.yardstick)).toEqual([]);
  });
});
