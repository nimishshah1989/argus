import { describe, expect, it } from 'vitest';
import { EMPTY_QUERY, type LogQuery } from './model.js';
import { logFromWorkbook } from './source.js';

/**
 * ADR 0031 §3: the log opens with one line over the hours of the entries that match the query (not the page), by
 * machine, leaving out code PM rows and dash hours. Frozen 11 Nov answer key: 3,060.11 h, the Dashboard's total.
 */
const ask = async (query: Partial<LogQuery> = {}) =>
  (await logFromWorkbook({ ...EMPTY_QUERY, ...query }))!;

/** Critical tests only (ADR 0034): the figures in the line, not its wording, tone or tag. */
const hasFigures = (text = '') => {
  for (const figure of ['13', '115', '51%']) expect(text).toContain(figure);
};

describe('Breakdown Log takeaway (ticket 641)', () => {
  it('says how few machines hold half the breakdown hours of the whole log', async () => {
    const model = await ask();
    hasFigures(model.takeaways?.log?.text);
  });

  it('is the same on every page and under any sort: it reads the matching entries, not the page shown', async () => {
    const first = await ask();
    hasFigures(first.takeaways?.log?.text);
    expect((await ask({ page: 3 })).takeaways).toEqual(first.takeaways);
    expect((await ask({ sort: { key: 'hours', dir: 'asc' } })).takeaways).toEqual(first.takeaways);
  });
});
