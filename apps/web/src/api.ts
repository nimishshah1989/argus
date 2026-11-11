import { cacheFirst, readConfig, readState, saveConfig, saveState } from './offline/cache.js';
import { enqueue, isQueueable } from './offline/outbox.js';
import type { TagDefinition, TagList } from '../../../packages/shared/src/tags.js';
import type {
  CommandAction,
  CommandBody,
  CommandResult,
  Config,
  Me,
  RaiseTicketBody,
  SeverityMatrix,
  State,
  Ticket,
  TicketDetail,
  TicketListQuery,
  TicketPage,
} from './api-types.js';

/** The token the login screen stores; every request attaches it. */
const TOKEN_KEY = 'uptimo_token';

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

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body !== undefined) headers.set('Content-Type', 'application/json');
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const res = await fetch(path, { ...init, headers });
  if (res.status === 401) {
    clearToken();
    window.location.assign('/login');
    throw new ApiError('unauthenticated', 'unauthorized');
  }
  if (!res.ok) throw await parseError(res);
  return res.json() as Promise<T>;
}

/** True when the phone has no connection (the UI can show the offline marker). */
export function isOffline(): boolean {
  return typeof navigator !== 'undefined' && !navigator.onLine;
}

function idempotencyKey(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  // Plain-HTTP contexts lack randomUUID; build a v4 UUID from getRandomValues.
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function getConfig(): Promise<Config> {
  return cacheFirst({
    cached: readConfig(),
    offline: isOffline(),
    load: () => api<Config>('/api/v1/config'),
    save: saveConfig,
    isHttpError: (error) => error instanceof ApiError,
  });
}

export function raiseTicket(body: RaiseTicketBody): Promise<{ ticket: Ticket }> {
  return api<{ ticket: Ticket }>('/api/v1/tickets', {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey() },
    body: JSON.stringify(body),
  });
}

export function getState(): Promise<State> {
  return cacheFirst({
    cached: readState(),
    offline: isOffline(),
    load: () => api<State>('/api/v1/state'),
    save: saveState,
    isHttpError: (error) => error instanceof ApiError,
  });
}

export function getTicket(id: string): Promise<TicketDetail> {
  return api<TicketDetail>(`/api/v1/tickets/${id}`);
}

/** `GET /tickets` (M1a-5c): cursor-paginated; status/kind serialise as comma-separated subsets. */
export function listTickets(query: TicketListQuery = {}): Promise<TicketPage> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === '') continue;
    params.set(key, Array.isArray(value) ? value.join(',') : String(value));
  }
  const search = params.toString();
  return api<TicketPage>(`/api/v1/tickets${search ? `?${search}` : ''}`);
}

export function getMe(): Promise<{ user: Me }> {
  return api<{ user: Me }>('/api/v1/auth/me');
}

/** The raw command POST with a caller-supplied key (the outbox replays with the stored one). */
export function sendCommand(
  ticketId: string,
  action: CommandAction,
  body: object,
  key: string,
): Promise<{ ticket: Ticket }> {
  return api<{ ticket: Ticket }>(`/api/v1/tickets/${ticketId}/${action}`, {
    method: 'POST',
    headers: { 'Idempotency-Key': key },
    body: JSON.stringify(body),
  });
}

/**
 * Runs one command. Offline, the four offline-writable commands go to the outbox with a fresh
 * Idempotency-Key and resolve as `{ queued: true }`; everything else needs a connection.
 */
export async function command(
  ticketId: string,
  action: CommandAction,
  body: CommandBody,
): Promise<CommandResult> {
  const key = idempotencyKey();
  if (isOffline() && isQueueable(action)) {
    const entry = await enqueue({
      action,
      ticketId,
      body,
      idempotencyKey: key,
      at: new Date().toISOString(),
    });
    return { queued: true, id: entry.id };
  }
  return sendCommand(ticketId, action, body, key);
}

/** Re-exported so existing `from '../api.js'` type imports keep working after the split. */
export type * from './api-types.js';
export type { TagDefinition, TagList } from '../../../packages/shared/src/tags.js';

export function getTagCatalogue(): Promise<{ tags: TagDefinition[] }> {
  return api<{ tags: TagDefinition[] }>('/api/v1/tags');
}

export function getTicketTags(ticketId: string): Promise<TagList> {
  return api<TagList>(`/api/v1/tickets/${ticketId}/tags`);
}

export function addTicketTag(ticketId: string, tagId: string): Promise<TagList> {
  return api<TagList>(`/api/v1/tickets/${ticketId}/tags`, {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey() },
    body: JSON.stringify({ tagId }),
  });
}

export function removeTicketTag(ticketId: string, tagId: string): Promise<TagList> {
  return api<TagList>(`/api/v1/tickets/${ticketId}/tags/${tagId}`, {
    method: 'DELETE',
    headers: { 'Idempotency-Key': idempotencyKey() },
  });
}

// M2-2.1 severity matrix settings.
export function putSeverityMatrix(value: SeverityMatrix): Promise<{ ok: boolean }> {
  return api<{ ok: boolean }>('/api/v1/settings/severity_matrix', {
    method: 'PUT',
    body: JSON.stringify({ value }),
  });
}

export function putMachineCriticality(
  machineId: string,
  criticality: 'A' | 'B' | 'C' | null,
): Promise<{ ok: boolean }> {
  return api<{ ok: boolean }>(`/api/v1/machines/${machineId}/criticality`, {
    method: 'PUT',
    body: JSON.stringify({ criticality }),
  });
}
