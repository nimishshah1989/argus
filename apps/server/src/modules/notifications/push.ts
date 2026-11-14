import webpush from 'web-push';
import { isPushEndpoint } from './endpoint.js';
import type { SubscriptionRow } from './repo.js';

/** A push service is given this long to answer (ARCHITECTURE §6). */
const PUSH_TIMEOUT_MS = 10_000;
/** The push service says this address no longer exists: the phone was reset or the app removed. */
const GONE = new Set([404, 410]);
const CODE = /^[A-Za-z0-9_.:-]{1,40}$/;

export interface Vapid {
  configured: boolean;
  publicKey: string;
  privateKey: string;
  subject: string;
}

export function vapidConfig(): Vapid {
  const publicKey = process.env.VAPID_PUBLIC_KEY ?? '';
  const privateKey = process.env.VAPID_PRIVATE_KEY ?? '';
  return {
    configured: Boolean(publicKey && privateKey),
    publicKey,
    privateKey,
    subject: process.env.VAPID_SUBJECT ?? 'mailto:ops@example.com',
  };
}

export type PushResult = { ok: true } | { ok: false; code: string; gone: boolean };

/** Only a status number or a system error code is kept: a message could carry the address or a token. */
function codeOf(error: unknown): { code: string; gone: boolean } {
  const { statusCode, code } = error as { statusCode?: unknown; code?: unknown };
  if (typeof statusCode === 'number')
    return { code: String(statusCode), gone: GONE.has(statusCode) };
  return { code: typeof code === 'string' && CODE.test(code) ? code : 'error', gone: false };
}

/** The one place a push leaves the server. Never throws; a failure comes back as a provider code. */
export async function sendPush(sub: SubscriptionRow, payload: unknown): Promise<PushResult> {
  // Rows saved before the address rule may still hold an internal address: never send to those.
  if (!isPushEndpoint(sub.endpoint)) return { ok: false, code: 'bad_endpoint', gone: false };
  const vapid = vapidConfig();
  if (!vapid.configured) return { ok: false, code: 'not_configured', gone: false };
  try {
    webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);
    await webpush.sendNotification(sub, JSON.stringify(payload), { timeout: PUSH_TIMEOUT_MS });
    return { ok: true };
  } catch (error) {
    return { ok: false, ...codeOf(error) };
  }
}
