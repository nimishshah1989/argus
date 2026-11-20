// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { contentOf } from '../../analytics/figure-content.js';
import { printed, realReply, UUID } from '../figures/real-reply.js';
import { realT } from '../printed-page/test-support.js';
import { shiftKpisModel } from './adapter.js';

const reply = realReply();
const model = shiftKpisModel(reply, realT)!;
const figures = reply.figures.filter((f) => f.screen === 'shift-kpis');
const says = (point: { text: string }[]) => point.map((s) => s.text).join('');
/** A figure the engine computed and printed a page for; a ready figure with a null value (no open breakdowns) has none. */
const printedFigures = figures.filter(
  (f) => f.status === 'ready' && contentOf(f, realT)?.kind === 'page',
);
const sectionOf = (key: string) => model.sections.find((s) => s.id === key)!;
const pageOf = (key: string) => {
  const content = contentOf(
    figures.find((f) => f.key === key)!,
    realT,
  );
  if (content?.kind !== 'page') throw new Error(`${key} is not a page`);
  return content;
};

describe('Shift-calendar KPIs from the engine reply', () => {
  it('gives every figure of the screen its section, in the engine’s order, even one it did not compute', () => {
    expect(model.sections.map((s) => s.id)).toEqual(figures.map((f) => f.key));
    const unprinted = figures.filter((f) => !printedFigures.includes(f)).map((f) => f.key);
    expect(unprinted.length).toBeGreaterThan(0);
    for (const key of unprinted) expect(sectionOf(key).notComputed).toBe(true);
    expect(model.sections.some((s) => s.notComputed !== true)).toBe(true);
  });

  it('prints each ready figure’s own tiles, tables and charts as the engine sent them', () => {
    for (const figure of printedFigures) {
      const page = pageOf(figure.key);
      const section = sectionOf(figure.key);
      expect(section.figures.map((f) => [f.label, f.value, f.sub])).toEqual(
        page.kpis.map((k) => [k.label, k.value, k.sub ?? '']),
      );
      expect(section.tables.length + section.heat.length).toBe(page.tables.length);
      expect(section.charts).toHaveLength(page.charts.length);
    }
  });

  it('prints every cell of the breakdown map’s heat grids, tinted by weight, a month with no hours left a dash', () => {
    const page = pageOf('shift-kpis.breakdown-map');
    const grids = page.tables.filter((table) => table.heat === true);
    const section = sectionOf('shift-kpis.breakdown-map');
    expect(section.heat).toHaveLength(4);
    section.heat.forEach((matrix, at) => {
      const source = grids[at]!;
      expect(matrix.rows).toHaveLength(source.rows.length);
      source.rows.forEach((row, r) => {
        const shown = [
          matrix.rows[r]!.head,
          ...matrix.rows[r]!.cells.map((c) => c.text),
          ...matrix.rows[r]!.plain,
        ];
        expect(shown.join('|').replace('Cell ', '')).toBe(row.join('|'));
      });
      const cells = matrix.rows.flatMap((row) => row.cells);
      expect(cells.filter((c) => c.text === '—').every((c) => c.level === null)).toBe(true);
      expect(cells.filter((c) => c.text !== '—').every((c) => c.level !== null)).toBe(true);
      expect(cells.every((c) => c.name.includes(': '))).toBe(true);
    });
  });

  it('names a machine and a cell in a heat grid as a chip', () => {
    const [machine, cell] = sectionOf('shift-kpis.breakdown-map').heat;
    expect(machine!.rows[0]!.chip).toMatchObject({ kind: 'machine' });
    expect(cell!.rows[0]!.chip).toMatchObject({ kind: 'cell' });
  });

  it('opens the tickets behind a count only when that count is the number of tickets', () => {
    for (const figure of printedFigures) {
      const section = sectionOf(figure.key);
      const counted = section.figures.find((f) => f.drill);
      if (counted) {
        expect(Number(counted.value.replaceAll(',', '')), counted.label).toBe(
          figure.drill.ids.length,
        );
        expect(section.drill).toBeUndefined();
      } else {
        expect(section.drill?.figure, figure.key).toBe(figure.key);
      }
    }
    expect(
      sectionOf('shift-kpis.compare').figures.find((f) => f.label === 'Failures')?.drill,
    ).toBeDefined();
  });

  it('opens with the working-hour basis against the platform basis', () => {
    expect(says(model.verdict.headline)).toBe(
      'On working hours a machine runs 462.0 hrs between breakdowns (439.9 on the platform basis); a breakdown takes 2.39 hrs to fix and availability is 99.36%.',
    );
  });

  it('never prints a database id', () => {
    expect(printed(model).some((text) => UUID.test(text))).toBe(false);
  });

  it('says nothing was computed when the engine computed none of the four', () => {
    const none = {
      ...reply,
      figures: reply.figures.map((f) =>
        f.screen === 'shift-kpis' ? { ...f, status: 'not_computed' as const, value: null } : f,
      ),
    };
    expect(shiftKpisModel(none, realT)).toBeNull();
  });
});
