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

/** Empty for the same reason as `SCREENS` in analytics-order-data.ts. */
export const PRINTED: Printed[] = [];
