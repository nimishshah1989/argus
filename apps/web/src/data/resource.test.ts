import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from './client.js';
import { defineResource, type Transport } from './resource.js';

afterEach(() => vi.unstubAllGlobals());

describe('defineResource', () => {
  it('one, list, create and update build the request through the transport', async () => {
    const calls: [string, RequestInit | undefined][] = [];
    const transport: Transport = async (path, init) => {
      calls.push([path, init]);
      return {};
    };
    const x = defineResource({ key: 'x', path: '/api/v1/x', transport });
    await x.one();
    await x.one('a b');
    await x.list({ status: ['open', 'waiting'], limit: 50, machineId: '', cursor: undefined });
    await x.create({ a: 1 }, { id: 'subscribe', idempotencyKey: 'k-1' });
    await x.update('code-1', { b: 2 });
    await defineResource({ key: 'm', path: '/api/v1/m/:id/criticality', transport }).update(
      'm-1',
      {},
    );

    expect(calls[0]).toEqual(['/api/v1/x', undefined]);
    expect(calls[1]![0]).toBe('/api/v1/x/a%20b');
    expect(calls[2]![0]).toBe('/api/v1/x?status=open%2Cwaiting&limit=50');
    expect(calls[3]![0]).toBe('/api/v1/x/subscribe');
    expect(calls[3]![1]).toMatchObject({ method: 'POST', body: '{"a":1}' });
    expect(new Headers(calls[3]![1]!.headers).get('Idempotency-Key')).toBe('k-1');
    expect(calls[4]![0]).toBe('/api/v1/x/code-1');
    expect(calls[4]![1]).toMatchObject({ method: 'PUT', body: '{"b":2}' });
    expect(calls[5]![0]).toBe('/api/v1/m/m-1/criticality');
  });

  it('the default transport is the one http client: bearer token, JSON, ApiError on 409', async () => {
    const store = new Map([['uptimo_token', 'tok-1']]);
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
      removeItem: (k: string) => store.delete(k),
    });
    vi.stubGlobal('window', { location: { assign: vi.fn() } });
    const fetchStub = vi.fn(
      async () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchStub);
    const k = defineResource({ key: 'k', path: '/api/v1/k' });

    await expect(k.one()).resolves.toEqual({ ok: true });
    const [url, init] = fetchStub.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/v1/k');
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer tok-1');

    fetchStub.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { code: 'conflict', message: 'Ticket changed' } }), {
        status: 409,
      }),
    );
    const failure = await k.create({}).catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(ApiError);
    expect(failure).toMatchObject({ code: 'conflict', message: 'Ticket changed' });
  });
});
