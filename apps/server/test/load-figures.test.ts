/**
 * Ticket 607 (G3.2): `pnpm load:figures`. The verdict rule is checked on made-up reports. One run at 30 readers for
 * about ten seconds with one year of data (needs Docker) must end with no failed request and no engine run inside a
 * read; its p95 is printed, not asserted, because CI hardware is not the target.
 */
import { describe, expect, it } from 'vitest';
import { P95_LIMIT_MS, problemsOf, runLoad, type LoadReport } from '../../../tools/load-figures.js';

const good: LoadReport = {
  requests: 900,
  errors: 0,
  p50Ms: 20,
  p95Ms: 120,
  maxMs: 400,
  engineRunsInRead: 0,
};

describe('the load verdict (607)', () => {
  it('passes a run under the limit with no error and no engine run in a read', () => {
    expect(problemsOf(good)).toEqual([]);
    expect(problemsOf({ ...good, p95Ms: P95_LIMIT_MS })).toEqual([]);
  });

  it('names each way a run fails', () => {
    expect(problemsOf({ ...good, p95Ms: P95_LIMIT_MS + 1 })).toHaveLength(1);
    expect(problemsOf({ ...good, errors: 1 })).toHaveLength(1);
    expect(problemsOf({ ...good, engineRunsInRead: 1 })).toHaveLength(1);
    expect(problemsOf({ ...good, requests: 0 })).toHaveLength(1);
    expect(problemsOf({ ...good, p95Ms: 999, errors: 3, engineRunsInRead: 2 })).toHaveLength(3);
  });
});

describe('thirty readers on one year of data (607)', () => {
  it('answers every read, and none of them runs the engine', async () => {
    const report = await runLoad({ readers: 30, seconds: 10, years: 1, ticketsPerYear: 1350 });
    console.log(JSON.stringify(report));
    expect(report.requests).toBeGreaterThan(30);
    expect(report.errors).toBe(0);
    expect(report.engineRunsInRead).toBe(0);
  }, 600_000);
});
