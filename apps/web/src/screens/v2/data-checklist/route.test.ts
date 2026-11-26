// @vitest-environment node
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FiguresReply } from '@uptimo/shared/analytics';
import '../../../i18n/index.js';
import { DataChecklistPage } from '../analytics-routes.js';
import { stateOfError, type Provider } from '../data.js';
import { realReply } from '../figures/real-reply.js';
import { liveScreen } from '../live.js';
import { dataChecklistFixture } from './fixture.js';
import { fixTarget, LOG_PATH, REGISTER_PATH } from './live.js';
import type { DataChecklistModel } from './model.js';
import { screen } from './register.js';
import { DataChecklistView } from './View.js';

/** DC-2 (ticket 578, ADR 0019): the v2 Data Checklist is the page at /analytics/today/checklist, on the live figures. */
const live = vi.hoisted(() => ({ reply: undefined as unknown }));
vi.mock('../figures/live.js', async (actual) => ({
  ...(await actual<typeof import('../figures/live.js')>()),
  liveReply: async () => live.reply,
}));

const KEY = 'data-checklist';
const withFigure = (change: (figure: FiguresReply['figures'][number]) => object): FiguresReply => {
  const reply = realReply();
  return {
    ...reply,
    figures: reply.figures.map((figure) => (figure.key === KEY ? change(figure) : figure)),
  } as FiguresReply;
};
const provider = screen.provider as Provider<'data-checklist'>;
const run = () => provider({}, { client: undefined });
const failureOf = () =>
  run().then(
    () => null,
    (error: unknown) => error,
  );

beforeEach(() => {
  live.reply = realReply();
});

describe('the Data Checklist provider (DC-2)', () => {
  it('builds the checklist from the live figures, one record per engine item, not from the fixture', async () => {
    const figure = realReply().figures.find((f) => f.key === KEY)!;
    const items = (figure.value as { items: unknown[] }).items;
    const model = (await run())!;
    expect(model).not.toBe(dataChecklistFixture);
    expect(model.records).toHaveLength(items.length);
    expect(model.source).toContain('11-Nov-2026');
  });

  it('carries v1’s "See the rows" as the page’s own control, for the tickets the engine named, never on a card', async () => {
    const model = (await run())!;
    expect(model.drill).toEqual({
      figure: KEY,
      label: 'Show the rows behind Data checklist',
    });
    expect(model.kpis.every((kpi) => kpi.drill === undefined)).toBe(true);
  });

  it('says "Not computed yet" for a figure the engine did not compute', async () => {
    live.reply = withFigure((figure) => ({ ...figure, status: 'not_computed' }));
    expect(stateOfError(await failureOf())).toBe('notComputed');
  });

  it('leaves the gallery on the approved fixture, never the server', async () => {
    live.reply = undefined;
    expect(await screen.frozen!({}, {})).toBe(dataChecklistFixture);
  });
});

describe('the Data Checklist route (DC-2)', () => {
  it('serves the v2 screen at Today’s checklist, keyed by its group and screen', () => {
    expect(liveScreen('today', KEY)?.key).toBe('today:data-checklist');
    expect((DataChecklistPage() as ReactElement).key).toBe('today:data-checklist');
  });

  it('has deleted the v1 page and its view helpers', () => {
    const v1 = import.meta.glob('../../analytics/{DataChecklist.tsx,checklist-view.ts}');
    expect(Object.keys(v1)).toEqual([]);
  });
});

const nav = [{ id: 'today', label: 'Today', icon: 'today' as const, href: '/a', current: true }];
const render = (model: DataChecklistModel) =>
  renderToStaticMarkup(
    createElement(
      MemoryRouter,
      { initialEntries: ['/analytics/today/checklist'] },
      createElement(DataChecklistView, { model, nav, title: 'Data checklist' }),
    ),
  );

describe('the Data Checklist view with a drill (DC-2)', () => {
  const drill = { figure: KEY, label: 'Show the rows behind Data checklist' };

  it('draws the page control under the verdict, before the key figures, only when the model has one', () => {
    const drawn = render({ ...dataChecklistFixture, drill });
    expect(drawn).toContain('class="v2-drill-action"');
    expect(drawn).toContain(drill.label);
    expect(drawn.indexOf('v2-drill-action')).toBeLessThan(drawn.indexOf('class="v2-card v2-kpi"'));
    expect(render(dataChecklistFixture)).not.toContain('v2-drill-action');
  });

  it('changes nothing else on the approved screen', () => {
    const drawn = render({ ...dataChecklistFixture, drill });
    const without = drawn.replace(/<p class="v2-drill-action">.*?<\/p>/, '');
    expect(without).toBe(render(dataChecklistFixture));
  });
});

describe('a check’s fix button on the live screen (DC-2, ADR 0017 (e))', () => {
  const drill = { figure: KEY, label: 'Show the rows behind Data checklist' };

  it('opens the tickets behind a breakdown or Why-Why gap, the register for a machine record, the log for a gap in days', () => {
    for (const id of ['bd_hrs', 'bd_obs', 'ww'])
      expect(fixTarget(id, drill), id).toEqual({ drill });
    for (const id of ['mc_age', 'mc_loc'])
      expect(fixTarget(id, drill), id).toEqual({ to: REGISTER_PATH });
    expect(fixTarget('log_gap', drill)).toEqual({ to: LOG_PATH });
    expect(fixTarget('bd_hrs', undefined)).toEqual({ to: LOG_PATH });
  });
});

describe('a record with no machine on the live screen (ADR 0017 "Records")', () => {
  it('prints a log gap’s dates or an unregistered machine’s dash as text, never a chip that opens an empty drawer', () => {
    const labels = ['01-Nov-2026 to 05-Nov-2026', '—'];
    const records = dataChecklistFixture.records.map((record, at) => ({
      ...record,
      entity: { kind: 'decision' as const, id: `log_gap|${at}`, label: labels[at % 2]! },
    }));
    const drawn = render({ ...dataChecklistFixture, records });
    expect(drawn).not.toContain('data-kind="decision"');
    expect(drawn).toContain(labels[0]);
  });
});
