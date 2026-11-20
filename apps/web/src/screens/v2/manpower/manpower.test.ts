import { describe, expect, it } from 'vitest';
import {
  answerKey,
  keyPage,
  missingCells,
  shownCells,
  testT,
} from '../printed-page/test-support.js';
import { manpowerModel } from './adapter.js';

const reply = answerKey('a4-manpower', 'a4-manpower', 41);
const model = manpowerModel(reply, testT)!;
const page = keyPage(reply);
const says = (point: { text: string }[]) => point.map((s) => s.text).join('');

describe('Manpower from the engine reply', () => {
  it('prints the three figures as the engine sent them, and the one chart', () => {
    expect(model.figures.map((f) => [f.label, f.value, f.sub])).toEqual(
      page.kpis.map((k) => [k.label, k.value, k.sub]),
    );
    expect(model.charts).toHaveLength(1);
  });

  it('prints every cell of the five tables, the PM matrix as one table for jobs and one for hours', () => {
    expect(model.tables).toHaveLength(6);
    expect(missingCells(page.tables, shownCells(model.tables))).toEqual([]);
  });

  it('makes each person a chip', () => {
    expect(model.tables[0]!.rows[0]![0]!.chips[0]).toMatchObject({
      kind: 'person',
      label: 'Person 11',
    });
  });

  it('says who handled the most breakdowns and who put in the most hours, from the printed table', () => {
    expect(says(model.verdict.headline)).toBe(
      'Person 11 handled the most breakdowns: 197 of 1279 (15.40%).',
    );
    expect(model.verdict.why.map(says)).toEqual([
      'Person 11 put in the most hours on breakdowns: 469.40 hrs.',
      '14 team members tracked (incl. vendors), 3,060.1 breakdown hours in all.',
    ]);
    expect(model.verdict.headline[0]!.entity).toMatchObject({ kind: 'person' });
  });

  it('offers the people types as filter chips on the manpower table', () => {
    expect(model.tables[0]!.chips.map((c) => c.label)).toEqual(['All', 'Team', 'Vendor']);
  });

  it('keeps the category columns the engine cut short, as printed (the full names need the server)', () => {
    expect(model.tables[3]!.header.map((h) => h.label)).toContain('Turning Cen…');
  });
});
