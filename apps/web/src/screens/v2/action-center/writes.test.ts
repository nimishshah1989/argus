// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sendOf } from './writes.js';
import { recordedBoard } from './test-board.js';

/** The engine's own key for a nudge: it holds a database id, which is why the address bar carries a ref instead. */
const KEY = 'freq|9f1c2a3b-0000-4000-8000-000000000001';
const fetchStub = vi.fn();

beforeEach(() => {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
  fetchStub.mockReset();
  fetchStub.mockImplementation(() =>
    Promise.resolve(
      new Response(JSON.stringify(recordedBoard()), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    ),
  );
  vi.stubGlobal('fetch', fetchStub);
});
afterEach(() => vi.unstubAllGlobals());

/** What went over the wire: the path, the method and the body of the one request. */
function sent() {
  expect(fetchStub).toHaveBeenCalledTimes(1);
  const [url, init] = fetchStub.mock.calls[0] as [string, RequestInit];
  return {
    path: new URL(url, 'http://x').pathname,
    method: init.method,
    body: init.body === undefined ? undefined : JSON.parse(String(init.body)),
  };
}
const address = `/api/v1/analytics/action-center/nudges/${encodeURIComponent(KEY)}`;

describe('what each write sends to the server', () => {
  it('acknowledge: PUT the engine’s key with status ack, owner, due and note', async () => {
    await sendOf({ action: 'ack', key: KEY, owner: 'Asha', due: '2026-11-20', note: 'Check' })();
    expect(sent()).toEqual({
      path: address,
      method: 'PUT',
      body: { status: 'ack', owner: 'Asha', due: '2026-11-20', note: 'Check' },
    });
  });

  it('snooze: PUT with status snooze, and nothing else', async () => {
    await sendOf({ action: 'snooze', key: KEY })();
    expect(sent()).toEqual({ path: address, method: 'PUT', body: { status: 'snooze' } });
  });

  it('resolve: PUT with status resolved (the route stores it as done)', async () => {
    await sendOf({ action: 'resolved', key: KEY })();
    expect(sent()).toEqual({ path: address, method: 'PUT', body: { status: 'resolved' } });
  });

  it('reopen: DELETE on the same address, with no body', async () => {
    await sendOf({ action: 'reopen', key: KEY })();
    expect(sent()).toEqual({ path: address, method: 'DELETE', body: undefined });
  });

  it('asks nothing of the server until the write is sent', () => {
    sendOf({ action: 'resolved', key: KEY });
    expect(fetchStub).not.toHaveBeenCalled();
  });
});
