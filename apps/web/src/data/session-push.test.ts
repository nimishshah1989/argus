import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PUSH_BOUND_KEY } from './who.js';
import { clearToken, setToken } from './client.js';
import { needsRebind } from '../push.js';

function stubStorage(): Map<string, string> {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
  return store;
}

let store: Map<string, string>;
beforeEach(() => {
  store = stubStorage();
});
afterEach(() => vi.unstubAllGlobals());

describe('push registration across sessions', () => {
  it('signing out forgets who push was bound to, so the same person registers again', () => {
    store.set(PUSH_BOUND_KEY, 'person-1');
    clearToken();
    expect(needsRebind(localStorage.getItem(PUSH_BOUND_KEY), 'person-1')).toBe(true);
  });

  it('a fresh sign-in forgets it too', () => {
    store.set(PUSH_BOUND_KEY, 'person-1');
    setToken('t');
    expect(needsRebind(localStorage.getItem(PUSH_BOUND_KEY), 'person-1')).toBe(true);
  });
});
