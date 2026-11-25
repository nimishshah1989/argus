// @vitest-environment node
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { en } from '@uptimo/shared/i18n';
import { fill } from '../../../i18n/fill.js';
import '../../../i18n/index.js';
import { realReply } from '../figures/real-reply.js';
import type { Translate } from '../figures/read.js';
import { registersModel } from './adapter.js';
import { registerSheets } from './sweep.js';
import { RegistersView } from './View.js';

/** Sweep 706 batch A on the Machines register (ADR 0041): the register in view for Excel, the tiles as a tile set. */
const t: Translate = (key, values) =>
  fill((en as Record<string, string>)[key] ?? key, values ?? {});
const model = registersModel(realReply(), t)!;
const page = model.pages[0]!;

describe('registerSheets', () => {
  const sheets = () => registerSheets(page);

  it('gives one sheet per table of the register, by its title, header first', () => {
    expect(sheets().map((s) => s.name)).toEqual(page.tables.map((table) => table.title));
    page.tables.forEach((table, i) => {
      const kept = table.header.filter((h) => !h.fixed);
      expect(sheets()[i]!.rows[0]).toEqual(kept.map((h) => h.label));
      expect(sheets()[i]!.rows).toHaveLength(table.rows.length + 1);
    });
  });

  it('writes a number column as numbers and every other cell as printed', () => {
    page.tables.forEach((table, i) => {
      const cols = table.header.map((h, at) => ({ h, at })).filter(({ h }) => !h.fixed);
      table.rows.forEach((cells, r) => {
        const row = sheets()[i]!.rows[r + 1]!;
        cols.forEach(({ h, at }, c) => {
          const cell = cells[at];
          if (cell && h.numeric && typeof cell.sort === 'number' && Number.isFinite(cell.sort))
            expect(row[c]).toBe(cell.sort);
          else if (cell) expect(row[c]).toBe(cell.note ? `${cell.text} ${cell.note}` : cell.text);
        });
      });
    });
  });
});

describe('the page with the kit pieces', () => {
  const out = renderToStaticMarkup(
    createElement(
      MemoryRouter,
      { initialEntries: ['/analytics/machines'] },
      createElement(RegistersView, {
        model,
        nav: [{ id: 'm', label: 'Machines', icon: 'machines' as const, href: '/a', current: true }],
        title: 'Machines register',
      }),
    ),
  );

  it('draws the register’s figures as a tile set and offers the Excel', () => {
    expect(out).toContain('class="v2-tile-set"');
    expect(out).toContain('Download Excel');
  });
});
