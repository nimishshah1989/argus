import { afterEach, describe, expect, it, vi } from 'vitest';
import { ensurePushBinding, needsRebind, sendTestPush, urlBase64ToUint8Array } from './push.js';

describe('needsRebind', () => {
  it('keeps the binding when the acting person is the same', () => {
    expect(needsRebind('person-1', 'person-1')).toBe(false);
  });

  it('re-binds when the shared phone switches acting person', () => {
    expect(needsRebind('person-1', 'person-2')).toBe(true);
  });

  it('re-binds when nothing was bound yet', () => {
    expect(needsRebind(null, 'person-1')).toBe(true);
  });
});

describe('urlBase64ToUint8Array', () => {
  it('decodes unpadded url-safe base64', () => {
    expect(Array.from(urlBase64ToUint8Array('aGVsbG8'))).toEqual([104, 101, 108, 108, 111]);
  });

  it('decodes the url-safe - and _ characters', () => {
    expect(Array.from(urlBase64ToUint8Array('-_8'))).toEqual([251, 255]);
  });
});

describe('sendTestPush', () => {
  afterEach(() => vi.unstubAllGlobals());

  function stubBrowser(reply: { sent: number }) {
    vi.stubGlobal('localStorage', {
      getItem: () => 'tok-1',
      setItem: () => undefined,
      removeItem: () => undefined,
    });
    const fetchStub = vi.fn(async () => new Response(JSON.stringify(reply), { status: 200 }));
    vi.stubGlobal('fetch', fetchStub);
    return fetchStub;
  }

  it('reports success when the server delivered to a phone', async () => {
    const fetchStub = stubBrowser({ sent: 1 });
    await expect(sendTestPush()).resolves.toBe(true);
    const [url] = fetchStub.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/v1/push/test');
  });

  it('reports failure when the server delivered to no phone', async () => {
    stubBrowser({ sent: 0 });
    await expect(sendTestPush()).resolves.toBe(false);
  });
});

describe('ensurePushBinding', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('registers the phone without naming a person: the server uses the session', async () => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    });
    const subscription = { toJSON: () => ({ endpoint: 'https://push.example/1', keys: {} }) };
    vi.stubGlobal('navigator', {
      serviceWorker: {
        getRegistration: async () => ({
          pushManager: { getSubscription: async () => subscription },
        }),
      },
    });
    vi.stubGlobal('window', { PushManager: {}, Notification: {} });
    vi.stubGlobal('Notification', { permission: 'granted' });
    const fetchStub = vi.fn(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchStub);

    await expect(ensurePushBinding('person-1')).resolves.toBe(true);

    const [url, init] = fetchStub.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/v1/push/subscribe');
    expect(JSON.parse(init.body as string)).not.toHaveProperty('actingPersonId');
    expect(store.get('uptimo.push.person')).toBe('person-1');
  });
});
