import { describe, expect, it } from 'vitest';
import { answerKey, keyPage, testT } from '../printed-page/test-support.js';
import { whyWhyModel } from './adapter.js';

const reply = answerKey('a6-why-why', 'a6-why-why', 41);
const model = whyWhyModel(reply, testT)!;
const table = keyPage(reply).tables[0]!;
const says = (point: { text: string }[]) => point.map((s) => s.text).join('');

describe('Why-Why from the engine reply', () => {
  it('keeps every candidate in the engine order, with its own status word', () => {
    expect(model.rows).toHaveLength(table.rows.length);
    expect(
      model.rows.map((r) => [r.machine.label, r.problem, r.down.shown, r.status.text]),
    ).toEqual(table.rows.map((r) => [r[0], r[2], r[3], r[4]]));
  });

  it('reads the date as DD-MMM-YYYY and sorts it by day', () => {
    expect(model.rows[0]!.date).toEqual({ shown: '13-Jun-2026', value: 20260613 });
  });

  it('does not print the platform action cell: no row can name its ticket', () => {
    expect(JSON.stringify(model.rows)).not.toMatch(/Start Why-Why|View \/ Edit/);
    expect(model.words.startNote).toMatch(/which ticket each row is/);
  });

  it('says how many candidates there are and how many are done, and names the longest', () => {
    expect(says(model.verdict.headline)).toBe(
      '24 breakdowns ran past the Why-Why limit: 0 have a Why-Why, 24 are waiting.',
    );
    expect(model.verdict.why.map(says)).toEqual([
      'The longest was TMC-2 on 13-Jun-2026, 238.58 hrs down. geometry problem',
    ]);
  });

  it('counts a saved Why-Why from the engine status', () => {
    const value = JSON.parse(JSON.stringify(reply.figures[0]!.value));
    value.pages[0].tables[0].rows[1][4] = 'Completed';
    const done = whyWhyModel({ ...reply, figures: [{ ...reply.figures[0]!, value }] }, testT)!;
    expect(done.rows[1]!.status.done).toBe(true);
    expect(says(done.verdict.headline)).toMatch(/1 have a Why-Why, 23 are waiting/);
  });

  it('is empty when the engine has no candidates', () => {
    const none = { ...reply, figures: [{ ...reply.figures[0]!, status: 'not_computed' as const }] };
    expect(whyWhyModel(none, testT)).toBeNull();
  });
});
