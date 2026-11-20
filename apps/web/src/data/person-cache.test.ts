import { QueryClient } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearToken, setToken, whenSessionChanges } from './client.js';
import { readConfig, readState, saveConfig, saveState } from '../offline/cache.js';
import { isOwnCopy, keepOwners, keepPeopleApart } from './person-cache.js';
import { rememberWho } from './who.js';

beforeEach(() => {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
});
afterEach(() => {
  whenSessionChanges(null);
  vi.unstubAllGlobals();
});

const actingAs = (id: string) => rememberWho({ id, actingPersonId: `${id}-person`, name: id });

describe('what a person’s saved answers do when the session changes', () => {
  it('is told when a login ends and when another one starts, so nothing saved for the last person is kept', () => {
    const changed = vi.fn();
    whenSessionChanges(changed);
    setToken('token-of-the-next-login');
    expect(changed).toHaveBeenCalledTimes(1);
    clearToken();
    expect(changed).toHaveBeenCalledTimes(2);
  });

  it('empties the app’s saved answers on sign-out and on sign-in, as the app wires it at start', () => {
    const client = keepPeopleApart(new QueryClient());
    client.setQueryData(['analytics-figures', 'one', null], { asOf: '2026-11-11', figures: [] });
    client.setQueryData(['me'], { user: { role: 'head' } });
    clearToken();
    expect(client.getQueryData(['me'])).toBeUndefined();
    client.setQueryData(['analytics-figures', 'one', null], { asOf: '2026-11-11', figures: [] });
    setToken('next');
    expect(client.getQueryData(['analytics-figures', 'one', null])).toBeUndefined();
  });

  it('forgets the phone’s saved lists and tickets too, which an offline sign-in would otherwise be handed', () => {
    keepPeopleApart(new QueryClient());
    saveConfig({ machines: [], people: [{ phone: 'a number only an admin sees' }] } as never);
    saveState({ open: [] } as never);
    clearToken();
    expect(readConfig()).toBeNull();
    expect(readState()).toBeNull();
    saveConfig({ machines: [] } as never);
    setToken('next');
    expect(readConfig()).toBeNull();
  });

  it('keeps a saved answer for the person it was fetched for and for no one else', () => {
    const client = keepOwners(new QueryClient());
    const key = ['analytics-figures', 'one', null];
    actingAs('head');
    client.setQueryData(key, { figures: [] });
    expect(isOwnCopy(client, key)).toBe(true);
    actingAs('operator');
    expect(isOwnCopy(client, key)).toBe(false);
    actingAs('head');
    expect(isOwnCopy(client, key)).toBe(true);
  });

  it('does not vouch for an answer that was saved with no stamp', () => {
    const client = new QueryClient();
    client.setQueryData(['me'], { user: { role: 'head' } });
    expect(isOwnCopy(client, ['me'])).toBe(false);
  });
});
