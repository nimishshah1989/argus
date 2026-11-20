import { QueryClient } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, keepOwners, rememberWho } from '../../../data/index.js';
import { load, stateOfError, type Provider } from '../data.js';
import { LiveOffline, NotComputed } from './live-error.js';

const server = vi.hoisted(() => ({ figures: vi.fn(), me: vi.fn() }));
vi.mock('../../../api.js', () => ({
  analyticsFiguresQuery: { queryKey: ['analytics-figures', 'one', null], queryFn: server.figures },
  getMe: server.me,
  getConfig: vi.fn(),
  getState: vi.fn(),
}));

const { liveReply, liveRole, savedFigures } = await import('./live.js');
const REPLY = { asOf: '2026-11-11', figures: [] };
const fresh = () => keepOwners(new QueryClient({ defaultOptions: { queries: { retry: false } } }));

const actingAs = (loginId: string) =>
  rememberWho({ id: loginId, actingPersonId: `${loginId}-person`, name: loginId });

beforeEach(() => {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
  actingAs('head-login');
  server.figures.mockReset();
  server.me.mockReset();
});
afterEach(() => vi.unstubAllGlobals());

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

describe('a saved copy belongs to the person it was fetched for', () => {
  const HEAD_REPLY = { asOf: '2026-11-11', figures: [{ key: 'money', status: 'ready' }] };
  const OPERATOR_REPLY = { asOf: '2026-11-11', figures: [] };

  it('does not hand one login’s reply or role to the next login on the same tab', async () => {
    const client = fresh();
    server.figures.mockResolvedValue(HEAD_REPLY);
    server.me.mockResolvedValue({ user: { role: 'head' } });
    expect(await liveReply(client)).toBe(HEAD_REPLY);
    expect(await liveRole(client)).toBe('head');

    actingAs('operator-login');
    server.figures.mockResolvedValue(OPERATOR_REPLY);
    server.me.mockResolvedValue({ user: { role: 'operator' } });
    expect(await liveReply(client)).toBe(OPERATOR_REPLY);
    expect(await liveRole(client)).toBe('operator');
    expect(server.figures).toHaveBeenCalledTimes(2);
  });

  it('never serves the earlier login’s copy when the connection is lost', async () => {
    const client = fresh();
    server.figures.mockResolvedValue(HEAD_REPLY);
    await liveReply(client);
    actingAs('operator-login');
    server.figures.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(liveReply(client)).rejects.toBeInstanceOf(LiveOffline);
  });

  it('serves a copy again for the person it was fetched for, and says it is a saved copy', async () => {
    const client = fresh();
    server.figures.mockResolvedValue(HEAD_REPLY);
    await liveReply(client);
    expect(savedFigures(client)).toBe(false);
    client.invalidateQueries({ queryKey: ['analytics-figures'] });
    server.figures.mockRejectedValue(new TypeError('Failed to fetch'));
    expect(await liveReply(client)).toBe(HEAD_REPLY);
    expect(savedFigures(client)).toBe(true);
  });
});

describe('what counts as a lost connection', () => {
  it('serves the saved copy for a dropped connection only; a malformed reply is an error', async () => {
    const client = fresh();
    server.figures.mockResolvedValue(REPLY);
    await liveReply(client);
    client.invalidateQueries({ queryKey: ['analytics-figures'] });
    server.figures.mockRejectedValue(new SyntaxError('Unexpected token < in JSON'));
    await expect(liveReply(client)).rejects.toBeInstanceOf(SyntaxError);
    expect(stateOfError(await liveReply(client).catch((error: unknown) => error))).toBe('error');
  });
});

describe('the state a failed load shows', () => {
  const failing =
    (error: unknown): Provider<'dashboard'> =>
    () =>
      Promise.reject(error);

  it('maps a 403 to refused, a lost connection to offline, a missing thing to empty, a figure not yet computed to notComputed, the rest to error', async () => {
    const cases: [unknown, string][] = [
      [new ApiError('forbidden', 'no', undefined, 403), 'refused'],
      [new LiveOffline(), 'offline'],
      [new NotComputed(), 'notComputed'],
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
