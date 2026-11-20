import { DEFAULT_PROFILE } from '@uptimo/shared';
import { describe, expect, it } from 'vitest';
import { COMPUTERS, runWith } from '../../../../../../packages/domain/src/index.js';
import { ENGINE_DATA } from '../../../../../../packages/domain/test/answer-key/fixture.js';
import { testT } from '../printed-page/test-support.js';
import { printedLog } from './live.js';
import { workbookLog } from './source.js';

describe('the gallery log is the engine log', () => {
  it('prints every row and cell the engine prints for the 11 November plant', () => {
    const result = runWith({ 'breakdown-log': COMPUTERS['breakdown-log']! } as never, {
      data: ENGINE_DATA,
      asOf: '2026-11-11',
      profile: DEFAULT_PROFILE,
    });
    const figure = result.figures.find((f) => f.key === 'breakdown-log')!;
    const engine = (figure.value as { pages: { tables: { rows: string[][] }[] }[] }).pages[0]!
      .tables[0]!.rows;
    const mine = printedLog(workbookLog, testT)!;
    expect(mine.rows).toEqual(engine);
    expect(mine.rows.length).toBeGreaterThan(1000);
    expect(workbookLog.figures[0]!.drill.ids).toEqual(figure.drill.ids);
  });
});
