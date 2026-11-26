import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DRILL_TYPES } from '@uptimo/shared/analytics';
import { FIGURES, FIGURE_KEYS } from '@uptimo/domain';
import '../../i18n/index.js';
import { SCREEN_LABELS } from '../analytics/groups.js';
import { cardModels } from './card-models.js';
import { CARDS, FIGURE_HOME, destinationOf, screenHref } from './destinations.js';
import { catalogue } from './figures/live.js';
import { realReply } from './figures/real-reply.js';
import { tilesIn } from './insight.js';

/** Each v2 screen folder and the engine screen its `LiveFrame` names: the scope its cards are looked up in. */
const SCOPE: Record<string, string> = {
  dashboard: 'dashboard',
  'action-center': 'action-center',
  age: 'a8-age',
  'bd-pm': 'a1-bd-pm',
  bottleneck: 'a9-bottleneck-forecast',
  'category-cell': 'a2-category-cell',
  'cell-change-log': 'cell-change-log',
  compare: 'compare',
  'data-checklist': 'data-checklist',
  energy: 'a5-energy',
  'fix-finder': 'fix-finder',
  footprint: 'a7-footprint',
  'forecast-lab': 'forecast-lab',
  machine: 'machine-page',
  'machines-register': 'registers',
  manpower: 'a4-manpower',
  'money-matters': 'money-matters',
  'monthly-report': 'monthly-report',
  'mttr-mtbf': 'a3-mttr-mtbf',
  oem: 'oem-analytics',
  'pm-calendar': 'pm-calendar',
  'problem-analysis': 'a10-problems',
  'shift-kpis': 'shift-kpis',
  'team-focus': 'team-focus',
};

/**
 * Cards that go nowhere, `<screen>/<card id>` with why. This list may only shrink: a new dead card fails here, and a
 * card that gains a destination must be crossed off (Nimish, 26 Nov 2026: every card is clickable; ADR 0060).
 */
const NO_DESTINATION: Record<string, string> = {};

type Card = { screen: string; kind: string; id: string; label: string; wired: boolean };

/** Every KPI card, figure tile and chart card a model draws; a chart has no id, so the map answers it by '' (default). */
function cardsIn(screen: string, model: unknown): Card[] {
  const tiles = tilesIn(model).map((tile) => {
    const own = tile as { drill?: unknown; link?: unknown };
    return {
      screen,
      kind: 'delta' in tile ? 'kpi' : 'figure',
      id: tile.id,
      label: tile.label,
      wired: Boolean(own.drill || own.link),
    };
  });
  const charts: Card[] = [];
  const seen = new Set<object>();
  const walk = (node: unknown) => {
    if (typeof node !== 'object' || node === null || seen.has(node)) return;
    seen.add(node);
    const o = node as {
      spec?: { kind?: unknown; title?: string };
      aria?: unknown;
      drill?: unknown;
    };
    if (o.spec && typeof o.spec.kind === 'string' && typeof o.aria === 'string') {
      charts.push({
        screen,
        kind: 'chart',
        id: '',
        label: o.spec.title ?? '',
        wired: Boolean(o.drill),
      });
      return;
    }
    Object.values(o).forEach(walk);
  };
  walk(model);
  return [...tiles, ...charts];
}

const t = catalogue;

async function everyCard(): Promise<Card[]> {
  const cards: Card[] = [];
  for (const [screen, build] of Object.entries(cardModels())) {
    const model = await build();
    expect(model, `${screen}: the model builds from its fixture`).not.toBeNull();
    cards.push(...cardsIn(screen, model));
  }
  return cards;
}

describe('every card goes somewhere (ADR 0060)', () => {
  it('knows every screen that draws a KPI card, a figure tile or a chart card', () => {
    const root = new URL('.', import.meta.url);
    const drawing = readdirSync(root, { withFileTypes: true })
      .filter((d) => d.isDirectory() && d.name !== 'printed-page')
      .filter((d) =>
        readdirSync(new URL(`${d.name}/`, root)).some(
          (f) =>
            f.endsWith('.tsx') &&
            /<(KpiCard|FigureTile|ChartCard|TileSet)\b|printed-page\/PageBody\.js/.test(
              readFileSync(new URL(`${d.name}/${f}`, root), 'utf8'),
            ),
        ),
      )
      .map((d) => d.name)
      .sort();
    expect(drawing).toEqual(Object.keys(cardModels()).sort());
    expect(Object.keys(SCOPE).sort()).toEqual(Object.keys(cardModels()).sort());
  });

  it('resolves every card to its rows or its page, but for the shrinking exception list', async () => {
    const cards = await everyCard();
    expect(cards.length).toBeGreaterThan(100);
    const dead = cards
      .filter(
        (c) =>
          !c.wired &&
          Object.keys(destinationOf(SCOPE[c.screen] ?? '', c.id, c.label, t)).length === 0,
      )
      .map((c) => `${c.screen}/${c.kind}:${c.id || c.label}`);
    expect([...new Set(dead)].sort()).toEqual(Object.keys(NO_DESTINATION).sort());
  });

  it('opens rows only for a figure the engine registers, whose drill type GET /analytics/drill answers, with rows in the frozen plant', () => {
    const reply = realReply();
    const rows = Object.values(CARDS).flatMap((ways) =>
      Object.values(ways).flatMap((way) => (way.rows ? [way.rows] : [])),
    );
    for (const key of rows) {
      expect(FIGURE_KEYS, key).toContain(key);
      const def = FIGURES.find((f) => f.key === key);
      expect(DRILL_TYPES, key).toContain(def?.drill);
      // A mixed figure can be honestly zero with no row behind it (registry.ts): the drawer then says nothing is counted.
      if (def?.mixed) continue;
      const figure = reply.figures.find((f) => f.key === key);
      expect(figure?.drill.ids.length ?? 0, `${key}: rows behind it`).toBeGreaterThan(0);
    }
  });

  it('gives every engine figure a page that explains it, at a real address', () => {
    expect(Object.keys(FIGURE_HOME).sort()).toEqual([...FIGURE_KEYS].sort());
    for (const [key, screen] of Object.entries(FIGURE_HOME)) {
      expect(SCREEN_LABELS, `${key} → ${screen}`).toHaveProperty(screen);
      expect(screenHref(screen), `${key} → ${screen}`).not.toBe('/analytics');
    }
    for (const ways of Object.values(CARDS))
      for (const way of Object.values(ways))
        if (way.home) expect(SCREEN_LABELS).toHaveProperty(way.home);
  });

  it('names the control in the reader’s words: the card, and whose rows or which page', () => {
    expect(destinationOf('a8-age', 'band-0', '0-5 yrs', t).drill).toEqual({
      figure: 'a8-age',
      label: expect.stringMatching(/^0-5 yrs: show the rows behind /),
    });
    expect(destinationOf('a10-problems', 'kpi-7', 'MTBF', t).link).toEqual({
      href: '/analytics/breakdowns?screen=a3-mttr-mtbf',
      label: expect.stringMatching(/^Open /),
    });
    // A Dashboard figure with no rows goes to its page; a home that is the page itself is no destination.
    expect(destinationOf('dashboard', 'dashboard.plant-events', 'x', t).link?.href).toBe(
      '/analytics/breakdowns?screen=breakdown-log',
    );
    expect(destinationOf('breakdown-log', 'dashboard.plant-events', 'x', t)).toEqual({});
  });
});
