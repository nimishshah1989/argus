import { describe, expect, it } from 'vitest';
import { EMPTY_QUERY, type LogQuery } from './model.js';
import { logFromWorkbook } from './source.js';

/**
 * ADR 0031 §3: the log opens with one line over the hours of the entries that match the query (not the page), by
 * machine, leaving out code PM rows and dash hours. Frozen 11 Nov answer key: 3,060.11 h, the Dashboard's total.
 */
const ask = async (query: Partial<LogQuery> = {}) =>
  (await logFromWorkbook({ ...EMPTY_QUERY, ...query }))!;

const FULL = { text: '13 of 115 make up 51% of the total.', tone: 'risk', tag: 'Risk' };

describe('Breakdown Log takeaway (ticket 641)', () => {
  it('says how few machines hold half the breakdown hours of the whole log', async () => {
    const model = await ask();
    expect(Object.keys(model.takeaways ?? {})).toEqual(['log']);
    expect(model.takeaways?.log).toMatchObject(FULL);
  });

  it('is the same on every page and under any sort: it reads the matching entries, not the page shown', async () => {
    const first = await ask();
    expect(first.takeaways?.log).toMatchObject(FULL);
    expect((await ask({ page: 3 })).takeaways).toEqual(first.takeaways);
    expect((await ask({ sort: { key: 'hours', dir: 'asc' } })).takeaways).toEqual(first.takeaways);
  });
});
