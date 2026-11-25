import { describe, expect, it } from 'vitest';
import type { BarSpec, ScatterSpec } from '../../../../ui/chart/chart-spec.js';
import type { PrintedTable } from '../../../../ui/v2/domain/printed-table.js';
import { answerKey, testT } from '../../printed-page/test-support.js';
import { problemAnalysisModel } from '../adapter.js';
import { costRows, meanSplit, problemSheets, quadPoints, tableSheets } from '../sweep.js';

const bar = (categories: string[], values?: number[]): BarSpec => ({
  kind: 'bar',
  title: 'Which problems cost the most?',
  categoryLabel: 'Problem group',
  categories,
  series: values ? [{ name: 'Hours', values }] : [],
});
const scatter = (points: ScatterSpec['points']): ScatterSpec => ({
  kind: 'scatter',
  title: 'Often, or long?',
  machineLabel: 'Problem group',
  xLabel: 'How often',
  yLabel: 'How long',
  mttrLabel: 'Hours',
  points,
});
const table = (title: string, header: [string, boolean][], rows: string[][]): PrintedTable => ({
  title,
  header: header.map(([label, numeric]) => ({ label, numeric })),
  rows: rows.map((row) => row.map((text) => ({ text, sort: text, chips: [] }))),
  chips: [],
});

describe('costRows, hidden edges', () => {
  it('drops a non-finite or missing value and never re-rounds the engine number past two places', () => {
    const rows = costRows(bar(['A (10%)', 'B', 'C', 'D', 'E'], [1234567.891, NaN, Infinity, 0]));
    expect(rows.map((r) => [r.key, r.label, r.value, r.valueText])).toEqual([
      ['A (10%)', 'A', 1234567.891, '12,34,567.89'],
      ['D', 'D', 0, '0'],
    ]);
  });

  it('is empty with no series or no categories', () => {
    expect(costRows(bar(['A'], undefined))).toEqual([]);
    expect(costRows(bar([], [1, 2]))).toEqual([]);
  });

  it('strips only one trailing share, keeping a share-like text inside the name', () => {
    const rows = costRows(bar(['Tool (50%) wear  (12.5%)', 'Plain'], [5, 4]));
    expect(rows.map((r) => r.label)).toEqual(['Tool (50%) wear', 'Plain']);
  });
});

describe('quadPoints and meanSplit, hidden edges', () => {
  const p = (label: string, x: number, y: number, code?: string) => ({
    label,
    x,
    y,
    r: 1,
    ...(code ? { code } : {}),
  });

  it('drops non-finite points, prints the code when there is one, keeps keys unique', () => {
    const points = quadPoints(
      scatter([
        p('a', 1, 2),
        p('b', NaN, 2),
        p('a', 3, 4),
        p('c', 5, Infinity),
        p('m1', 6, 7, 'M-01'),
        p('a', 8, 9),
      ]),
    );
    expect(points).toEqual([
      { key: 'a', label: 'a', x: 1, y: 2 },
      { key: 'a#2', label: 'a', x: 3, y: 4 },
      { key: 'm1', label: 'M-01', x: 6, y: 7 },
      { key: 'a#3', label: 'a', x: 8, y: 9 },
    ]);
  });

  it('is empty for no points; the split of nothing is 0, 0', () => {
    expect(quadPoints(scatter([]))).toEqual([]);
    expect(meanSplit([])).toEqual({ x: 0, y: 0 });
  });

  it('ignores a non-finite point in the mean and never rounds it', () => {
    expect(
      meanSplit([
        { key: 'a', label: 'a', x: 1, y: 1 },
        { key: 'b', label: 'b', x: 2, y: 2 },
        { key: 'c', label: 'c', x: NaN, y: 100 },
      ]),
    ).toEqual({ x: 1.5, y: 1.5 });
    expect(
      meanSplit([
        { key: 'a', label: 'a', x: 1, y: 2 },
        { key: 'b', label: 'b', x: 1, y: 2 },
        { key: 'c', label: 'c', x: 2, y: 2 },
      ]).x,
    ).toBeCloseTo(4 / 3, 12);
  });
});

describe('tableSheets, hidden edges', () => {
  it('keeps text, percents and dashes as printed and makes plain numbers exact numbers', () => {
    const [sheet] = tableSheets([
      table(
        'T',
        [
          ['Name', false],
          ['Hours', true],
          ['Share', true],
        ],
        [
          ['007', '1,23,456.75', '12.5%'],
          ['B', '—', '-3'],
        ],
      ),
    ]);
    expect(sheet!.rows).toEqual([
      ['Name', 'Hours', 'Share'],
      ['007', 123456.75, '12.5%'],
      ['B', '—', -3],
    ]);
  });

  it('keeps every column as shown, and the header of a table with no rows', () => {
    const [buttons, empty] = tableSheets([
      table(
        'A',
        [
          ['Word', false],
          ['Accept', false],
        ],
        [
          ['x', 'Accept'],
          ['y', ''],
        ],
      ),
      table(
        'B',
        [
          ['Word', false],
          ['Accept', false],
        ],
        [],
      ),
    ]);
    expect(buttons!.rows).toEqual([
      ['Word', 'Accept'],
      ['x', 'Accept'],
      ['y', ''],
    ]);
    expect(empty!.rows).toEqual([['Word', 'Accept']]);
  });

  it('makes every name a valid, unique Excel name of at most 31 characters', () => {
    const long = 'Entries the system could not place (31, 2.42% of all)';
    const names = tableSheets([
      table(long, [], []),
      table(long, [], []),
      table('', [], []),
      table('a/b: c?', [], []),
      table('ALL problem groups', [], []),
      table('all problem groups', [], []),
    ]).map((s) => s.name);
    expect(names).toEqual([
      'Entries the system could not pl',
      'Entries the system could no (2)',
      'Sheet3',
      'a b  c',
      'ALL problem groups',
      'all problem groups (2)',
    ]);
    for (const name of names) expect(name.length).toBeLessThanOrEqual(31);
  });

  it('is empty for no tables', () => {
    expect(tableSheets([])).toEqual([]);
  });
});

describe('problemSheets, hidden', () => {
  it('skips a table the engine did not send', () => {
    const model = problemAnalysisModel(answerKey('a10-problems', 'a10-problems', 41), testT)!;
    expect(problemSheets({ ...model, families: null, editor: null }).map((s) => s.name)).toEqual([
      'All problem groups',
      'Repeat offenders',
      'Entries the system could not pl',
      'Words not yet recognised',
    ]);
  });
});
