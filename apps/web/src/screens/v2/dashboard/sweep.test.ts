// @vitest-environment node
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import type { ActionCenterBoardReply } from '@uptimo/shared';
import { en } from '@uptimo/shared/i18n';
import { ENGINE_DATA } from '../../../../../../packages/domain/test/answer-key/fixture.js';
import '../../../i18n/index.js';
import { focusActions } from '../../analytics/team-focus-actions.js';
import type { Translate } from '../figures/read.js';
import { realReply } from '../figures/real-reply.js';
import { dashboardModel } from './adapter.js';
import type { DashboardModel, PlantMachine } from './model.js';
import { costliestRows, dashboardStrips } from './sweep.js';
import { DashboardView } from './View.js';

/** Sweep 706 batch A on the Dashboard (ADR 0041, 0043): tiles, strips and ranked bars; the bubble stays. */
const t: Translate = (key, values = {}) =>
  ((en as Record<string, string>)[key] ?? key).replace(/\{\{?(\w+)\}?\}/g, (whole, name: string) =>
    Object.hasOwn(values, name) ? String(values[name]) : whole,
  );

const real = realReply();
const machines: PlantMachine[] = ENGINE_DATA.machines.map((m) => ({
  id: m.id,
  code: m.code,
  category: m.category ?? null,
  cell: m.cell ?? null,
}));
const board = (high: number, med: number): ActionCenterBoardReply =>
  ({
    counts: { open: high + med },
    bySeverity: { high, med, low: 0, info: 0 },
  }) as ActionCenterBoardReply;
const model = (b: ActionCenterBoardReply | null = null): DashboardModel =>
  dashboardModel(
    { reply: real, open: { tickets: [], now: '2026-11-11T09:00:00.000Z' }, board: b, machines },
    t,
  );
describe('dashboardStrips', () => {
  const open = focusActions(real.figures.find((f) => f.key === 'team-focus')!.value).filter(
    (a) => a.status === 'open' || a.status === 'prog',
  ).length;

  it('counts high and medium nudges and the open Team Focus actions, each with its way in', () => {
    expect(dashboardStrips(board(2, 3), real, t)).toEqual([
      {
        key: 'ac-high',
        count: 2,
        what: 'high-priority decisions need attention',
        link: 'Open Action Center',
        href: '/analytics/today/action-center',
        severity: 'high',
      },
      {
        key: 'ac-medium',
        count: 3,
        what: 'decisions to watch',
        link: 'Open Action Center',
        href: '/analytics/today/action-center',
        severity: 'medium',
      },
      {
        key: 'tf',
        count: open,
        what: open === 1 ? 'Team Focus action open' : 'Team Focus actions open',
        link: 'Open Team Focus',
        href: '/analytics/today?screen=team-focus',
        severity: 'low',
      },
    ]);
  });

  it('is carried on the model, so the page draws it', () => {
    expect((model(board(1, 0)) as DashboardModel & { strips: unknown }).strips).toEqual(
      dashboardStrips(board(1, 0), real, t),
    );
  });
});

describe('costliestRows', () => {
  it('ranks each problem by its engine hours, printed as the engine printed them', () => {
    const c = model().costliest!;
    const rows = costliestRows(c, t);
    expect(rows).toHaveLength(c.table!.rows.length);
    c.table!.rows.forEach((cells, i) => {
      expect(rows[i]).toEqual({
        key: String(i),
        label: cells[0]!.text,
        value: cells[1]!.sort,
        valueText: cells[1]!.text,
        countText: `Breakdowns: ${cells[3]!.text}`,
      });
    });
  });
});

describe('the page with the kit pieces', () => {
  const out = renderToStaticMarkup(
    createElement(
      MemoryRouter,
      { initialEntries: ['/analytics/today'] },
      createElement(DashboardView, {
        model: model(board(2, 1)),
        nav: [{ id: 'today', label: 'Today', icon: 'today' as const, href: '/a', current: true }],
        title: 'Dashboard',
      }),
    ),
  );

  it('draws action strips, not banners', () => {
    expect(out).toContain('class="v2-strips"');
    expect(out).not.toContain('v2-banner');
  });

  it('draws the tiles as three tile sets, the later two under one Show detail, all 17 cards kept', () => {
    expect(out.match(/class="v2-tile-set"/g)).toHaveLength(3);
    expect(out.match(/class="v2-card v2-kpi[ "]/g)).toHaveLength(17);
    expect(out).toContain('<details class="v2-show-detail">');
  });

  it('draws the costliest problems as ranked bars', () => {
    expect(out).toContain('class="v2-ranked"');
  });
});
