import { forgetPushBinding, forgetWho } from './who.js';
/** The token the login screen stores; every request attaches it. */
const TOKEN_KEY = 'uptimo_token';
/** Where a refused session lands; the sign-in screen reads `signedOut`. */
export const SIGNED_OUT = '/login?signedOut=1';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
  forgetPushBinding();
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  forgetWho();
  forgetPushBinding();
}

/** The ticket a refused dispute names, and the two cells a refused phone names. */
export interface ApiErrorDetails {
  openTicket?: { ticketId: string; ref: string; reportedAt: string };
  machineCell?: string | null;
  loginCell?: string | null;
}

/** A server `{error:{code,message,field}}` body surfaced to the screen. */
export class ApiError extends Error {
  code: string;
  field?: string;
  /** The HTTP status, when the error came from a reply (not from a failed connection). */
  status?: number;
  /** On `reopen_blocked`: the machine's newer open ticket. */
  openTicket?: ApiErrorDetails['openTicket'];
  /** On `other_cell`: the machine's cell and the login's, when known. */
  machineCell?: string | null;
  loginCell?: string | null;
  /** On a resume refused for the lockout: the people still to confirm. */
  missing?: string[];

  constructor(code: string, message: string, field?: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.field = field;
    this.status = status;
  }

  /** The structured fields the server sent beside the code (a new ticket, both cells). */
  withDetails(details: ApiErrorDetails): this {
    this.openTicket = details.openTicket;
    this.machineCell = details.machineCell;
    this.loginCell = details.loginCell;
    return this;
  }
}

/** One line for the console: what failed, with the status and code when there is one. */
export function describeFailure(error: unknown): string {
  if (error instanceof ApiError)
    return `ApiError ${error.code} ${error.status ?? ''} ${error.message}`.replace(/ +/g, ' ');
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}

/**
 * Whether a failed load is worth another try: a lost connection or a server fault may pass; a refusal
 * (401, 403, 404, 422) will not, and retrying it only leaves the screen on "Loading…".
 */
export function worthRetrying(error: unknown): boolean {
  return !(error instanceof ApiError) || error.code === 'internal';
}

async function parseError(res: Response): Promise<ApiError> {
  try {
    const body = (await res.json()) as {
      error?: {
        code?: string;
        message?: string;
        field?: string;
        openTicket?: ApiErrorDetails['openTicket'];
        machineCell?: string | null;
        loginCell?: string | null;
        missing?: string[];
      };
    };
    if (body?.error) {
      const error = new ApiError(
        body.error.code ?? 'internal',
        body.error.message ?? 'Request failed',
        body.error.field,
        res.status,
      ).withDetails({
        openTicket: body.error.openTicket,
        machineCell: body.error.machineCell,
        loginCell: body.error.loginCell,
      });
      error.missing = body.error.missing;
      return error;
    }
  } catch {
    // Non-JSON error body; fall through to a generic message.
  }
  return new ApiError('internal', `Request failed: ${res.status}`, undefined, res.status);
}

/**
 * How a request treats the phone's saved session. `ends`: any 401 means there is no valid session, so go
 * to sign-in. `keep`: a 401 is the screen's to explain (a wrong current password). `none`: sign-in itself,
 * which never carries the saved session, so a mistyped password cannot sign another person out.
 */
type Session = 'ends' | 'keep' | 'none';

/** A request with the phone's saved session. */
export function http<T>(path: string, init?: RequestInit): Promise<T> {
  return send<T>(path, init, 'ends');
}

export function httpWithoutSession<T>(path: string, init?: RequestInit): Promise<T> {
  return send<T>(path, init, 'none');
}

export function httpKeepSession<T>(path: string, init?: RequestInit): Promise<T> {
  return send<T>(path, init, 'keep');
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

/**
 * The one rule for which step a refusal opens: a temporary password comes first, so "choose who is
 * acting" never moves the phone off the password step (no /who <-> /password reload loop).
 */
export function stepFor(code: string, here: string): string | undefined {
  if (code === 'choose_acting_person' && here === STEP_FOR.must_change_password) return undefined;
  return STEP_FOR[code];
}

async function refusal(res: Response): Promise<ApiError> {
  const error = await parseError(res);
  const here = window.location.pathname;
  const step = res.status === 403 ? stepFor(error.code, here) : undefined;
  if (step && here !== step) window.location.assign(step);
  return error;
}

/**
 * No valid session: forget it and go to sign-in (v3.signin.05). With a session that just ended, sign-in
 * says so; a phone that never signed in just gets the sign-in screen. Already there, stay (no reload loop).
 */
function leaveForSignIn(hadSession: boolean): void {
  clearToken();
  // Several calls are usually refused together. The first starts the move; later ones find the token
  // already gone and must not start another that would replace it and lose "You were signed out".
  if (leaving || window.location.pathname === '/login') return;
  leaving = true;
  window.location.assign(hadSession ? SIGNED_OUT : '/login');
}

let leaving = false;

async function send<T>(path: string, init: RequestInit | undefined, session: Session): Promise<T> {
  const token = session === 'none' ? null : getToken();
  const headers = new Headers(init?.headers);
  // A body is JSON unless the caller names its own type (the company logo is raw image bytes).
  if (init?.body !== undefined && !headers.has('Content-Type'))
    headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const res = await fetch(path, { ...init, headers });
  if (res.status === 401 && session === 'ends') {
    leaveForSignIn(token !== null);
    throw new ApiError('unauthenticated', 'unauthorized', undefined, 401);
  }
  if (!res.ok) throw await refusal(res);
  return res.json() as Promise<T>;
}

/** One binary reply (a CSV export): the saved session, a refusal surfaced as usual, then a download. */
export async function downloadFile(path: string, filename: string): Promise<void> {
  const token = getToken();
  const res = await fetch(path, {
    headers: token ? { authorization: `Bearer ${token}` } : undefined,
  });
  if (res.status === 401) {
    leaveForSignIn(token !== null);
    throw new ApiError('unauthenticated', 'unauthorized', undefined, 401);
  }
  if (!res.ok) throw await refusal(res);
  const url = URL.createObjectURL(await res.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
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
