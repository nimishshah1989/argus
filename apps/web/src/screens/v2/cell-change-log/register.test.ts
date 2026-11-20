import { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { keepOwners } from '../../../data/index.js';
import { load } from '../data.js';

const server = vi.hoisted(() => ({ figures: vi.fn() }));
vi.mock('../../../api.js', () => ({
  analyticsFiguresQuery: { queryKey: ['analytics-figures', 'one', null], queryFn: server.figures },
  getMe: async () => ({ user: { role: 'head' } }),
  getConfig: async () => ({ machines: [] }),
  getState: async () => ({ open: [] }),
}));

const { screen } = await import('./register.js');
const client = () => keepOwners(new QueryClient({ defaultOptions: { queries: { retry: false } } }));
const reply = (status: string, value: unknown) => ({
  asOf: '2026-11-11',
  figures: [{ key: 'cell-change-log', status, value }],
});

beforeEach(() => {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
  server.figures.mockReset();
});

describe('the cell change log’s own load', () => {
  it('says "not computed" when the engine has not computed the log, which is not an empty log', async () => {
    server.figures.mockResolvedValue(reply('not_computed', null));
    expect((await load(screen.provider, {}, { client: client() })).state).toBe('notComputed');
  });

  it('is ready, with no moves, when the engine computed an empty log', async () => {
    server.figures.mockResolvedValue(reply('ready', { moves: [] }));
    const loaded = await load(screen.provider, {}, { client: client() });
    expect(loaded.state).toBe('ready');
    expect(loaded.model?.moves).toEqual([]);
  });
});
