import { describe, expect, it } from 'vitest';
import { answerKey, printedStrings, testT } from '../printed-page/test-support.js';
import { problemAnalysisModel } from './adapter.js';

const reply = answerKey('a10-problems', 'a10-problems', 41);
const model = problemAnalysisModel(reply, testT)!;
type KeyPage = {
  kpis: { label: string; value: string; sub: string }[];
  tables: { title: string; header: string[]; rows: string[][] }[];
  charts: { id: string }[];
};
const page = (reply.figures[0]!.value as { pages: KeyPage[] }).pages[0]!;

describe('Problem Analysis from the engine reply', () => {
  it('prints all eight figures as the engine sent them, the page four then the what-if four', () => {
    const shown = [...model.studied, ...model.whatIf].map((f) => [f.label, f.value, f.sub]);
    expect(shown).toEqual(page.kpis.map((k) => [k.label, k.value, k.sub]));
    expect(model.studied).toHaveLength(4);
    expect(model.whatIf).toHaveLength(4);
  });

  it('draws both charts the engine sent', () => {
    expect(model.charts.map((c) => c.spec.kind)).toEqual(['bar', 'scatter']);
    expect(page.charts).toHaveLength(2);
  });

  it('keeps all six tables with every row', () => {
    const all = [
      model.groups,
      model.families,
      model.repeats,
      model.unplaced,
      model.unrecognised,
      model.editor,
    ];
    expect(all.every((table) => table !== null)).toBe(true);
    expect(all.map((table) => table!.rows.length)).toEqual(page.tables.map((t) => t.rows.length));
  });

  it('shows every printed cell of the groups, families, repeats and words tables (a completeness check)', () => {
    const shown = new Set(
      [model.groups, model.families, model.repeats, model.unrecognised].flatMap((table) =>
        table!.rows.flatMap((row) => row.map((cell) => cell.text)),
      ),
    );
    const printed = [0, 1, 2, 4].flatMap((at) => page.tables[at]!.rows.flat());
    const missing = printed.filter(
      (cell) => !shown.has(cell) && !/^Choose group/.test(cell) && !/^\d\d-\d\d-\d{4}$/.test(cell),
    );
    expect(missing).toEqual([]);
  });

  it('makes a machine and the people who did a job chips, and dates DD-MMM-YYYY', () => {
    const first = model.unplaced!.rows[0]!;
    expect(first[0]!.text).toBe('06-Nov-2026');
    expect(first[1]!.chips[0]).toMatchObject({ kind: 'machine', id: 'VC-14' });
    expect(model.repeats!.rows[0]![0]!.chips[0]).toMatchObject({ kind: 'machine', id: 'TC-5' });
  });

  it('cuts a flattened drop-down down to its chosen word and never prints the option run', () => {
    const choices = [model.unplaced!, model.unrecognised!].flatMap((t) =>
      t.rows.map((r) => r[4]!.text),
    );
    expect(choices.some((cell) => cell.length > 80)).toBe(false);
    expect(model.unplaced!.rows[0]![4]!.text).toBe(
      'Suggested: Air leakage / low air pressure (99%)',
    );
    expect(model.unrecognised!.rows[0]![4]!.text).toBe('Choose group…');
  });

  it('leaves out only the editor columns the engine printed empty, and says why the editor is read-only', () => {
    expect(model.editor!.header.map((h) => h.label)).toEqual(['Order', 'Keywords', 'Remove']);
    expect(model.words.editorReadOnly).toMatch(/Read-only/);
  });

  it('offers the first three families as filter chips on the groups table', () => {
    const chips = model.groups!.chips;
    expect(chips.map((c) => c.label)).toEqual([
      'All',
      ...page.tables[1]!.rows.slice(0, 3).map((r) => r[0]),
    ]);
  });

  it('prints every string of the page that no screen mapping drops on purpose', () => {
    const everything = new Set<string>();
    for (const part of [model.studied, model.whatIf, model.groups, model.families, model.repeats])
      printedStrings(part, everything);
    for (const kpi of page.kpis) expect(everything.has(kpi.value)).toBe(true);
  });

  it('is empty when the engine did not compute it', () => {
    const none = { ...reply, figures: [{ ...reply.figures[0]!, status: 'not_computed' as const }] };
    expect(problemAnalysisModel(none, testT)).toBeNull();
  });
});
