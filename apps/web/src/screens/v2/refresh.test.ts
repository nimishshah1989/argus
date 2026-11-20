import { QueryClient } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';

const server = vi.hoisted(() => ({ fetched: 0 }));

vi.mock('../../analytics-figures.js', () => ({
  analyticsFiguresQuery: {
    queryKey: ['analytics-figures', 'one', null],
    queryFn: () => Promise.resolve({ asOf: `run ${++server.fetched}`, figures: [] }),
  },
}));

const { analyticsFiguresQuery } = await import('../../analytics-figures.js');
const { watchFigures } = await import('./refresh.js');

afterEach(() => {
  server.fetched = 0;
});

describe('a v2 screen built from the engine’s figures', () => {
  it('is asked to load again each time the figures are refetched with a newer copy, as v1 was kept current by the app’s refetch', async () => {
    const client = new QueryClient();
    client.setQueryData(analyticsFiguresQuery.queryKey, { asOf: '2026-11-11', figures: [] });
    let reloads = 0;
    const stop = watchFigures(client, () => (reloads += 1));
    await client.refetchQueries({ queryKey: analyticsFiguresQuery.queryKey });
    await new Promise((resolve) => setTimeout(resolve, 5));
    await client.refetchQueries({ queryKey: analyticsFiguresQuery.queryKey });
    expect(server.fetched).toBeGreaterThanOrEqual(2);
    expect(reloads).toBeGreaterThanOrEqual(2);
    stop();
    const before = reloads;
    await client.refetchQueries({ queryKey: analyticsFiguresQuery.queryKey });
    expect(reloads).toBe(before);
  });

  it('is not asked to load again for the copy it was first drawn from', () => {
    const client = new QueryClient();
    client.setQueryData(analyticsFiguresQuery.queryKey, { asOf: '2026-11-11', figures: [] });
    let reloads = 0;
    const stop = watchFigures(client, () => (reloads += 1));
    stop();
    expect(reloads).toBe(0);
  });
});
