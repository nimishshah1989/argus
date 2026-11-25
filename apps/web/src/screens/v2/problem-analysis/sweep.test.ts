import { describe, expect, it } from 'vitest';
import type { BarSpec, ScatterSpec } from '../../../ui/chart/chart-spec.js';
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
