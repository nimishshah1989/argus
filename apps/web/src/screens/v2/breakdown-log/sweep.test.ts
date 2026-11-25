// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { realReplyWithUuids, UUID } from '../figures/real-reply.js';
import { realT } from '../printed-page/test-support.js';
import { everyMatchOf } from './live.js';
import { EMPTY_QUERY } from './model.js';
import { workbookLog } from './source.js';
import { logSheets } from './sweep.js';
import { logWords } from './words.js';

/** Sweep #706 (ADR 0041): the log's Excel download carries what the CSV did. Critical tests only (ADR 0034). */
const words = logWords(realT);

describe('the Breakdown Log Excel sheet', () => {
  it('leaves the eye column out and keeps every other cell as the engine printed it', () => {
    const sheets = logSheets(
      {
        header: ['', 'Sr No', 'Problem', 'Downtime (Hrs)'],
        rows: [
          ['\u{1F441}', '2', 'Belt, slipping', '1.50'],
          ['\u{1F441}', '1', '—', '—'],
        ],
      },
      words,
    );
    expect(sheets).toHaveLength(1);
    expect(sheets[0]!.rows).toEqual([
      ['Sr No', 'Problem', 'Downtime (Hrs)'],
      ['2', 'Belt, slipping', '1.50'],
      ['1', '—', '—'],
    ]);
  });

  it('writes the whole log: the header, then every row, in the columns the CSV had', () => {
    const log = everyMatchOf(workbookLog, EMPTY_QUERY, realT);
    expect(log.rows.length).toBeGreaterThan(0);
    const [sheet] = logSheets(log, words);
    expect(sheet!.rows).toHaveLength(log.rows.length + 1);
    expect(sheet!.rows[0]).toEqual(log.header.slice(1));
    expect(sheet!.rows.slice(1)).toEqual(log.rows.map((row) => row.slice(1)));
  });

  it('prints machine codes and no database id', () => {
    const log = everyMatchOf(realReplyWithUuids(), EMPTY_QUERY, realT);
    expect(log.rows.length).toBeGreaterThan(0);
    expect(JSON.stringify(logSheets(log, words))).not.toMatch(UUID);
  });
});
