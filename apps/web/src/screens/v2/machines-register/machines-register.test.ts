// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { en } from '@uptimo/shared/i18n';
import { fill } from '../../../i18n/fill.js';
import { registerPages } from '../../analytics/machine-values.js';
import { printed, realReply, UUID } from '../figures/real-reply.js';
import type { Translate } from '../figures/read.js';
import { registersModel } from './adapter.js';

const t: Translate = (key, values) =>
  fill((en as Record<string, string>)[key] ?? key, values ?? {});
const reply = realReply();
const model = registersModel(reply, t)!;
const engine = registerPages(reply.figures.find((f) => f.key === 'registers')?.value);

describe('the Machines register, from the engine’s own reply', () => {
  it('has a page for every register the engine sent, CNC first', () => {
    expect(model.pages.map((page) => page.id)).toEqual(engine.map((page) => page.id));
    expect(model.pages[0]?.label).toBe('CNC');
  });

  it('prints every figure of the reply: each card, each split, each cell of each list', () => {
    const shown = new Set(printed(model));
    for (const page of engine) {
      for (const kpi of page.kpis) {
        expect(shown, kpi.label).toContain(kpi.label);
        expect(shown, `${kpi.label} value`).toContain(kpi.value);
      }
      for (const table of page.tables) {
        const kept = table.header
          .map((h, i) => ({ h, i }))
          .filter(({ h }) => h !== '' && h !== '#');
        for (const row of table.rows)
          for (const { i } of kept) {
            const cell = row[i] ?? '';
            const code = cell.replace(' NOT IN PRODUCTION DATA', '');
            expect(shown, `${table.title ?? 'list'}: ${cell}`).toContain(code);
          }
      }
    }
  });

  it('opens the CNC page on its count, its connected load and its average age, in the engine’s words', () => {
    const cnc = model.pages[0]!;
    const first = engine[0]!.kpis;
    expect(cnc.kpis.map((kpi) => kpi.value)).toEqual(first.slice(0, 3).map((kpi) => kpi.value));
    expect(cnc.verdict.headline.map((seg) => seg.text).join('')).toContain(first[0]!.value);
  });

  it('splits the CNC controller brands from the makes, each with its share and the engine’s line', () => {
    const tables = model.pages[0]!.tables;
    const controllers = tables.find((table) => table.id === 'controllers')!;
    const makes = tables.find((table) => table.id === 'makes')!;
    expect(controllers.rows[0]?.map((cell) => cell.text)).toEqual([
      'Fanuc',
      '77',
      '61.11%',
      '14 series. Oi-TF (24), Fanuc (series not recorded) (14), Oi-TF Plus (10)',
    ]);
    expect(makes.rows[0]?.[0]?.text).toBe('Cosmos');
    expect(makes.rows[0]?.[3]?.text.startsWith('.')).toBe(false);
  });

  it('names every machine and cell as a chip a reader can open, and never a database id', () => {
    const list = model.pages[0]!.tables.find((table) => table.id === 'list')!;
    const first = list.rows[0]!;
    expect(first[0]?.chip).toMatchObject({ kind: 'machine', id: 'TC-3', label: 'TC-3' });
    const cell = first.find((c) => c.chip?.kind === 'cell');
    expect(cell?.chip).toMatchObject({ kind: 'cell', id: '7', label: 'Cell 7' });
    expect(printed(model).some((text) => UUID.test(text))).toBe(false);
  });

  it('gives the list search, a filter chip per common category and a sort on every column', () => {
    const list = model.pages[0]!.tables.find((table) => table.id === 'list')!;
    expect(list.words.search).toBe('Search 125 rows');
    expect(list.chips.map((chip) => chip.label)).toContain('Vertical Machining Center');
    expect(list.header.find((h) => h.label === 'Year')?.numeric).toBe(true);
  });

  it('says the engine has not computed the registers rather than drawing nothing', () => {
    const notReady = {
      ...reply,
      figures: reply.figures.map((f) =>
        f.key === 'registers' ? { ...f, status: 'not_computed' as const, value: null } : f,
      ),
    };
    expect(registersModel(notReady, t)).toBeNull();
  });
});
