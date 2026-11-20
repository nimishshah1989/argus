// @vitest-environment node
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import '../../../i18n/index.js';
import { dashboardFixture } from '../dashboard/fixture.js';
import { entityFixture } from '../entity/fixture.js';
import { machineFixture } from './fixture.js';
import { rawMachine } from './fixture-rows.js';
import type { MachinePageModel } from './model.js';
import { MachineView } from './View.js';

const machines = dashboardFixture.cells.flatMap((c) => c.machines);
const byState = (state: string) => machines.find((m) => m.state === state)!;
const get = (code: string): MachinePageModel => machineFixture(code)!;
const nav = [
  { id: 'machines', label: 'Machines', icon: 'machines' as const, href: '/a', current: true },
];
const text = (markup: string) =>
  markup
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
const plain = (s: string) => s.replace(/\u00a0/g, ' ');
const render = (m: MachinePageModel) =>
  renderToStaticMarkup(
    createElement(
      MemoryRouter,
      { initialEntries: ['/gallery?view=v2-machine'] },
      createElement(MachineView, { model: m, nav, title: m.machine.name }),
    ),
  );
const tenths = (rows: { days: number; tenths: number }[], lo: number, hi: number) =>
  rows.filter((r) => r.days >= lo && r.days <= hi).reduce((s, r) => s + r.tenths, 0);

describe('every machine of the plant has a page whose figures add up', () => {
  it('prints this month’s hours exactly as the plant map and the drawer do, and the 90-day count as their stops', () => {
    for (const m of machines) {
      const page = get(m.code);
      const hours = page.kpis.find((k) => k.id === 'hours')!;
      const stops = page.kpis.find((k) => k.id === 'stops')!;
      expect(plain(hours.value), m.code).toBe(plain(m.hours.shown));
      expect(stops.value, m.code).toBe(String(m.stops));
      expect(page.machine, m.code).toBe(m);
    }
  });

  it('adds up its history: the month’s rows are the month’s hours, the weeks are the rows, the table is 12 months', () => {
    for (const m of machines) {
      const page = get(m.code);
      const raw = rawMachine(m).breakdowns;
      expect(tenths(raw, 0, 19) / 10, m.code).toBeCloseTo(m.hours.value, 5);
      const weekly = page.trend.series[0]!.values.reduce<number>((s, v) => s + (v ?? 0), 0);
      expect(weekly, m.code).toBeCloseTo(tenths(raw, 0, 83) / 10, 5);
      expect(page.trend.categories, m.code).toHaveLength(12);
      expect(page.history, m.code).toHaveLength(raw.length);
      expect(
        page.history.every((r) => r.days <= 364 && r.hours.value > 0),
        m.code,
      ).toBe(true);
      const shown = page.history.reduce((s, r) => s + r.hours.value, 0);
      expect(shown, m.code).toBeCloseTo(tenths(raw, 0, 364) / 10, 5);
    }
  });

  it('keeps the history newest first, with every person a chip the drawer can open', () => {
    for (const m of machines.filter((x) => x.stops > 0)) {
      const days = get(m.code).history.map((r) => r.days);
      expect(days, m.code).toEqual([...days].sort((a, b) => a - b));
    }
    for (const row of get('VC-67').history) {
      expect(row.who.kind).toBe('person');
      expect(entityFixture(row.who)?.label).toBe(row.who.label);
    }
  });

  it('says what its state claims: a running machine has no breakdown in 30 days, a risky one has three', () => {
    for (const m of machines) {
      const last30 = get(m.code).history.filter((r) => r.days <= 29).length;
      if (m.state === 'run') expect(last30, m.code).toBe(0);
      if (m.state === 'risk') expect(last30, m.code).toBe(3);
    }
  });

  it('shows a machine that is down with its open breakdown, 2 h 40 min so far, and a tagged row for it', () => {
    const page = get(byState('down').code);
    const open = page.history.filter((r) => r.flags.open);
    expect(open).toHaveLength(1);
    expect(open[0]!.days).toBe(0);
    expect(plain(open[0]!.hours.shown)).toBe('2.7 h');
    expect(open[0]!.tags.map((t) => t.text)).toContain('Open');
    expect(text(page.verdict.headline.map((s) => s.text).join(''))).toContain('2 h 40 min');
  });

  it('counts the parts it names out of stock in the spares tag', () => {
    for (const m of machines) {
      const page = get(m.code);
      const none = page.spares.parts.filter((p) =>
        p.some((s) => s.text === 'none in stock'),
      ).length;
      const tag = page.spares.tag.text;
      expect(tag, m.code).toBe(none ? `${none} out of stock` : 'All in stock');
    }
  });
});

describe('the Machine page as a reader sees it', () => {
  const page = get('VC-67');
  const out = render(page);

  it('answers first: the state, four key figures and what to do next, before the detail', () => {
    expect(text(out)).toContain('This machine is down');
    expect(out.match(/class="v2-card v2-kpi"/g)).toHaveLength(4);
    const heads = [...out.matchAll(/<h2[^>]*>(.*?)<\/h2>/g)].map((m) => text(m[1]!));
    expect(heads).toEqual([
      'What to do next',
      'Breakdown hours a week',
      'Planned maintenance',
      'Spares',
      'Breakdown history',
    ]);
  });

  it('shows ten breakdowns a page with a pager over all of them, and a chip for the machine, its cell and a person', () => {
    expect(page.history.length).toBeGreaterThan(10);
    expect(text(out)).toContain(`1–10 of ${page.history.length}`);
    expect(out.match(/<tbody[^>]*>(.*?)<\/tbody>/s)![1]!.match(/<tr/g)).toHaveLength(10);
    expect(out).toContain('aria-label="Search breakdowns"');
    expect(out).toContain('Neel S');
    expect(out).toContain('Cell 5');
  });

  it('ends the problem in its action, and says there is nothing to do when there is none', () => {
    expect(text(out)).toMatch(/Order the part|Reserve the part/);
    const quiet = machines.find(
      (m) => m.state === 'run' && get(m.code).pm.tag.text === 'On schedule',
    );
    const calm = render(get(quiet!.code));
    expect(text(calm)).toContain('Nothing to do');
    expect(calm).not.toContain('v2-btn-primary');
  });

  it('says a PM is overdue in the answer when it is, and keeps it out when it is not', () => {
    const late = machines.filter((m) => get(m.code).pm.tag.text === 'Overdue');
    expect(late.length).toBeGreaterThan(0);
    for (const m of late) expect(text(render(get(m.code)))).toMatch(/Its PM is \d+ days overdue/);
    expect(text(render(get(byState('pm').code)))).not.toMatch(/days overdue/);
  });

  it('has nothing for a machine the plant does not have', () => {
    expect(machineFixture('XX-999')).toBeNull();
    expect(machineFixture('')).toBeNull();
  });
});
