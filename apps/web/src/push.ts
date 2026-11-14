/**
 * Web push (SPEC 1.8, AC5c): permission only on an explicit tap, subscribe through the server's
 * VAPID public key, and keep the subscription bound to the acting person of this phone.
 *
 * The acting-person rule: a shared phone subscribes for the person currently acting on it. When
 * that person changes, `ensurePushBinding` re-binds the same browser subscription to the new
 * person so the old one is never notified silently.
 */
import { defineResource, PUSH_BOUND_KEY } from './data/index.js';

const BOUND_PERSON_KEY = PUSH_BOUND_KEY;

export type PushState = 'loading' | 'unsupported' | 'unavailable' | 'off' | 'on' | 'denied';

export type PushResult = 'subscribed' | 'prompt' | 'denied' | 'unavailable' | 'unsupported';

interface KeyResponse {
  publicKey: string;
}

export function hasPushSupport(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    typeof window !== 'undefined' &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/** Same acting person keeps the binding; a different one (or none yet) must re-bind. */
export function needsRebind(boundPersonId: string | null, actingPersonId: string): boolean {
  return boundPersonId !== actingPersonId;
}

/** VAPID keys travel as URL-safe base64; `applicationServerKey` wants raw bytes. */
export function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(normalized);
  const bytes = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index);
  return bytes;
}

function boundPersonId(): string | null {
  return localStorage.getItem(BOUND_PERSON_KEY);
}

async function activeRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!hasPushSupport()) return null;
  return (await navigator.serviceWorker.getRegistration()) ?? null;
}

const push = defineResource<KeyResponse>({ key: 'push', path: '/api/v1/push' });

async function serverKey(): Promise<Uint8Array<ArrayBuffer>> {
  const response = await push.one('key');
  return urlBase64ToUint8Array(response.publicKey);
}

/** The server registers the phone for the session's acting person; the id here is only the local note of who. */
async function bind(subscription: PushSubscription, actingPersonId: string): Promise<void> {
  await push.create({ subscription: subscription.toJSON() }, { id: 'subscribe' });
  localStorage.setItem(BOUND_PERSON_KEY, actingPersonId);
}

async function subscribe(
  registration: ServiceWorkerRegistration,
  actingPersonId: string,
): Promise<PushResult> {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'prompt';
  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: await serverKey(),
    }));
  await bind(subscription, actingPersonId);
  return 'subscribed';
}

/** Called from a button tap only: requests permission, subscribes and binds to the person. */
export async function enablePush(actingPersonId: string): Promise<PushResult> {
  if (!hasPushSupport()) return 'unsupported';
  const registration = await activeRegistration();
  if (!registration) return 'unavailable';
  try {
    return await subscribe(registration, actingPersonId);
  } catch {
    // A 503 (no VAPID keys configured) or a failed subscribe: a quiet "not available", no loop.
    return 'unavailable';
  }
}

export async function disablePush(): Promise<void> {
  const registration = await activeRegistration();
  const subscription = registration ? await registration.pushManager.getSubscription() : null;
  if (subscription) {
    try {
      await push.create({ endpoint: subscription.endpoint }, { id: 'unsubscribe' });
    } catch {
      // Keep the phone off locally even if the server call fails.
    }
    await subscription.unsubscribe().catch(() => undefined);
  }
  localStorage.removeItem(BOUND_PERSON_KEY);
}

/** Sends one test alert to this person's phones, through the same server path every alert takes. */
export async function sendTestPush(): Promise<boolean> {
  try {
    await push.create({}, { id: 'test' });
    return true;
  } catch {
    return false;
  }
}

export async function getPushState(): Promise<PushState> {
  if (!hasPushSupport()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  const registration = await activeRegistration();
  const subscription = registration ? await registration.pushManager.getSubscription() : null;
  return subscription ? 'on' : 'off';
}

/**
 * The acting-person re-subscribe rule. Silent (no prompt): it only re-binds an existing
 * subscription when the session's acting person changed. Returns true when it re-bound.
 */
export async function ensurePushBinding(actingPersonId: string): Promise<boolean> {
  if (!hasPushSupport() || Notification.permission !== 'granted') return false;
  if (!needsRebind(boundPersonId(), actingPersonId)) return false;
  const registration = await activeRegistration();
  const subscription = registration ? await registration.pushManager.getSubscription() : null;
  if (!subscription) return false;
  try {
    await bind(subscription, actingPersonId);
    return true;
  } catch {
    return false;
  }
}
