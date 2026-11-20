import { QueryClient } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readConfig, saveConfig } from '../../offline/cache.js';

vi.mock('../../api.js', () => ({
  chooseActing: vi.fn(async () => undefined),
  getMe: vi.fn(async () => ({ user: { role: 'operator' } })),
}));
vi.mock('../../push.js', () => ({ ensurePushBinding: vi.fn(async () => undefined) }));
vi.mock('../../offline/replay.js', () => ({ replayOutbox: vi.fn(async () => undefined) }));

const { actAs } = await import('./act-as.js');

beforeEach(() => {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
});
afterEach(() => vi.unstubAllGlobals());

describe('choosing who is using the phone', () => {
  it('forgets what was saved for the person before, in memory and on the phone', async () => {
    const client = new QueryClient();
    client.setQueryData(['analytics-figures', 'one', null], { figures: ['money'] });
    client.setQueryData(['me'], { user: { role: 'admin' } });
    saveConfig({ people: [{ phone: 'a number only an admin sees' }] } as never);
    const me = await actAs(client, 'person-2');
    expect(me.user.role).toBe('operator');
    expect(client.getQueryData(['analytics-figures', 'one', null])).toBeUndefined();
    expect(client.getQueryData(['me'])).toBeUndefined();
    expect(readConfig()).toBeNull();
  });
});
