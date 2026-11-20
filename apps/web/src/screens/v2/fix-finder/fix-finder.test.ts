import { describe, expect, it } from 'vitest';
import { answerKey, testT } from '../printed-page/test-support.js';
import { fixFinderModel } from './adapter.js';

const reply = answerKey('fix-finder', 'fix-finder', 43);
const model = fixFinderModel(reply, testT)!;

describe('Fix Finder from the engine reply', () => {
  it('carries all four figures as the engine printed them', () => {
    expect(model.figures.map((f) => [f.label, f.value, f.sub])).toEqual([
      ['Similar cases', '57', 'Good evidence'],
      ['On this machine', '—', 'choose a machine to see its own history'],
      ['Typical downtime', '1.3 hrs', 'average 2.3 hrs (NO DT counts as 0)'],
      ['Last seen', '06-11-2026', 'most recent similar breakdown'],
    ]);
  });

  it('keeps every row of the engine table, with each cell shown or mapped on purpose', () => {
    const value = (reply.figures[0]!.value as { pages: { tables: { rows: string[][] }[] }[] })
      .pages[0]!;
    const rows = value.tables[0]!.rows;
    expect(model.cases).toHaveLength(rows.length);
    model.cases.forEach((row, at) => {
      const [match, , machine, problem, done, down, doneBy] = rows[at]!;
      expect(row.match.shown).toBe(match);
      expect(row.machine).toMatchObject({ kind: 'machine', id: machine, label: machine });
      expect(row.problem).toBe(problem);
      expect(row.done).toBe(done);
      expect(row.down.shown).toBe(down);
      expect(row.doneBy.map((p) => p.label).join(', ')).toBe(doneBy);
    });
  });

  it('prints dates as DD-MMM-YYYY and sorts them as days', () => {
    expect(model.cases[0]!.date.shown).toBe('26-Oct-2026');
    expect(model.cases[0]!.date.value).toBeGreaterThan(model.cases.at(-1)!.date.value);
  });

  it('names nobody for a row the engine printed no one for', () => {
    expect(model.cases.find((c) => c.doneBy.length === 0)).toBeDefined();
  });

  it('opens the answer with the engine count and typical downtime', () => {
    expect(model.verdict.headline[0]!.text).toBe(
      '57 similar breakdowns found, typically down 1.3 hrs.',
    );
    expect(model.source).toBe(
      'Source: the breakdown log, production machines, PM left out. Records to 11-Nov-2026.',
    );
  });

  it('is empty, not a made-up page, when the engine did not compute it', () => {
    const none = { ...reply, figures: [{ ...reply.figures[0]!, status: 'not_computed' as const }] };
    expect(fixFinderModel(none, testT)).toBeNull();
  });
});
