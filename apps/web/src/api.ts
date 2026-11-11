import type { BreakdownReportBody } from '../../../packages/shared/src/ticket.js';
import { cacheFirst, readConfig, readState, saveConfig, saveState } from './offline/cache.js';
import { enqueue, isQueueable } from './offline/outbox.js';

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

export type RaiseKind = 'stopped' | 'support' | 'general';

export type TicketStatus = 'open' | 'working' | 'waiting' | 'closed' | 'cancelled';

export type CommandAction =
  | 'start'
  | 'join'
  | 'leave'
  | 'pause'
  | 'resume'
  | 'transfer'
  | 'update'
  | 'machine-running'
  | 'machine-stopped'
  | 'close'
  | 'report'
  | 'cancel'
  | 'restore'
  | 'correct'
  | 'upgrade-kind';

export interface Machine {
  id: string;
  code: string;
  category: string | null;
  cell: string | null;
  segment_id: string | null;
  group_id: string | null;
  criticality: string | null;
}

export interface Segment {
  id: string;
  code: string;
  name: string;
}

export interface Group {
  id: string;
  segment_id: string;
  code: string;
  name: string;
}

export interface ListItem {
  id: string;
  code: string;
  label: string;
  active: boolean;
}

export interface Person {
  id: string;
  name: string;
  team: string;
  title: string | null;
  active: boolean;
  phone: string | null;
}

export interface Shift {
  id: string;
  code: string;
  name: string;
  starts_at: string;
  ends_at: string;
  crosses_midnight: boolean;
}

export interface Config {
  features: Record<string, boolean>;
  language: string;
  timeZone: string;
  lists: Record<string, ListItem[]>;
  segments: Segment[];
  groups: Group[];
  machines: Machine[];
  people: Person[];
  shifts: Shift[];
}

export interface Figures {
  responseMin: number | null;
  activeMin: number;
  waitMin: number;
  vendorMin: number;
  handoverWaitMin: number;
  downAccMin: number;
  downtimeMin: number | null;
  followMin: number | null;
  repairMin: number;
  perPerson: Record<string, number>;
}

export type CloseKind = 'report' | 'no_report' | 'done';

export type BreakdownCategory = 'E' | 'M' | 'E/M' | 'PM';

export type { BreakdownReportBody };

/** The stored report on ticket detail (server `StoredReport` in ticket-report.ts). */
export interface BreakdownReport {
  id: string;
  ticketId: string | null;
  machineId: string;
  date: string;
  shiftCode: string;
  problem: string;
  observedBy: string | null;
  correctiveAction: string | null;
  downtimeMin: number;
  responseMin: number | null;
  repairMin: number | null;
  breakdownCategory: string | null;
  maintCode: string | null;
  spareUsed: string | null;
  rootCause: string | null;
  handoverName: string | null;
  people: { personId: string; role: 'done' | 'supported' }[];
}

export interface Ticket {
  id: string;
  ref: string;
  kind: RaiseKind;
  status: TicketStatus;
  machineId: string | null;
  machineSnapshot: { code?: string | null; category?: string | null; cell?: string | null } | null;
  problem: string;
  reportedAt: string;
  reportedByPersonId: string | null;
  location: string | null;
  workType: string | null;
  urgent: boolean;
  handedOver: boolean;
  startedAt: string | null;
  leadPersonId: string | null;
  waitReason: string | null;
  machineRunningAt: string | null;
  closedAt: string | null;
  closeKind: CloseKind | null;
  closeNote: string | null;
  figures: Figures | null;
}

export interface State {
  open: Ticket[];
  needReport: Ticket[];
  now: string;
}

export interface TicketEvent {
  seq: number;
  type: string;
  at: string;
  text: string | null;
  reason: string | null;
  isVendor: boolean;
  actingPersonId: string | null;
  loginId: string | null;
}

export interface TicketPerson {
  personId: string;
  role: string;
  leftAt: string | null;
  leftReason: string | null;
}

export interface TicketInterval {
  personId: string;
  role: string;
  startedAt: string;
  endedAt: string | null;
}
export interface TicketDetail {
  ticket: Ticket;
  events: TicketEvent[];
  people: TicketPerson[];
  tasks: unknown[];
  intervals: TicketInterval[];
  report: BreakdownReport | null;
}
export interface Me {
  id: string;
  username: string;
  name: string;
  title: string | null;
  role: string;
  shared: boolean;
  actingPersonId: string;
}

export type CorrectChanges = Partial<
  Pick<Ticket, 'reportedAt' | 'startedAt' | 'closedAt' | 'problem' | 'leadPersonId'>
> & { machineId?: string | null; kind?: RaiseKind; closedByPersonId?: string | null };
export interface RaiseTicketBody {
  kind: RaiseKind;
  machineId?: string;
  location?: string;
  workType?: string;
  urgent?: boolean;
  problem: string;
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
  headers.set('Content-Type', 'application/json');
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

export interface TicketListQuery {
  status?: TicketStatus[];
  kind?: RaiseKind[];
  machineId?: string;
  personId?: string;
  raisedBy?: string;
  from?: string;
  to?: string;
  cursor?: string;
  limit?: number;
}

export interface TicketPage {
  items: Ticket[];
  nextCursor: string | null;
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

/** The action bodies the desk sends; each command from DOMAIN.md §4. */
export type CommandBody =
  | { personId: string }
  | { personId: string; reasonCode: string; note?: string }
  | { personId: string; text: string }
  | { personId: string; note: string; toPersonId?: string }
  | { personId: string; kind: CloseKind; note?: string; report?: BreakdownReportBody }
  | { personId: string; report: BreakdownReportBody }
  | { personId: string; reason: string }
  | { personId: string; role: 'primary' | 'support' }
  | { reason: string; changes: CorrectChanges };

export type CommandResult = { ticket: Ticket } | { queued: true; id: string };

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
