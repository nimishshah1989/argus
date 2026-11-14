/**
 * Custom service worker (SPEC 1.8/1.9): precaches the app shell from the injected
 * `self.__WB_MANIFEST`, keeps the offline navigation fallback and the `/api` passthrough of the
 * generateSW build, and shows a web push and opens its ticket on tap.
 *
 * Built by vite-plugin-pwa in `injectManifest` mode (`rollupFormat: 'iife'`), so the output is a
 * classic service worker script; registration stays in main.tsx (`/sw.js`).
 */

declare global {
  interface Window {
    __WB_MANIFEST?: { url: string; revision?: string | null }[];
  }
}

interface SwEvent extends Event {
  waitUntil(promise: Promise<unknown>): void;
}

interface SwFetchEvent extends SwEvent {
  request: Request;
  respondWith(response: Promise<Response>): void;
}

interface SwMessageEvent extends SwEvent {
  data?: { type?: string };
}

interface SwPushEvent extends SwEvent {
  data: { json(): unknown } | null;
}

interface SwNotification {
  close(): void;
  data?: { ticketId?: string };
}

interface SwNotificationEvent extends SwEvent {
  notification: SwNotification;
}

interface SwClient {
  url: string;
  focus(): Promise<unknown>;
  navigate(url: string): Promise<unknown>;
}

interface SwGlobal {
  location: Location;
  registration: {
    showNotification(title: string, options: NotificationOptions): Promise<void>;
  };
  clients: {
    claim(): Promise<void>;
    matchAll(options: { type: 'window'; includeUncontrolled: boolean }): Promise<SwClient[]>;
    openWindow(url: string): Promise<unknown>;
  };
  skipWaiting(): Promise<void>;
  addEventListener(type: 'install' | 'activate', handler: (event: SwEvent) => void): void;
  addEventListener(type: 'fetch', handler: (event: SwFetchEvent) => void): void;
  addEventListener(type: 'message', handler: (event: SwEvent) => void): void;
  addEventListener(type: 'push', handler: (event: SwPushEvent) => void): void;
  addEventListener(type: 'notificationclick', handler: (event: SwNotificationEvent) => void): void;
}

const worker = self as unknown as SwGlobal;
const CACHE = 'uptimo-shell-v1';

const SHELL: string[] = (self.__WB_MANIFEST ?? []).map((entry) => entry.url);

worker.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
});

/** An update waits until a person (or the idle TV) asks for it, so it never lands mid-handover. */
worker.addEventListener('message', (event) => {
  if ((event as SwMessageEvent).data?.type === 'SKIP_WAITING') void worker.skipWaiting();
});

worker.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
      )
      .then(() => worker.clients.claim()),
  );
});

worker.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match('/index.html').then((cached) => cached ?? Response.error()),
      ),
    );
    return;
  }
  event.respondWith(caches.match(request).then((cached) => cached ?? fetch(request)));
});

interface PushPayload {
  title?: string;
  body?: string;
  ticketId?: string;
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function parsePush(data: SwPushEvent['data']): PushPayload {
  if (!data) return {};
  try {
    const raw = data.json();
    if (typeof raw !== 'object' || raw === null) return {};
    const payload = raw as Record<string, unknown>;
    return {
      title: text(payload.title),
      body: text(payload.body),
      ticketId: text(payload.ticketId),
    };
  } catch {
    return {};
  }
}

worker.addEventListener('push', (event) => {
  const payload = parsePush(event.data);
  event.waitUntil(
    worker.registration.showNotification(payload.title ?? 'Uptimo', {
      body: payload.body ?? 'A ticket changed.',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { ticketId: payload.ticketId },
    }),
  );
});

function ticketUrl(ticketId: string | undefined): string {
  return new URL(ticketId ? `/desk/${ticketId}` : '/desk', self.location.origin).href;
}

async function openTicket(url: string): Promise<void> {
  const windows = await worker.clients.matchAll({ type: 'window', includeUncontrolled: true });
  const existing = windows.find((client) => client.url.startsWith(self.location.origin));
  if (existing) {
    await existing.focus();
    await existing.navigate(url).catch(() => undefined);
    return;
  }
  await worker.clients.openWindow(url);
}

worker.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(openTicket(ticketUrl(event.notification.data?.ticketId)));
});

export {};
