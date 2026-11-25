// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { realT } from '../../printed-page/test-support.js';
import { everyMatchOf } from '../live.js';
import { EMPTY_QUERY } from '../model.js';
import { workbookLog } from '../source.js';
import { logSheets } from '../sweep.js';
import { logWords } from '../words.js';

/** Hidden edges of the log's Excel sheet (sweep #706). Critical tests only (ADR 0034): figures and data. */
const words = logWords(realT);

describe('the Breakdown Log Excel sheet, at its edges', () => {
  it('is one sheet with no rows when the engine printed no log', () => {
    const sheets = logSheets({ header: [], rows: [] }, words);
    expect(sheets).toHaveLength(1);
    expect(sheets[0]!.rows).toEqual([]);
  });

  it('is the header alone when nothing matches', () => {
    const [sheet] = logSheets({ header: ['', 'Sr No', 'Problem'], rows: [] }, words);
    expect(sheet!.rows).toEqual([['Sr No', 'Problem']]);
  });

  it('never turns engine text into a number or re-rounds it', () => {
    const [sheet] = logSheets(
      { header: ['', 'Hours', 'Code'], rows: [['\u{1F441}', '0.10', '007']] },
      words,
    );
    expect(sheet!.rows[1]).toEqual(['0.10', '007']);
    for (const cell of sheet!.rows.flat()) expect(typeof cell).toBe('string');
  });

  it('leaves the log it was given untouched', () => {
    const log = { header: ['', 'Sr No'], rows: [['\u{1F441}', '1']] };
    const before = JSON.stringify(log);
    logSheets(log, words);
    expect(JSON.stringify(log)).toBe(before);
  });

  it('writes only the narrowed log', () => {
    const all = everyMatchOf(workbookLog, EMPTY_QUERY, realT);
    const machine = all.rows[0]![5]!;
    const narrowed = everyMatchOf(
      workbookLog,
      { ...EMPTY_QUERY, filters: { ...EMPTY_QUERY.filters, machine } },
      realT,
    );
    expect(narrowed.rows.length).toBeLessThanOrEqual(all.rows.length);
    const [sheet] = logSheets(narrowed, words);
    expect(sheet!.rows).toHaveLength(narrowed.rows.length + 1);
    for (const row of sheet!.rows.slice(1)) expect(row[4]).toBe(machine);
  });
});
