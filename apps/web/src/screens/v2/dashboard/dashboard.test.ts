// @vitest-environment node
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import type { ActionCenterBoardReply } from '@uptimo/shared';
import { en } from '@uptimo/shared/i18n';
import type { FiguresReply } from '@uptimo/shared/analytics';
import { ENGINE_DATA } from '../../../../../../packages/domain/test/answer-key/fixture.js';
import '../../../i18n/index.js';
import type { Ticket } from '../../../api.js';
import { printed, realReply, UUID } from '../figures/real-reply.js';
import type { Translate } from '../figures/read.js';
import { dashboardModel } from './adapter.js';
import type { DashboardFacts, DashboardModel, PlantMachine } from './model.js';
import { DashboardView } from './View.js';

/** The catalogue as a screen asks for it: `{n}` gaps and i18next's `{{n}}` gaps both filled. */
const t: Translate = (key, values = {}) =>
  ((en as Record<string, string>)[key] ?? key).replace(/\{\{?(\w+)\}?\}/g, (whole, name: string) =>
    Object.hasOwn(values, name) ? String(values[name]) : whole,
  );

const real = realReply();
const machines: PlantMachine[] = ENGINE_DATA.machines.map((m) => ({
  id: m.id,
  code: m.code,
  category: m.category ?? null,
}));
const dashboardKeys = real.figures.filter((f) => f.screen === 'dashboard').map((f) => f.key);

