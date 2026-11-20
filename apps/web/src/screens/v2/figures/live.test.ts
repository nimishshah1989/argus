import { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../data/index.js';
import { load, stateOfError, type Provider } from '../data.js';
import { LiveOffline } from './live-error.js';

const server = vi.hoisted(() => ({ figures: vi.fn(), me: vi.fn() }));
vi.mock('../../../api.js', () => ({
  analyticsFiguresQuery: { queryKey: ['analytics-figures', 'one', null], queryFn: server.figures },
  getMe: server.me,
  getConfig: vi.fn(),
  getState: vi.fn(),
}));

const { liveReply, liveRole } = await import('./live.js');
const REPLY = { asOf: '2026-11-11', figures: [] };
const fresh = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });

beforeEach(() => {
  server.figures.mockReset();
  server.me.mockReset();
});

describe('the live source of the v2 screens', () => {
  it('reads the engine reply once for every screen that asks, and keeps it where v1 keeps it', async () => {
    server.figures.mockResolvedValue(REPLY);
    const client = fresh();
    expect(await liveReply(client)).toBe(REPLY);
    expect(await liveReply(client)).toBe(REPLY);
    expect(server.figures).toHaveBeenCalledTimes(1);
    expect(client.getQueryData(['analytics-figures', 'one', null])).toBe(REPLY);
  });

  it('reads the signed-in role the way the v1 shell does', async () => {
    server.me.mockResolvedValue({ user: { role: 'head' } });
    const client = fresh();
    expect(await liveRole(client)).toBe('head');
    expect(client.getQueryData(['me'])).toEqual({ user: { role: 'head' } });
  });

  it('lets a refusal through as the server said it', async () => {
    server.figures.mockRejectedValue(new ApiError('forbidden', 'no', undefined, 403));
    await expect(liveReply(fresh())).rejects.toMatchObject({ status: 403 });
  });

  it('says offline when the connection is lost and nothing is saved', async () => {
    server.figures.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(liveReply(fresh())).rejects.toBeInstanceOf(LiveOffline);
  });

  it('serves the saved copy when the connection is lost after an earlier read', async () => {
    const client = fresh();
    client.setQueryData(['analytics-figures', 'one', null], REPLY);
    client.invalidateQueries({ queryKey: ['analytics-figures'] });
    server.figures.mockRejectedValue(new TypeError('Failed to fetch'));
    expect(await liveReply(client)).toBe(REPLY);
  });
});

describe('the state a failed load shows', () => {
  const failing =
    (error: unknown): Provider<'dashboard'> =>
    () =>
      Promise.reject(error);

  it('maps a 403 to refused, a lost connection to offline, a missing thing to empty, the rest to error', async () => {
    const cases: [unknown, string][] = [
      [new ApiError('forbidden', 'no', undefined, 403), 'refused'],
      [new LiveOffline(), 'offline'],
      [new ApiError('not_found', 'gone', undefined, 404), 'empty'],
      [new ApiError('internal', 'boom', undefined, 500), 'error'],
      [new Error('adapter bug'), 'error'],
    ];
    for (const [error, state] of cases) {
      expect(stateOfError(error)).toBe(state);
      expect((await load(failing(error), {})).state).toBe(state);
    }
  });
});
