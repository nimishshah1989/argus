// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { realReply, UUID } from '../figures/real-reply.js';
import {
  answerKey,
  keyPage,
  missingCells,
  printedStrings,
  realT,
  shownCells,
} from '../printed-page/test-support.js';
import { shortDate } from '../printed-page/printed.js';
import { bottleneckModel } from './adapter.js';

const reply = answerKey('a9-bottleneck-forecast', 'a9-bottleneck-forecast', 42);
const model = bottleneckModel(reply, realT, (id) => id)!;
const page = keyPage(reply);
const says = (point: { text: string }[]) => point.map((s) => s.text).join('');

describe('Bottleneck from the engine reply', () => {
  it('prints all fourteen figures as the engine sent them', () => {
    expect(model.figures.map((f) => [f.label, f.value, f.sub])).toEqual(
      page.kpis.map((k) => [k.label, k.value, k.sub]),
    );
    expect(page.kpis).toHaveLength(14);
  });

  it('draws the risk map and the expected-downtime chart, and prints every cell of the nine tables', () => {
    expect(model.charts.map((chart) => chart.spec.kind)).toEqual(['scatter', 'bar']);
    expect(model.tables).toHaveLength(page.tables.length);
    const shown = shownCells(model.tables);
    expect(missingCells(page.tables, shown).filter((cell) => !shown.has(shortDate(cell)))).toEqual(
      [],
    );
  });

  it('opens with the engine’s own counts and names the machine it ranks first, as a chip', () => {
    expect(says(model.verdict.headline)).toBe(
      '6 machines could stall production and 16 more need a close watch; 4 have no backup machine.',
    );
    const why = model.verdict.why;
    expect(says(why[0]!)).toContain('438.4 hrs');
    expect(says(why[1]!)).toBe(
      'WJ-01 ranks first on risk: score 87 (Critical), available 98.36% of the time.',
    );
    expect(why[1]![0]!.entity).toMatchObject({ kind: 'machine', id: 'WJ-01' });
  });

  it('makes a machine and a cell a chip, and filters the risk table by rating', () => {
    const risk = model.tables[0]!;
    expect(risk.rows[0]![1]!.chips[0]).toMatchObject({ kind: 'machine', id: 'WJ-01' });
    expect(risk.rows[0]![3]!.chips[0]).toMatchObject({ kind: 'cell', id: 'Cell 6' });
    expect(risk.chips.map((chip) => chip.label)).toEqual(
      expect.arrayContaining(['All', 'Critical', 'High']),
    );
  });

  it('keeps the numeric columns sortable by the number they carry', () => {
    const risk = model.tables[0]!;
    const score = risk.header.findIndex((h) => h.label === 'Score');
    expect(risk.header[score]!.numeric).toBe(true);
    expect(risk.rows[0]![score]!.sort).toBe(87);
  });

  it('never prints a database id', () => {
    expect([...printedStrings(model)].some((text) => UUID.test(text))).toBe(false);
  });

  it('opens the machines behind the whole page from the engine’s real figure, one row per machine it counted', () => {
    const real = realReply();
    const figure = real.figures.find((f) => f.key === 'a9-bottleneck-forecast')!;
    const live = bottleneckModel(real, realT, (id) => id)!;
    expect(figure.drill.ids.length).toBeGreaterThan(0);
    expect(live.drill).toEqual({
      figure: 'a9-bottleneck-forecast',
      label: 'Show the rows behind A9 bottleneck and forecast',
    });
  });

  it('says nothing was computed rather than drawing nothing', () => {
    const none = { ...reply, figures: [{ ...reply.figures[0]!, status: 'not_computed' as const }] };
    expect(bottleneckModel(none, realT, (id) => id)).toBeNull();
  });
});