let n = 0;
function ticket(over: Partial<Ticket>): Ticket {
  n += 1;
  return {
    id: `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
    ref: `BD-${n}`,
    kind: 'stopped',
    status: 'open',
    machineId: machines[0]!.id,
    problem: 'Spindle noise',
    reportedAt: '2026-11-10T08:00:00Z',
    machineRunningAt: null,
    machineStoppedAt: null,
    waitSince: null,
    handedOver: false,
    urgent: false,
    parentId: null,
    taskExpectedOn: null,
    figures: null,
    sla: null,
    location: null,
    ...over,
  } as unknown as Ticket;
}
const NOW = '2026-11-11T09:00:00.000Z';
const breached = (over: Partial<Ticket> = {}) =>
  ticket({ sla: { ack: { breached: true } } as unknown as Ticket['sla'], ...over });

const board = (high: number, med: number): ActionCenterBoardReply =>
  ({
    counts: { open: high + med },
    bySeverity: { high, med, low: 0, info: 0 },
  }) as ActionCenterBoardReply;

const facts = (over: Partial<DashboardFacts> = {}): DashboardFacts => ({
  reply: real,
  open: { tickets: [], now: NOW },
  board: null,
  machines,
  ...over,
});
const model = (over: Partial<DashboardFacts> = {}): DashboardModel =>
  dashboardModel(facts(over), t);
const cards = (m: DashboardModel) => m.sections.flatMap((s) => s.kpis);
const withoutLinks = (m: DashboardModel) =>
  JSON.parse(JSON.stringify(m, (key, value) => (key === 'href' ? undefined : value)));

describe('the Dashboard from the engine’s own reply', () => {
  it('prints every Dashboard figure the engine sent, the 20 of v1, none dropped and none invented', () => {
    const m = model();
    const shown = [
      ...cards(m).map((k) => k.id),
      ...(m.costliest ? ['dashboard.costliest-problems'] : []),
      ...m.charts.map((c) => c.id),
    ];
    expect(dashboardKeys).toHaveLength(20);
    expect([...shown].sort()).toEqual([...dashboardKeys].sort());
  });

  it('prints each number as the engine sent it, with its unit', () => {
    const k = (id: string) => cards(model()).find((card) => card.id === `dashboard.${id}`)!;
    expect(k('total-machines').value).toBe('159');
    expect(k('total-breakdowns').value).toBe('1,279');
    expect(k('total-downtime-hours').value).toBe('3,060.1 hrs');
    expect(k('fleet-availability').value).toBe('99.32%');
    expect(k('plant-events').value).toBe('0.0 hrs');
    expect(k('breakdown-free').value).toBe('53 of 125');
  });

  it('says what each figure covers, so one label never means two periods', () => {
    const k = (id: string) => cards(model()).find((card) => card.id === `dashboard.${id}`)!;
    for (const year of ['fleet-availability', 'plant-bd-pct', 'plant-events'])
      expect(k(year).meaning).toContain('Year to date');
    for (const log of [
      'total-breakdowns',
      'total-downtime-hours',
      'pm-hours',
      'avg-bd-hours-per-day',
    ])
      expect(k(log).meaning).toContain('All records to date');
    expect(k('cnc-machines').meaning).toContain('On the register today');
    expect(k('breakdown-free').meaning).toContain('Last 30 days');
  });

  it('opens the rows behind every figure and picture the engine named rows for', () => {
    const m = model();
    const named = real.figures.filter((f) => f.screen === 'dashboard' && f.drill.ids.length > 0);
    const drills = [
      ...cards(m).flatMap((k) => (k.drill ? [k.drill] : [])),
      ...(m.costliest?.drill ? [m.costliest.drill] : []),
      ...m.charts.flatMap((c) => ('drill' in c && c.drill ? [c.drill] : [])),
    ];
    expect(drills.map((d) => d.figure).sort()).toEqual(named.map((f) => f.key).sort());
    expect(drills.find((d) => d.figure === 'dashboard.total-downtime-hours')?.label).toBe(
      'Show the rows behind Total downtime',
    );
  });

  it('opens exactly the rows a count card counts: the card’s number is the number of rows behind it', () => {
    const counted = [
      'total-machines',
      'utilities',
      'dg-sets',
      'cnc-machines',
      'conventional-machines',
      'process-machines',
      'total-breakdowns',
    ];
    for (const name of counted) {
      const figure = real.figures.find((f) => f.key === `dashboard.${name}`)!;
      const card = cards(model()).find((k) => k.id === figure.key)!;
      expect(Number(card.value.replace(/,/g, '')), name).toBe(figure.drill.ids.length);
    }
    const free = real.figures.find((f) => f.key === 'dashboard.breakdown-free')!;
    expect(cards(model()).find((k) => k.id === free.key)!.value).toMatch(
      new RegExp(`^${free.drill.ids.length} of `),
    );
  });

  it('gives a figure that counted nothing no control, rather than one that opens an empty panel', () => {
    const events = cards(model()).find((k) => k.id === 'dashboard.plant-events')!;
    expect(events.drill).toBeUndefined();
  });

  it('shows no money to anyone: Today never did', () => {
    expect(printed(model({ board: board(2, 1) })).some((text) => text.includes('₹'))).toBe(false);
  });

  it('prints no database id, and a ticket is a link to the desk', () => {
    const open = [breached(), ticket({ status: 'waiting', waitSince: '2026-11-10T09:00:00Z' })];
    const m = model({ open: { tickets: open, now: NOW } });
    expect(printed(withoutLinks(m)).some((text) => UUID.test(text))).toBe(false);
    const hrefs = m.needs.state === 'ready' ? m.needs.table!.rows.map((row) => row[1]?.href) : [];
    expect(hrefs.sort()).toEqual(open.map((o) => `/desk/${o.id}`).sort());
  });

  it('keeps a figure the engine has not computed honest: no number, no drill, and it says so', () => {
    const held: FiguresReply = {
      ...real,
      figures: real.figures.map((f) =>
        f.key === 'dashboard.pm-hours' ? { ...f, status: 'not_computed', value: null } : f,
      ) as FiguresReply['figures'],
    };
    const pm = cards(model({ reply: held })).find((k) => k.id === 'dashboard.pm-hours')!;
    expect(pm.value).toBe('—');
    expect(pm.meaning).toBe('Not computed yet');
    expect(pm.drill).toBeUndefined();
  });

  it('prints a dash for a share that is null or missing, and the share with two places when it is there', () => {
    const shareOf = (share: unknown) => {
      const rows = [{ problem: 'Spindle', hours: 4, share, breakdowns: 2 }];
      const reply: FiguresReply = {
        ...real,
        figures: real.figures.map((f) =>
          f.key === 'dashboard.costliest-problems' ? { ...f, value: { rows, totalHours: 4 } } : f,
        ) as FiguresReply['figures'],
      };
      return model({ reply }).costliest!.table!.rows[0]![2]!.text;
    };
    expect(shareOf(null)).toBe('—');
    expect(shareOf(undefined)).toBe('—');
    expect(shareOf(19.2)).toBe('19.20%');
  });

  it('prints a dash, never 0.00%, for a problem share the engine did not send', () => {
    const rows = [{ problem: 'Spindle', hours: 4, share: null, breakdowns: 2 }];
    const reply: FiguresReply = {
      ...real,
      figures: real.figures.map((f) =>
        f.key === 'dashboard.costliest-problems' ? { ...f, value: { rows, totalHours: 4 } } : f,
      ) as FiguresReply['figures'],
    };
    const row = model({ reply }).costliest!.table!.rows[0]!;
    expect(row.map((cell) => cell.text)).toEqual(['Spindle', '4.0', '—', '2']);
  });
});

describe('the change against 30 days earlier', () => {
  const earlier = (changes: Record<string, number>): FiguresReply => ({
    ...real,
    figures: real.figures.map((f) =>
      f.key in changes ? { ...f, value: changes[f.key] } : f,
    ) as FiguresReply['figures'],
  });
  const k = (m: DashboardModel, id: string) =>
    cards(m).find((card) => card.id === `dashboard.${id}`)!;

  it('says a rate got better or worse in points, against a dated figure', () => {
    const m = model({ prior: earlier({ 'dashboard.fleet-availability': 99 }) });
    expect(k(m, 'fleet-availability').delta).toMatchObject({
      text: '+0.32 pts',
      up: true,
      good: true,
    });
    expect(k(m, 'fleet-availability').period).toBe('vs 12-Oct-2026');
    const worse = model({ prior: earlier({ 'dashboard.plant-bd-pct': 0.4 }) });
    expect(k(worse, 'plant-bd-pct').delta).toMatchObject({ up: true, good: false });
  });

  it('says what a running total gained, with no verdict, because it only ever rises', () => {
    const m = model({ prior: earlier({ 'dashboard.total-downtime-hours': 2960.1 }) });
    expect(k(m, 'total-downtime-hours').delta).toMatchObject({ text: '+100.0 hrs', flat: true });
    expect(k(m, 'total-downtime-hours').period).toBe('added in 30 days');
  });

  it('claims no change when the earlier figures could not be read, and none for a count of machines', () => {
    const m = model();
    expect(k(m, 'fleet-availability').delta.text).toBe('');
    expect(k(model({ prior: earlier({}) }), 'cnc-machines').delta.text).toBe('');
  });
});

describe('what needs you now', () => {
  const rows = (m: DashboardModel) =>
    m.needs.state === 'ready' ? (m.needs.table?.rows ?? []) : [];

  it('lists a breached clock, a paused breakdown and an overdue task, oldest first, each linking to its ticket', () => {
    const clock = breached({ reportedAt: '2026-11-09T08:00:00Z' });
    const paused = ticket({ status: 'waiting', waitSince: '2026-11-10T09:00:00Z' });
    const overdue = ticket({
      kind: 'general',
      parentId: 'p',
      taskExpectedOn: '2026-11-09',
      reportedAt: '2026-11-10T11:00:00Z',
    });
    const quiet = ticket({ status: 'open' });
    const m = model({ open: { tickets: [quiet, paused, overdue, clock], now: NOW } });
    expect(rows(m).map((row) => row[1]?.sort)).toEqual([clock.ref, paused.ref, overdue.ref]);
    expect(rows(m)[0]![1]).toMatchObject({ text: `Open ${clock.ref}`, href: `/desk/${clock.id}` });
    expect(rows(m)[0]![0]?.chip).toMatchObject({ kind: 'machine', id: machines[0]!.code });
    expect(rows(m)[0]![5]?.text).toBe('Acknowledge clock breached');
    expect(m.needs).toMatchObject({ counts: '3 open · 1 clocks breached' });
    expect(m.verdict.headline[0]?.text).toBe('Open items that need you now: 3.');
  });

  it('says plainly when nothing needs a person, and when it could not be read', () => {
    const none = model();
    expect(none.needs).toMatchObject({
      state: 'ready',
      empty: 'Nothing needs you now.',
      table: null,
    });
    expect(none.verdict.headline[0]?.text).toBe('Nothing needs you now.');
    const lost = model({ open: null });
    expect(lost.needs).toMatchObject({ state: 'unavailable' });
    expect(lost.verdict.headline[0]?.text).toBe('What needs you now could not be loaded.');
  });

  it('names a place for a ticket that is on no machine of the list, never an id', () => {
    const where = breached({ machineId: null, location: 'Workshop 5s' });
    const first = rows(model({ open: { tickets: [where], now: NOW } }))[0]!;
    expect(first[0]).toMatchObject({ text: 'Workshop 5s' });
    expect(first[0]?.chip).toBeUndefined();
  });

  it('carries the Action Center banner’s counts and way in, and nothing when no nudge is open', () => {
    expect(model({ board: board(2, 1) }).actionCenter).toMatchObject({
      text: '2 high-priority and 1 medium nudges need attention',
      href: '/analytics/today/action-center',
    });
    expect(model({ board: board(0, 0) }).actionCenter).toBeNull();
    expect(model().actionCenter).toBeNull();
  });
});

describe('what the engine already knows and the page now says', () => {
  it('lists the problems that cost the most with their hours, share and breakdowns, and the engine’s total', () => {
    const c = model().costliest!;
    expect(c.table!.header.map((h) => h.label)).toEqual([
      'Problem',
      'BD hours',
      '% of BD',
      'Breakdowns',
    ]);
    expect(c.table!.rows[0]!.map((cell) => cell.text)).toEqual([
      'Axis motor / drive / encoder / servo',
      '485.0',
      '15.85%',
      '104',
    ]);
    expect(c.sub).toContain('Total downtime:');
  });

  it('puts every machine of the bubble chart in a table, the worst first, each a chip', () => {
    const table = model().machines!;
    const hours = table.rows.map((row) => Number(row[3]?.sort));
    expect(hours).toEqual([...hours].sort((a, b) => b - a));
    expect(table.rows.length).toBe(117);
    expect(table.rows[0]![0]?.chip).toMatchObject({ kind: 'machine' });
  });

  it('draws the two pictures with a sentence for those who cannot see them', () => {
    const charts = model().charts;
    const drawn = charts.flatMap((c) => ('spec' in c ? [c] : []));
    expect(drawn.map((c) => c.spec.kind)).toEqual(['scatter', 'mixed']);
    expect(drawn.every((c) => c.aria.length > 20 && c.sub.length > 10)).toBe(true);
  });

  it('names the machines the engine’s own trend test calls worse, the steepest first, and says how many there are', () => {
    const w = model().warning!;
    expect(w.headline[0]?.text).toBe('26 machines are failing faster than before:');
    const named = w.headline.filter((seg) => seg.entity);
    expect(named).toHaveLength(8);
    for (const seg of named) expect(seg.entity?.kind).toBe('machine');
  });

  it('says nothing about trends when the engine has not computed them', () => {
    const reply: FiguresReply = {
      ...real,
      figures: real.figures.filter((f) => f.key !== 'reliability') as FiguresReply['figures'],
    };
    expect(model({ reply }).warning).toBeNull();
  });
});

describe('the page', () => {
  const render = (m: DashboardModel) =>
    renderToStaticMarkup(
      createElement(
        MemoryRouter,
        { initialEntries: ['/analytics/today'] },
        createElement(DashboardView, {
          model: m,
          nav: [{ id: 'today', label: 'Today', icon: 'today' as const, href: '/a', current: true }],
          title: 'Dashboard',
        }),
      ),
    );
  const text = (markup: string) => markup.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

  it('opens on the answer, then what needs you, then the figures in three groups, then the problems and the pictures', () => {
    const out = render(model({ open: { tickets: [breached()], now: NOW }, board: board(1, 0) }));
    const headings = [...out.matchAll(/<h2[^>]*>(.*?)<\/h2>/g)].map((h) => text(h[1]!).trim());
    expect(headings.slice(0, 7)).toEqual([
      'What needs you now',
      'Action Center',
      'How the plant is running',
      'Where the time goes',
      'The fleet',
      'Problems costing the most downtime',
      'Failing faster than before',
    ]);
    expect(text(out)).toContain('Open items that need you now: 1.');
    expect(out).toContain('Records to 11-Nov-2026');
    expect(out.match(/class="v2-card v2-kpi"/g)).toHaveLength(17);
  });

  it('shows ten rows of a longer table with the way to the rest', () => {
    const many = Array.from({ length: 12 }, () => breached());
    const out = render(model({ open: { tickets: many, now: NOW } }));
    expect(text(out)).toContain('1–10 of 12');
  });
});

/**
 * The answer key's machines have an id equal to their code; the server's have a database id. Re-key the engine's own
 * reply the way the server sends it: the bubble points and the trend test carry the id, never the code.
 */
const ID = (code: string) =>
  `00000000-0000-4000-8000-${String(machines.findIndex((m) => m.code === code)).padStart(12, '0')}`;
const keyed = machines.map((m) => ({ ...m, id: ID(m.code) }));
const asServed: FiguresReply = {
  ...real,
  figures: real.figures.map((f) => {
    const v = f.value as Record<string, unknown> | null;
    if (f.key === 'dashboard.bubble-chart' && v) {
      const sets = v.datasets as { data: { id: string }[] }[];
      return {
        ...f,
        value: {
          ...v,
          datasets: sets.map((d) => ({ ...d, data: d.data.map((p) => ({ ...p, id: ID(p.id) })) })),
        },
        drill: { ...f.drill, ids: f.drill.ids.map(ID) },
      };
    }
    if (f.key === 'reliability' && v) {
      const by = v.machines as Record<string, unknown>;
      return {
        ...f,
        value: {
          ...v,
          machines: Object.fromEntries(Object.entries(by).map(([k, x]) => [ID(k), x])),
        },
      };
    }
    return f;
  }) as FiguresReply['figures'],
};

describe('with the ids the server sends, a database id never reaches the screen', () => {
  const served = (extra: Partial<DashboardFacts> = {}) =>
    model({ reply: asServed, machines: keyed, ...extra });

  it('prints each machine by its code in the machines table, with its type colour, and in the chart’s points', () => {
    const m = served();
    expect(m.machines!.rows.length).toBe(117);
    for (const row of m.machines!.rows) {
      expect(row[0]?.text).toBe(row[0]?.chip?.id);
      expect(row[0]?.text).not.toMatch(UUID);
    }
    expect(m.machines!.rows.some((row) => row[0]?.chip?.cat !== undefined)).toBe(true);
    expect(printed(withoutLinks(m)).some((text) => UUID.test(text))).toBe(false);
  });

  it('names a machine the plant no longer lists with a dash, never its id', () => {
    const m = served({ machines: keyed.slice(5) });
    expect(printed(withoutLinks(m)).some((text) => UUID.test(text))).toBe(false);
    expect(m.machines!.rows.some((row) => row[0]?.text === '—' && row[0]?.chip === undefined)).toBe(
      true,
    );
  });

  it('names the machines failing faster, and a ticket’s machine, by code', () => {
    const open = { tickets: [breached({ machineId: ID(machines[0]!.code) })], now: NOW };
    const m = served({ open });
    expect(m.warning!.headline.filter((s) => s.entity).every((s) => !UUID.test(s.entity!.id))).toBe(
      true,
    );
    expect(m.needs.state === 'ready' && m.needs.table!.rows[0]![0]?.chip?.id).toBe(
      machines[0]!.code,
    );
  });
});

describe('a held or empty figure keeps its place and says why', () => {
  const swap = (
    changes: Record<string, Partial<FiguresReply['figures'][number]>>,
  ): FiguresReply => ({
    ...real,
    figures: real.figures.map((f) =>
      f.key in changes ? { ...f, ...changes[f.key] } : f,
    ) as FiguresReply['figures'],
  });
  const keys = [
    'dashboard.bubble-chart',
    'dashboard.expansion-timeline',
    'dashboard.costliest-problems',
  ];

  it('keeps both pictures and the problems card for a plant with no history, each with a dash', () => {
    const reply = swap(
      Object.fromEntries(
        keys.map((k) => [k, { value: null, drill: { type: 'machine', ids: [] } }]),
      ),
    );
    const m = model({ reply });
    expect(m.charts.map((c) => [c.id, 'note' in c && c.note])).toEqual([
      ['dashboard.bubble-chart', '—'],
      ['dashboard.expansion-timeline', '—'],
    ]);
    expect(m.costliest).toMatchObject({ table: null, empty: '—' });
    expect(m.machines).toBeNull();
  });

  it('says "Not computed yet" for a held picture and a held problems card, never "No problems to rank yet"', () => {
    const reply = swap(
      Object.fromEntries(keys.map((k) => [k, { status: 'not_computed', value: null }])),
    );
    const m = model({ reply });
    expect(m.charts.map((c) => 'note' in c && c.note)).toEqual([
      'Not computed yet',
      'Not computed yet',
    ]);
    expect(m.costliest).toMatchObject({ table: null, empty: 'Not computed yet' });
    expect(m.costliest?.drill).toBeUndefined();
  });

  it('says there is nothing to rank only when the engine computed an empty list', () => {
    const reply = swap({ 'dashboard.costliest-problems': { value: { rows: [], totalHours: 0 } } });
    expect(model({ reply }).costliest).toMatchObject({
      table: null,
      empty: 'No problems to rank yet.',
    });
  });
});

describe('the costliest problems’ change over 30 days', () => {
  it('says what their hours gained, a quiet amount with no verdict, as v1 did under the table', () => {
    const prior: FiguresReply = {
      ...real,
      figures: real.figures.map((f) =>
        f.key === 'dashboard.costliest-problems'
          ? { ...f, value: { ...(f.value as object), totalHours: 2960.1 } }
          : f,
      ) as FiguresReply['figures'],
    };
    expect(model({ prior }).costliest!.sub).toBe(
      'Total downtime: 3,060.1 hours · +100.0 hrs added in 30 days',
    );
    expect(model().costliest!.sub).toBe('Total downtime: 3,060.1 hours');
  });
});
