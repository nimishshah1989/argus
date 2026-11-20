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

export const PRINTED: Printed[] = [
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
