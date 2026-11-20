/**
 * What each screen prints, as the engine wrote it (see `analytics-mock.ts`): a tile is [label, value, sub-line]; a row
 * is [table name, the row's place in the body, every cell of it]. A blank cell is '' and stays blank, a dash stays a dash.
 */
export interface Printed {
  path: string;
  tiles: [string, string, string?][];
  /** The optional fourth entry is a column header the table must have; with a blank name it finds the table by that header alone (the old editor table had no name). */
  rows: [string, number, string[], string?][];
}

const B = '/analytics/breakdowns?screen=';

export const PRINTED: Printed[] = [
  {
    path: `${B}a1-bd-pm`,
    tiles: [
      ['Breakdown hours', '41.5', '3 pts up'],
      ['PM hours', '—'],
    ],
    rows: [
      ['By cell', 0, ['Cell 2', '12.5', '']],
      ['By month', 0, ['Jan', '4.0']],
      ['By month', 1, ['Feb', '—']],
    ],
  },
  {
    path: `${B}a2-category-cell`,
    tiles: [['Top category', 'Spindle', '12 breakdowns']],
    rows: [['By category', 0, ['Spindle', '9.5']]],
  },
  {
    path: `${B}a3-mttr-mtbf`,
    tiles: [
      ['MTTR', '2.5', 'hours'],
      ['MTBF', '110.0', 'hours'],
    ],
    rows: [['By category', 0, ['Spindle', '2.5', '—']]],
  },
  {
    path: `${B}a4-manpower`,
    tiles: [
      ['People', '2'],
      ['Hours handled', '30.5'],
    ],
    rows: [
      ['Manpower Table', 0, ['Asha', '12.0']],
      ['Manpower Table', 1, ['Ravi', '18.5']],
    ],
  },
  {
    path: '/analytics/machines?screen=compare',
    tiles: [],
    rows: [
      ['Scorecard', 0, ['Health', '82', '74']],
      ['Checkup', 0, ['Coolant', 'Ok']],
      ['Specifications', 0, ['Year', '2019']],
      ['Longest breakdowns', 0, ['01-02-2026', '6.5']],
    ],
  },
];
