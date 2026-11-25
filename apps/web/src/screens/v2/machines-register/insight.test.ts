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
import { registersModel } from './adapter.js';
import { RegistersView } from './View.js';

/**
 * Ticket 655 (ADR 0035): every table on every register page opens with a kit line (machines per split or category;
 * the oldest machine on a list), and every card names a yardstick (share of all machines or of the KVA load, rank of
 * the average age). Critical tests only (ADR 0034): figures, not wording or tone. Frozen 11 Nov.
 */
const t: Translate = (key, values) =>
  fill((en as Record<string, string>)[key] ?? key, values ?? {});
const model = registersModel(realReply(), t)!;

/** Each section, keyed `<page>-<table>`, and the figures its line must carry ([] = a line, no figure to check). */
const SECTIONS: Record<string, string[]> = {
  'machines-controllers': ['Fanuc', '6.3', '77'],
  'machines-makes': ['2', '18', '56%'],
  'machines-table-0': ['2', '15', '71%'],
  'machines-list': ['TC-3', '4.8', '25y'],
  'conv-table-0': ['Bandsaw', '3.2'],
  'conv-list': ['DRILL-2', '2.3', '21y'],
  'proc-table-0': ['3', '9', '53%'],
  'proc-list': ['MARK-01', '3.3', '18y'],
  'util-table-0': ['Stabilizer', '2.0', '10'],
  'util-list': ['COMP.-01', '3.3', '15y'],
  'dg-list': [],
  'robots-list': [],
};

/** Card id → the figures its yardstick must carry. */
const YARDSTICKS: Record<string, string[]> = {
  'machines-0': ['65%', '193'],
  'conv-0': ['8%', '193'],
  'proc-0': ['9%', '193'],
  'util-0': ['16%', '193'],
  'dg-0': ['2%', '193'],
  'robots-0': ['1%', '193'],
  'machines-2': ['3', '5'],
  'conv-2': ['1', '5'],
  'proc-2': ['2', '5'],
  'util-2': ['4', '5'],
  'dg-3': ['5', '5'],
  'machines-1': ['92%', '3,058.5'],
  'conv-1': ['2%', '3,058.5'],
  'util-1': ['6%', '3,058.5'],
  'dg-1': ['19%', '3,058.5'],
  'dg-2': ['56%', '570'],
};

const cards = model.pages.flatMap((page) => page.kpis);

describe('Machines register insight (ticket 655)', () => {
  it('gives every table on every page a takeaway, whatever page is open', () => {
    expect(Object.keys(model.takeaways ?? {}).sort()).toEqual(Object.keys(SECTIONS).sort());
    for (const id of Object.keys(SECTIONS))
      expect(model.takeaways?.[id]?.text.length, id).toBeGreaterThan(0);
  });

  it('says where the machines sit and which machine is oldest, from the whole table', () => {
    for (const [id, figures] of Object.entries(SECTIONS))
      for (const figure of figures) expect(model.takeaways?.[id]?.text ?? '', id).toContain(figure);
  });

  it('gives every card a yardstick with the figure it is measured against', () => {
    expect(tilesIn(model).filter((tile) => !hasYardstick(tile))).toEqual([]);
    for (const [id, figures] of Object.entries(YARDSTICKS)) {
      const card = cards.find((kpi) => kpi.id === id);
      for (const figure of figures) expect(card?.yardstick ?? '', id).toContain(figure);
    }
  });

  it('never invents a comparison for a card with no figure or no peer in its unit', () => {
    for (const id of ['proc-1', 'robots-1', 'robots-2']) {
      const card = cards.find((kpi) => kpi.id === id);
      expect(card?.yardstick ?? '', id).not.toMatch(/\d/);
    }
  });

  it('draws the open page with its takeaways', () => {
    const nav = [
      { id: 'm', label: 'Machines', icon: 'machines' as const, href: '/a', current: true },
    ];
    const html = renderToStaticMarkup(
      createElement(MemoryRouter, {}, createElement(RegistersView, { model, nav, title: 'R' })),
    );
    for (const id of [
      'machines-controllers',
      'machines-makes',
      'machines-table-0',
      'machines-list',
    ])
      expect(html, id).toContain(model.takeaways?.[id]?.text ?? `no takeaway for ${id}`);
    expect(html).toContain(cards[0]?.yardstick ?? 'no yardstick on the first card');
  });
});
