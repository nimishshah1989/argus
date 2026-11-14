import { afterEach, describe, expect, it, vi } from 'vitest';
import { runCommand } from './command.js';

const outbox = vi.hoisted(() => ({ enqueue: vi.fn(async () => ({ id: 'q-1' })) }));
vi.mock('../offline/outbox.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../offline/outbox.js')>()),
  enqueue: outbox.enqueue,
}));

afterEach(() => {
  vi.unstubAllGlobals();
  outbox.enqueue.mockClear();
});

const closeBody = { personId: 'p-1', kind: 'done' as const };

describe('runCommand', () => {
  it('an offline close is queued with its key and nothing is sent', async () => {
    vi.stubGlobal('navigator', { onLine: false });
    const fetchStub = vi.fn();
    vi.stubGlobal('fetch', fetchStub);

    await expect(runCommand('t-1', 'close', closeBody)).resolves.toEqual({
      queued: true,
      id: 'q-1',
    });
    expect(outbox.enqueue).toHaveBeenCalledWith({
      action: 'close',
      ticketId: 't-1',
      body: closeBody,
      idempotencyKey: expect.stringMatching(/.+/),
      at: expect.stringMatching(/^\d{4}-\d\d-\d\dT/),
    });
    expect(fetchStub).not.toHaveBeenCalled();
  });

  it('an offline start is not queued', async () => {
    vi.stubGlobal('navigator', { onLine: false });
    const failure = new TypeError('Failed to fetch');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(failure));
    vi.stubGlobal('localStorage', { getItem: () => null });

    await expect(runCommand('t-1', 'start', { personId: 'p-1' })).rejects.toBe(failure);
    expect(outbox.enqueue).not.toHaveBeenCalled();
  });

  it('online, a command posts to the ticket action with an Idempotency-Key', async () => {
    vi.stubGlobal('navigator', { onLine: true });
    vi.stubGlobal('localStorage', { getItem: () => null });
    const fetchStub = vi.fn(
      async () => new Response(JSON.stringify({ ticket: { id: 't-1' } }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchStub);

    await expect(runCommand('t-1', 'close', closeBody)).resolves.toEqual({
      ticket: { id: 't-1' },
    });
    const [url, init] = fetchStub.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/v1/tickets/t-1/close');
    expect(init.method).toBe('POST');
    expect(new Headers(init.headers).get('Idempotency-Key')).toMatch(/.+/);
    expect(init.body).toBe(JSON.stringify(closeBody));
  });

  it('sends no person of its own: the server takes the acting person from the session', async () => {
    vi.stubGlobal('navigator', { onLine: true });
    vi.stubGlobal('localStorage', {
      getItem: () => JSON.stringify({ loginId: 'l-1', actingPersonId: 'p-new', name: 'N' }),
    });
    const fetchStub = vi.fn(
      async () => new Response(JSON.stringify({ ticket: {} }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchStub);

    await runCommand('t-1', 'start', {});

    const [, init] = fetchStub.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({});
  });

  it('an offline close is queued without a person', async () => {
    vi.stubGlobal('navigator', { onLine: false });

    await runCommand('t-1', 'close', { kind: 'done' });

    expect(outbox.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ body: { kind: 'done' } }),
    );
  });
});
