// @vitest-environment node
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import i18n from 'i18next';
import type { Ticket } from '@uptimo/shared/replies';
import { ENGINE_DATA } from '../../../../../../packages/domain/test/answer-key/fixture.js';
import '../../../i18n/index.js';
import { UUID, printed, realBoard, realReply } from '../figures/real-reply.js';
import { dashboardModel, type DashFacts } from './adapter.js';
import { priorDate } from './change.js';
import { DashboardView } from './View.js';

/**
 * The completeness test: every item v1's Dashboard showed is printed by the v2 page, from the engine's real reply over
 * the frozen 11 November plant (and the same engine run 30 days earlier, for the changes), not from rows written for the
 * test. The strip is built from tickets in the desk's own shape.
 */
const t = (key: string, values?: Record<string, string | number>) =>
  i18n.t(key, { ...values }) as string;
const reply = realReply();
const before = realReply(priorDate(reply.asOf));
const NOW = '2026-11-11T12:00:00.000Z';
const ticket = (over: Partial<Ticket>) =>
  ({
    id: 't1',
    ref: 'BD-1',
    kind: 'stopped',
    status: 'open',
    machineId: 'HMC-2',
    problem: 'Spindle alarm',
    reportedAt: '2026-11-11T08:00:00Z',
    machineRunningAt: null,
    machineStoppedAt: '2026-11-11T08:00:00Z',
    waitSince: null,
    handedOver: false,
    parentId: null,
    taskExpectedOn: null,
    location: null,
    sla: { ack: { breached: true } },
    ...over,
  }) as unknown as Ticket;
const machines = ENGINE_DATA.machines.map((m) => ({
  id: m.id,
  code: m.code,
  category: m.category ?? null,
}));
const facts: DashFacts = {
  machines,
  state: { open: [ticket({})], now: NOW },
  board: realBoard(),
  before,
};
const model = dashboardModel(reply, facts, t)!;
const nav = [{ id: 'today', label: 'Today', icon: 'today' as const, href: '/a', current: true }];
const markup = renderToStaticMarkup(
  createElement(
    MemoryRouter,
    { initialEntries: ['/analytics/today'] },
    createElement(DashboardView, { model, nav, title: 'Dashboard' }),
  ),
);
const figures = reply.figures.filter((f) => f.screen === 'dashboard');
const strings = printed(model);

describe('the v2 Dashboard prints everything v1 showed', () => {
  it('all twenty engine figures, each in its own period and printed as the engine gave it', () => {
    expect(figures).toHaveLength(20);
    const kpi = (id: string) => model.kpis.find((k) => k.id === id)!;
    expect(kpi('dashboard.total-machines').value).toBe('159');
    expect(kpi('dashboard.total-breakdowns').value).toBe('1,279');
    expect(kpi('dashboard.total-downtime-hours').value).toBe('3,060.1 hrs');
    expect(kpi('dashboard.fleet-availability').value).toBe('99.32%');
    expect(kpi('dashboard.avg-bd-hours-per-machine').value).toBe('24.29 hrs/machine');
    expect(kpi('dashboard.breakdown-free').value).toBe('53 of 125 machines');
    expect(model.kpis.map((k) => k.id)).toHaveLength(17);
    expect(model.charts.map((c) => c.id)).toEqual([
      'dashboard.bubble-chart',
      'dashboard.expansion-timeline',
    ]);
    expect(model.costliest!.table.rows).toHaveLength(3);
    expect(model.costliest!.pareto.total).toBe(3060.1);
  });

  it('the costliest problems with their hours, share and number of breakdowns', () => {
    const [first] = model.costliest!.table.rows;
    expect(first!.map((cell) => cell.text)).toEqual([
      'Axis motor / drive / encoder / servo',
      '485 hrs',
      '15.85%',
      '104',
    ]);
    const bars = model.costliest!.pareto.bars;
    expect(bars.reduce((sum, bar) => sum + bar.hours, 0)).toBeCloseTo(3060.1, 5);
  });

  it('the change against 30 days earlier: a verdict for a rate, a quiet amount for a running total', () => {
    const kpi = (id: string) => model.kpis.find((k) => k.id === id)!;
    expect(kpi('dashboard.total-machines').delta.text).toBe('');
    expect(kpi('dashboard.total-breakdowns').delta.flat).toBe(true);
    expect(kpi('dashboard.total-breakdowns').delta.text).toMatch(/ in 30 days$/);
    expect(model.verdict.context).toContain('Changes are against 12-Oct-2026, 30 days earlier');
    expect(kpi('dashboard.total-breakdowns').period).toBe('vs 12-Oct-2026');
  });

  it('every figure v1 drilled opens its rows', () => {
    for (const figure of figures.filter((f) => f.drill.ids.length > 0)) {
      const drill = [...model.kpis, ...model.charts, ...(model.costliest?.pareto.bars ?? [])].find(
        (item) => ('drill' in item ? item.drill?.figure === figure.key : false),
      );
      expect(drill, figure.key).toBeDefined();
    }
  });

  it('the strip of what needs a person now, with its count line and the way to each ticket', () => {
    expect(model.needs!.counts).toBe('1 open · 1 clocks breached');
    expect(model.needs!.items[0]).toMatchObject({
      ref: 'BD-1',
      breach: 'Acknowledge clock breached',
      href: '/desk/t1',
      where: { text: 'HMC-2' },
    });
    const calm = dashboardModel(reply, { ...facts, state: { open: [], now: NOW } }, t)!;
    expect(calm.needs!.empty).toBe('Nothing needs you now.');
    expect(dashboardModel(reply, { ...facts, state: null }, t)!.needs).toBeNull();
  });

  it('the Action Center banner with the open high and medium counts, and the way to it', () => {
    const { high, med } = facts.board!.bySeverity;
    expect(model.banner).toEqual({
      text: `${high} high-priority and ${med} medium nudges need attention`,
      href: '/analytics/today/action-center',
    });
    expect(dashboardModel(reply, { ...facts, board: null }, t)!.banner).toBeNull();
  });

  it('a figure the engine has not computed says so and claims no value', () => {
    const held = {
      ...reply,
      figures: reply.figures.map((f) =>
        f.key === 'dashboard.plant-bd-pct'
          ? { ...f, status: 'not_computed' as const, value: null }
          : f,
      ),
    };
    const card = dashboardModel(held, facts, t)!.kpis.find(
      (k) => k.id === 'dashboard.plant-bd-pct',
    )!;
    expect([card.value, card.meaning, card.drill]).toEqual(['—', 'Not computed yet', undefined]);
  });

  it('the as-of date, the machines left out, and the answer first', () => {
    const left = dashboardModel({ ...reply, excludedMachines: 2 }, facts, t)!;
    expect(left.verdict.context).toContain('Records to 11-Nov-2026');
    expect(left.verdict.context).toContain('2 machines not counted in production data');
    const headline = model.verdict.headline.map((part) => part.text).join('');
    expect(headline).toBe(
      'Fleet availability is 99.32%. 1,279 breakdowns have cost 3,060.1 hrs, and Axis motor / drive / encoder / servo costs the most.',
    );
    expect(markup).toContain('Fleet availability is');
  });

  it('prints no machine id and no money', () => {
    expect(strings.some((s) => UUID.test(s))).toBe(false);
    expect(JSON.stringify(model)).not.toMatch(/₹/);
  });

  it('is empty only when the reply holds no Dashboard figure', () => {
    expect(dashboardModel({ ...reply, figures: [] }, facts, t)).toBeNull();
  });
});
