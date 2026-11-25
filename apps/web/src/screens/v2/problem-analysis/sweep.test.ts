import { describe, expect, it } from 'vitest';
import type { BarSpec, ScatterSpec } from '../../../ui/chart/chart-spec.js';
import type { PrintedTable } from '../../../ui/v2/domain/printed-table.js';
import { rankRows } from '../../../ui/v2/ranked-bars.js';
import { answerKey, testT } from '../printed-page/test-support.js';
import type { Translate } from '../figures/read.js';
import { problemAnalysisModel } from './adapter.js';
import { costRows, meanSplit, problemSheets, quadNames, quadPoints } from './sweep.js';

const model = problemAnalysisModel(answerKey('a10-problems', 'a10-problems', 41), testT)!;
const bar = model.charts[0]!.spec as BarSpec;
const scatter = model.charts[1]!.spec as ScatterSpec;
const t: Translate = (key) => testT(key);

describe('Problem Analysis sweep: the costliest problems as ranked bars', () => {
  it('pairs every category with its hours, the share stripped from the label and exact text', () => {
    const rows = costRows(bar);
    expect(rows).toHaveLength(bar.categories.length);
    expect(rows[0]).toEqual({
      key: 'Axis motor / drive / encoder / servo  (16%)',
      label: 'Axis motor / drive / encoder / servo',
      value: 484.9,
      valueText: '484.9',
    });
    expect(rows.map((r) => r.value)).toEqual(bar.series[0]!.values);
  });
});

describe('Problem Analysis sweep: often or long as a quadrant', () => {
  it('turns every point into x = how often, y = average hours, named as the chart names it', () => {
    const points = quadPoints(scatter);
    expect(points).toHaveLength(scatter.points.length);
    expect(points[0]).toEqual({
      key: 'Axis motor / drive / encoder / servo',
      label: 'Axis motor / drive / encoder / servo',
      x: 104,
      y: 4.66,
    });
  });

  it('splits at the mean of x and of y', () => {
    const split = meanSplit([
      { key: 'a', label: 'a', x: 10, y: 1 },
      { key: 'b', label: 'b', x: 30, y: 5 },
    ]);
    expect(split).toEqual({ x: 20, y: 3 });
  });

  it('names the quadrants often/rare by x and long/short by y', () => {
    expect(quadNames(t)).toEqual({
      hh: 'Often and long',
      hl: 'Often, short',
      lh: 'Rare but long',
      ll: 'Rare and short',
    });
  });
});

describe('Problem Analysis sweep: Download Excel', () => {
  it('gives one sheet per table, header first, plain numbers as numbers and percentages as printed', () => {
    const sheets = problemSheets(model);
    expect(sheets.map((s) => s.name)).toEqual([
      'All problem groups',
      'Families of problems',
      'Repeat offenders',
      'Entries the system could not pl',
      'Words not yet recognised',
      'Problem groups',
    ]);
    const groups = sheets[0]!;
    expect(groups.rows[0]).toEqual(model.groups!.header.map((h) => h.label));
    expect(groups.rows[1]).toEqual([
      'Axis motor / drive / encoder / servo',
      'Axis, drive and geometry',
      104,
      '8.13%',
      484.9,
      '15.85%',
      4.66,
      48,
      '27.88%',
    ]);
    expect(groups.rows).toHaveLength(model.groups!.rows.length + 1);
  });
});

describe('Problem Analysis sweep: the bars share all hours, not only the top 16 (ticket 752 review)', () => {
  const hoursHeader: [string, boolean][] = [
    ['Problem group', false],
    ['Hours', true],
    ['% of hours', true],
  ];
  const groupsTable = (rows: [string, string, string][]): PrintedTable => ({
    title: 'All problem groups',
    header: hoursHeader.map(([label, numeric]) => ({ label, numeric })),
    rows: rows.map((row) => row.map((text) => ({ text, sort: text, chips: [] }))),
    chips: [],
  });
  const percent = (rows: ReturnType<typeof rankRows>) =>
    Object.fromEntries(rows.map((r) => [r.key, Math.round(r.share * 100)]));

  it('adds one rest row for the 4 groups past the 16 shown, so each printed % is the groups table %', () => {
    // 20 groups, 100 hours in all: 16 shown (A..P) and four more (Q..T) the engine cut off.
    const hours = [20, 12, 10, 8, 7, 6, 5, 5, 4, 4, 3, 3, 2, 2, 2, 2, 2, 1, 1, 1];
    const names = hours.map((_, at) => String.fromCharCode(65 + at));
    const table = groupsTable(names.map((n, at) => [n, String(hours[at]), `${hours[at]}.00%`]));
    const shown = bar16(names.slice(0, 16), hours.slice(0, 16));
    const rows = costRows(shown, table, 'All other groups');
    expect(rows).toHaveLength(17);
    expect(rows.at(-1)).toEqual({
      key: '__rest',
      label: 'All other groups',
      value: 5,
      valueText: '5',
      rest: true,
    });
    const printed = percent(rankRows(rows));
    names.slice(0, 16).forEach((n, at) => expect(printed[`${n}  (${hours[at]}%)`]).toBe(hours[at]));
    expect(printed.__rest).toBe(5);
  });

  it('on the 11 November plant, every bar\'s share is the groups table "% of hours" (to 0.05 points)', () => {
    const ranked = rankRows(costRows(bar, model.groups, 'All other groups'));
    const tablePct = new Map(
      model.groups!.rows.map((row) => [row[0]!.text, Number.parseFloat(row[5]!.text)]),
    );
    expect(ranked.filter((x) => x.rest)).toHaveLength(1);
    for (const r of ranked.filter((x) => !x.rest)) {
      const pct = tablePct.get(String(r.label))!;
      expect(Math.abs(r.share * 100 - pct), String(r.label)).toBeLessThan(0.05);
    }
  });

  it('adds no rest row when every group is shown', () => {
    const table = groupsTable([
      ['A', '30', '75.00%'],
      ['B', '10', '25.00%'],
    ]);
    const rows = costRows(bar16(['A', 'B'], [30, 10]), table, 'All other groups');
    expect(rows.map((r) => r.rest ?? false)).toEqual([false, false]);
  });
});

/** An engine bar whose labels carry the share as the engine prints it ("A  (20%)"). */
function bar16(names: string[], values: number[]): BarSpec {
  return {
    kind: 'bar',
    title: 'Which problems cost the most?',
    categoryLabel: 'Problem group',
    categories: names.map((n, at) => `${n}  (${values[at]}%)`),
    series: [{ name: 'Hours', values }],
  };
}
