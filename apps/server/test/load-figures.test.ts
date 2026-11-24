/**
 * Tickets 607 and 628 (G3.2): `pnpm load:figures`. The verdict rule is checked on made-up reports: each route read
 * (the figures and the Action Center board) must answer, each under the p95 limit. One run at 30 readers for about
 * ten seconds with one year of data (needs Docker) must read both routes with no failed request and no engine run
 * inside a read; its p95 is printed, not asserted, because CI hardware is not the target.
 */
import { describe, expect, it } from 'vitest';
import {
  main,
  P95_LIMIT_MS,
  problemsOf,
  runLoad,
  type LoadReport,
} from '../../../tools/load-figures.js';

const good: LoadReport = {
  requests: 900,
  errors: 0,
  p50Ms: 20,
  p95Ms: 120,
  maxMs: 400,
  engineRunsInRead: 0,
  routes: {
    figures: { requests: 450, errors: 0, p95Ms: 120 },
    board: { requests: 450, errors: 0, p95Ms: 40 },
  },
};
const route = (name: 'figures' | 'board', part: object): LoadReport => ({
  ...good,
  routes: { ...good.routes, [name]: { ...good.routes[name], ...part } },
});

describe('the load verdict (607)', () => {
  it('passes a run under the limit with no error and no engine run in a read', () => {
    expect(problemsOf(good)).toEqual([]);
    expect(problemsOf(route('figures', { p95Ms: P95_LIMIT_MS }))).toEqual([]);
  });

  it('names each way a run fails', () => {
    expect(problemsOf(route('figures', { p95Ms: P95_LIMIT_MS + 1 }))).toHaveLength(1);
    expect(problemsOf({ ...good, errors: 1 })).toHaveLength(1);
    expect(problemsOf({ ...good, engineRunsInRead: 1 })).toHaveLength(1);
    expect(problemsOf(route('figures', { requests: 0 }))).toHaveLength(1);
    const slow = route('figures', { p95Ms: 999 });
    expect(problemsOf({ ...slow, errors: 3, engineRunsInRead: 2 })).toHaveLength(3);
  });

  it('fails a slow or silent board even when the figures are fast (628)', () => {
    const board = problemsOf(route('board', { p95Ms: P95_LIMIT_MS + 1 }));
    expect(board).toHaveLength(1);
    expect(board[0]).toMatch(/board/);
    expect(problemsOf(route('board', { requests: 0 }))[0]).toMatch(/board/);
  });
});

describe('the arguments (628)', () => {
  const quick = ['--readers', '1', '--seconds', '1', '--years', '1', '--tickets-per-year', '10'];

  it('refuses --database-url with no value instead of starting its own database', async () => {
    await expect(main([...quick, '--database-url'])).rejects.toThrow(/--database-url/);
    await expect(main(['--database-url', '--allow-remote', ...quick])).rejects.toThrow(
      /--database-url/,
    );
  }, 120_000);
});

describe('thirty readers on one year of data (607, 628)', () => {
  it('reads the figures and the board, answers every read, and none of them runs the engine', async () => {
    const report = await runLoad({ readers: 30, seconds: 10, years: 1, ticketsPerYear: 1350 });
    console.log(JSON.stringify(report));
    expect(report.requests).toBeGreaterThan(30);
    expect(report.errors).toBe(0);
    expect(report.routes.figures.requests).toBeGreaterThan(15);
    expect(report.routes.figures.errors).toBe(0);
    expect(report.routes.board.requests).toBeGreaterThan(15);
    expect(report.routes.board.errors).toBe(0);
    expect(report.engineRunsInRead).toBe(0);
  }, 600_000);
});
