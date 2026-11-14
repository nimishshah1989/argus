/** The token the login screen stores; every request attaches it. */
const TOKEN_KEY = 'uptimo_token';
/** Where a refused session lands; the sign-in screen reads `signedOut`. */
export const SIGNED_OUT = '/login?signedOut=1';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

/** A server `{error:{code,message,field}}` body surfaced to the screen. */
export class ApiError extends Error {
  code: string;
  field?: string;

  constructor(code: string, message: string, field?: string) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.field = field;
  }
}

async function parseError(res: Response): Promise<ApiError> {
  try {
    const body = (await res.json()) as {
      error?: { code?: string; message?: string; field?: string };
    };
    if (body?.error) {
      return new ApiError(
        body.error.code ?? 'internal',
        body.error.message ?? 'Request failed',
        body.error.field,
      );
    }
  } catch {
    // Non-JSON error body; fall through to a generic message.
  }
  return new ApiError('internal', `Request failed: ${res.status}`);
}

/** A request with the phone's saved session. */
export function http<T>(path: string, init?: RequestInit): Promise<T> {
  return send<T>(path, init, getToken());
}

/** Sign-in itself: never carries the saved session, so a mistyped password cannot sign another person out. */
export function httpWithoutSession<T>(path: string, init?: RequestInit): Promise<T> {
  return send<T>(path, init, null);
}

/** A signed-in request whose 401 is a wrong current password for the screen to explain, not an ended session. */
export function httpKeepSession<T>(path: string, init?: RequestInit): Promise<T> {
  return send<T>(path, init, getToken(), false);
}

/** The server's "finish this step first" refusals (403) and the screen that finishes it. */
const STEP_FOR: Record<string, string> = {
  choose_acting_person: '/who',
  must_change_password: '/password',
};

/** Open "who is using this phone" again (the account sheet's switch). */
export function askWhoIsActing(): void {
  window.location.assign(STEP_FOR.choose_acting_person!);
}

async function refusal(res: Response): Promise<ApiError> {
  const error = await parseError(res);
  const step = res.status === 403 ? STEP_FOR[error.code] : undefined;
  if (step && window.location.pathname !== step) window.location.assign(step);
  return error;
}

async function send<T>(
  path: string,
  init: RequestInit | undefined,
  token: string | null,
  endsOn401 = true,
): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body !== undefined) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const res = await fetch(path, { ...init, headers });
  // A 401 on a signed-in request ends the session (v3.signin.05); sign-in shows why.
  if (res.status === 401 && token && endsOn401) {
    clearToken();
    window.location.assign(SIGNED_OUT);
    throw new ApiError('unauthenticated', 'unauthorized');
  }
  if (!res.ok) throw await refusal(res);
  return res.json() as Promise<T>;
}

/** True when the phone has no connection (the UI can show the offline marker). */
export function isOffline(): boolean {
  return typeof navigator !== 'undefined' && !navigator.onLine;
}

export function idempotencyKey(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  // Plain-HTTP contexts lack randomUUID; build a v4 UUID from getRandomValues.
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
