// @vitest-environment node
import { QueryClient } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, keepOwners, rememberWho } from '../../../data/index.js';
import { load } from '../data.js';
import { PEOPLE, recordedBoard } from './test-board.js';

const server = vi.hoisted(() => ({
  board: vi.fn(),
  me: vi.fn(),
  config: vi.fn(),
  write: vi.fn(),
  reopen: vi.fn(),
}));
vi.mock('../../../api.js', () => ({
  actionCenterBoardQuery: {
    queryKey: ['analytics-action-center', 'one', null],
    queryFn: server.board,
  },
  analyticsFiguresQuery: { queryKey: ['analytics-figures', 'one', null], queryFn: vi.fn() },
  getMe: server.me,
  getConfig: server.config,
  getState: vi.fn(),
  getDrill: vi.fn(),
  writeNudge: server.write,
  reopenNudge: server.reopen,
}));

const { liveActionCenter } = await import('./live.js');
const { REFRESH_MS, refreshEvery, rereadThen } = await import('./refresh.js');
const { screen } = await import('./register.js');

const fresh = () => keepOwners(new QueryClient({ defaultOptions: { queries: { retry: false } } }));
const user = (role: string) => ({
  user: { id: 'login-1', role, actingPersonId: 'p1', shared: false, cell: null },
});
const CONFIG = { machines: [], people: PEOPLE, timeZone: 'Asia/Kolkata' };

beforeEach(() => {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
  rememberWho({ id: 'login-1', actingPersonId: 'p1', name: 'head' });
  for (const fn of Object.values(server)) fn.mockReset();
  server.me.mockResolvedValue(user('head'));
  server.config.mockResolvedValue(CONFIG);
  server.board.mockResolvedValue(recordedBoard());
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('the Action Center from the server', () => {
  it('reads the board v1 read and answers with the screen’s model', async () => {
    const model = await liveActionCenter(fresh());
    expect(model.kpis.map((k) => k.value)).toEqual(['5', '26', '2', '0']);
    expect(server.board).toHaveBeenCalledTimes(1);
  });

  it('refuses a login that may not open the screen, before asking for the board', async () => {
    server.me.mockResolvedValue(user('operator'));
    const loaded = await load(screen.provider, {}, { client: fresh() });
    expect(loaded.state).toBe('refused');
    expect(server.board).not.toHaveBeenCalled();
  });

  it('shows the server’s own refusal as a refusal', async () => {
    server.board.mockRejectedValue(new ApiError('forbidden', 'no', undefined, 403));
    expect((await load(screen.provider, {}, { client: fresh() })).state).toBe('refused');
  });

  it('says offline when the connection is lost and nothing is saved, and error for anything else', async () => {
    server.board.mockRejectedValue(new TypeError('Failed to fetch'));
    expect((await load(screen.provider, {}, { client: fresh() })).state).toBe('offline');
    server.board.mockRejectedValue(new ApiError('boom', 'bad', undefined, 500));
    expect((await load(screen.provider, {}, { client: fresh() })).state).toBe('error');
  });

  it('never serves one login’s board to the next login on the same tab', async () => {
    const client = fresh();
    await liveActionCenter(client);
    rememberWho({ id: 'login-2', actingPersonId: 'p2', name: 'other' });
    server.me.mockResolvedValue(user('head'));
    server.board.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(liveActionCenter(client)).rejects.toThrow();
  });
});

describe('the 30-second refresh v1 had', () => {
  it('asks the server for the board again on every tick, not the saved copy', async () => {
    vi.useFakeTimers();
    const client = fresh();
    await liveActionCenter(client);
    const again = vi.fn(() => void liveActionCenter(client));
    const stop = refreshEvery(client, again);
    await vi.advanceTimersByTimeAsync(REFRESH_MS - 1);
    expect(again).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(again).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(0);
    expect(server.board).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(REFRESH_MS);
    expect(server.board).toHaveBeenCalledTimes(3);
    stop();
    await vi.advanceTimersByTimeAsync(REFRESH_MS * 2);
    expect(again).toHaveBeenCalledTimes(2);
  });

  it('reads again at once after a write answers', async () => {
    const client = fresh();
    await liveActionCenter(client);
    rereadThen(client, () => void liveActionCenter(client));
    await vi.waitFor(() => expect(server.board).toHaveBeenCalledTimes(2));
  });
});
