import { QueryClient } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const server = vi.hoisted(() => ({
  figures: vi.fn(),
  prior: vi.fn(),
  state: vi.fn(),
  board: vi.fn(),
  config: vi.fn(),
}));
vi.mock('../../../api.js', () => ({
  analyticsFiguresQuery: { queryKey: ['analytics-figures', 'one', null], queryFn: server.figures },
  analyticsFiguresAtQuery: (day: string) => ({
    queryKey: ['analytics-figures', 'at', day],
    queryFn: server.prior,
  }),
  actionCenterBoardQuery: {
    queryKey: ['analytics-action-center', 'one', null],
    queryFn: server.board,
  },
  getState: server.state,
  getConfig: server.config,
  getMe: vi.fn(),
}));

const { dashboardFacts } = await import('./live.js');
const { REFRESH_MS, refreshEvery } = await import('./refresh.js');

const fresh = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-11T09:00:00Z'));
  server.figures.mockResolvedValue({ asOf: '2026-11-11', figures: [], excludedMachines: 0 });
  server.prior.mockResolvedValue({ asOf: '2026-10-12', figures: [] });
  server.state.mockResolvedValue({ open: [], now: '2026-11-11T09:00:00Z' });
  server.board.mockResolvedValue({ counts: { open: 0 }, bySeverity: {} });
  server.config.mockResolvedValue({ machines: [] });
});
afterEach(() => {
  vi.useRealTimers();
  for (const fn of Object.values(server)) fn.mockReset();
});

describe('what the Dashboard reads, and how often', () => {
  it('reads the desk’s open tickets and the Action Center again once 30 seconds have passed, as v1 did', async () => {
    const client = fresh();
    await dashboardFacts(client);
    await dashboardFacts(client);
    expect(server.state).toHaveBeenCalledTimes(1);
    expect(server.board).toHaveBeenCalledTimes(1);
    vi.setSystemTime(new Date('2026-11-11T09:00:31Z'));
    await dashboardFacts(client);
    expect(server.state).toHaveBeenCalledTimes(2);
    expect(server.board).toHaveBeenCalledTimes(2);
  });

  it('asks for a new model every 30 seconds while the page is open, and stops when it closes', () => {
    const again = vi.fn();
    const stop = refreshEvery(again);
    expect(REFRESH_MS).toBe(30_000);
    vi.advanceTimersByTime(29_999);
    expect(again).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(again).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(60_000);
    expect(again).toHaveBeenCalledTimes(3);
    stop();
    vi.advanceTimersByTime(120_000);
    expect(again).toHaveBeenCalledTimes(3);
  });
});
